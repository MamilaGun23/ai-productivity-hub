import "server-only";
import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { Ratelimit } from "@upstash/ratelimit";
import { checkRateLimit } from "@vercel/firewall";
import { ServiceError } from "./ai/gemini";
let limiter: Ratelimit | undefined;
export async function enforceLimit(request: Request) {
  if (process.env.RATE_LIMIT_PROVIDER === "vercel") {
    if (!process.env.VERCEL || process.env.NODE_ENV !== "production")
      throw new ServiceError(
        503,
        "Vercel request protection requires a deployed production runtime.",
      );
    try {
      const result = await checkRateLimit("ai-generation", {
        request,
        timeout: 5000,
      });
      if (result.rateLimited)
        throw new ServiceError(
          429,
          "You have reached 10 requests in 10 minutes. Please wait before generating again.",
        );
      if (result.error)
        throw new ServiceError(
          503,
          "Public AI generation is paused until the owner configures the ai-generation firewall rule.",
        );
      return;
    } catch (error) {
      if (error instanceof ServiceError) throw error;
      throw new ServiceError(
        503,
        "Request protection is temporarily unavailable. Please try again later.",
      );
    }
  }
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) {
    if (
      process.env.NODE_ENV === "production" ||
      process.env.REQUIRE_RATE_LIMIT === "true"
    )
      throw new ServiceError(
        503,
        "Public AI generation is paused until the owner configures managed rate limiting.",
      );
    return;
  }
  limiter ??= new Ratelimit({
    redis: new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, "10 m"),
    prefix: "aph:ai",
    analytics: false,
  });
  // Vercel overwrites x-vercel-forwarded-for; do not trust arbitrary forwarded headers in production.
  const ip = process.env.VERCEL
    ? request.headers.get("x-vercel-forwarded-for")?.split(",")[0]?.trim()
    : "local-development";
  if (!ip)
    throw new ServiceError(
      503,
      "Unable to establish the request origin for rate limiting.",
    );
  const key = createHash("sha256").update(ip).digest("hex");
  try {
    const result = await limiter.limit(key);
    if (!result.success)
      throw new ServiceError(
        429,
        "You have reached 10 requests in 10 minutes. Please wait before generating again.",
      );
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    throw new ServiceError(
      503,
      "Request protection is temporarily unavailable. Please try again later.",
    );
  }
}
