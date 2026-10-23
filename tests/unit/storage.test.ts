import { describe, it, expect } from "vitest";
import { readHistory, writeHistory, HISTORY_KEY } from "../../src/lib/storage";
import { outputs } from "../fixtures";
const entry = {
  id: "one",
  feature: "email" as const,
  title: "Proposal",
  createdAt: "2026-10-23T10:00:00.000Z",
  updatedAt: "2026-10-23T10:00:00.000Z",
  input: { topic: "Proposal" },
  output: outputs.email,
};
describe("versioned local history", () => {
  it("restores only validated entries", () => {
    const data = new Map<string, string>();
    const storage = {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => {
        data.set(key, value);
      },
    };
    writeHistory(storage, [entry]);
    expect(readHistory(storage)).toEqual([entry]);
  });
  it("returns an empty workspace without saved content", () => {
    expect(readHistory({ getItem: () => null })).toEqual([]);
  });
  it("rejects malformed, outdated and invalid model data", () => {
    for (const value of [
      "{",
      JSON.stringify({ version: 2, entries: [] }),
      JSON.stringify({
        version: 1,
        entries: [{ ...entry, output: { body: 42 } }],
      }),
    ])
      expect(() => readHistory({ getItem: () => value })).toThrow();
  });
  it("limits saved history to 50 entries", () => {
    let raw = "";
    writeHistory(
      {
        setItem: (key, value) => {
          expect(key).toBe(HISTORY_KEY);
          raw = value;
        },
      },
      Array.from({ length: 60 }, (_, i) => ({ ...entry, id: String(i) })),
    );
    expect(JSON.parse(raw).entries).toHaveLength(50);
  });
  it("surfaces blocked storage rather than claiming a save", () => {
    expect(() =>
      writeHistory(
        {
          setItem: () => {
            throw new Error("quota");
          },
        },
        [entry],
      ),
    ).toThrow("quota");
  });
});
