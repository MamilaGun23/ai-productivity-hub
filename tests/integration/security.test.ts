import { beforeEach, describe, it, expect, vi } from "vitest";
const mock = vi.hoisted(() => ({ limit: vi.fn(), firewall: vi.fn() }));
vi.mock("@vercel/firewall", () => ({ checkRateLimit: mock.firewall }));
vi.mock("@upstash/redis", () => ({ Redis: class {} }));
vi.mock("@upstash/ratelimit", () => ({
  Ratelimit: class {
    static slidingWindow() {
      return {};
    }
    limit = mock.limit;
  },
}));
import { enforceLimit } from "../../src/lib/security";
beforeEach(() => {
  vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
  vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
  vi.stubEnv("REQUIRE_RATE_LIMIT", "");
  vi.stubEnv("RATE_LIMIT_PROVIDER", "");
  mock.limit.mockReset();
  mock.firewall.mockReset();
});
describe("serverless abuse protection", () => {
  it("uses the configured Vercel managed rule before allowing generation", async () => {
    vi.stubEnv("RATE_LIMIT_PROVIDER", "vercel");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    mock.firewall.mockResolvedValue({ rateLimited: false });
    const request = new Request("https://example.com");
    await expect(enforceLimit(request)).resolves.toBeUndefined();
    expect(mock.firewall).toHaveBeenCalledWith("ai-generation", {
      request,
      timeout: 5000,
    });
    expect(mock.limit).not.toHaveBeenCalled();
  });
  it("rejects excessive requests using the Vercel managed rule", async () => {
    vi.stubEnv("RATE_LIMIT_PROVIDER", "vercel");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    mock.firewall.mockResolvedValue({ rateLimited: true });
    await expect(
      enforceLimit(new Request("https://example.com")),
    ).rejects.toMatchObject({ status: 429 });
  });
  it("fails closed for a missing Vercel rule or unavailable service", async () => {
    vi.stubEnv("RATE_LIMIT_PROVIDER", "vercel");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("NODE_ENV", "production");
    mock.firewall.mockResolvedValue({ rateLimited: false, error: "not-found" });
    await expect(
      enforceLimit(new Request("https://example.com")),
    ).rejects.toMatchObject({ status: 503 });
    mock.firewall.mockRejectedValue(new Error("provider detail"));
    await expect(
      enforceLimit(new Request("https://example.com")),
    ).rejects.toMatchObject({
      status: 503,
      message:
        "Request protection is temporarily unavailable. Please try again later.",
    });
  });
  it("does not silently disable Vercel protection outside its production runtime", async () => {
    vi.stubEnv("RATE_LIMIT_PROVIDER", "vercel");
    vi.stubEnv("VERCEL", "");
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      enforceLimit(new Request("http://localhost")),
    ).rejects.toMatchObject({ status: 503 });
    expect(mock.firewall).not.toHaveBeenCalled();
  });
  it("fails closed in production when the managed limiter is unconfigured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    await expect(
      enforceLimit(new Request("https://example.com")),
    ).rejects.toMatchObject({ status: 503 });
  });
  it("allows credential-free local development without pretending it is rate limited", async () => {
    vi.stubEnv("NODE_ENV", "development");
    await expect(
      enforceLimit(new Request("http://localhost")),
    ).resolves.toBeUndefined();
    expect(mock.limit).not.toHaveBeenCalled();
  });
  it("hashes the platform client address and rejects excessive requests", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
    mock.limit.mockResolvedValue({ success: true });
    const request = new Request("https://example.com", {
      headers: { "x-vercel-forwarded-for": "192.0.2.1" },
    });
    await enforceLimit(request);
    expect(mock.limit.mock.calls[0][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(mock.limit.mock.calls[0][0]).not.toContain("192.0.2.1");
    mock.limit.mockResolvedValue({ success: false });
    await expect(enforceLimit(request)).rejects.toMatchObject({ status: 429 });
  });
  it("fails closed when the limiter cannot be reached", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.com");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "test");
    mock.limit.mockRejectedValue(new Error("secret provider details"));
    await expect(
      enforceLimit(
        new Request("https://example.com", {
          headers: { "x-vercel-forwarded-for": "192.0.2.1" },
        }),
      ),
    ).rejects.toMatchObject({
      status: 503,
      message:
        "Request protection is temporarily unavailable. Please try again later.",
    });
  });
});
