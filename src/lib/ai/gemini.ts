import "server-only";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import { outputSchemas, type Feature } from "../contracts";
import { systemPrompt } from "./prompts";
import { providerSchema } from "./provider-schema";

export class ServiceError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

function providerStatus(error: unknown) {
  return typeof error === "object" && error !== null && "status" in error
    ? Number(error.status)
    : 0;
}
function wait(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const abort = () => {
      clearTimeout(timer);
      reject(new DOMException("Cancelled", "AbortError"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", abort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", abort, { once: true });
    if (signal?.aborted) abort();
  });
}

/** Shared validated provider boundary. Retries only transient transport/5xx failures, never invalid output or quota/auth errors. */
export async function generateStructured<T>(
  schema: z.ZodType<T>,
  instruction: string,
  input: unknown,
  options: { signal?: AbortSignal; maxOutputTokens?: number } = {},
): Promise<T> {
  if (!process.env.GEMINI_API_KEY)
    throw new ServiceError(
      503,
      "AI is not configured yet. Ask the site owner to set GEMINI_API_KEY on the server.",
    );
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  try {
    let response;
    for (let attempt = 0; attempt < 3; attempt++) {
      options.signal?.throwIfAborted();
      try {
        response = await client.models.generateContent({
          model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
          contents: JSON.stringify({ userProvidedData: input }),
          config: {
            systemInstruction: instruction,
            responseMimeType: "application/json",
            responseJsonSchema: providerSchema(z.toJSONSchema(schema)),
            maxOutputTokens: options.maxOutputTokens ?? 8192,
            abortSignal: options.signal,
            // The SDK otherwise retries five times internally. One attempt here
            // keeps retry policy and the serverless time budget in this boundary.
            httpOptions: { timeout: 15000, retryOptions: { attempts: 1 } },
          },
        });
        break;
      } catch (error) {
        const status = providerStatus(error);
        if (options.signal?.aborted)
          throw new DOMException("Cancelled", "AbortError");
        const transient =
          status === 408 ||
          status >= 500 ||
          (status === 0 &&
            error instanceof Error &&
            (/network|fetch|timeout|timed\s*out|abort|ECONN|socket/i.test(
              error.message,
            ) ||
              error.name === "TimeoutError"));
        if (!transient || attempt === 2) throw error;
        await wait(
          400 * 2 ** attempt + Math.floor(Math.random() * 150),
          options.signal,
        );
      }
    }
    let json: unknown;
    try {
      json = JSON.parse(response?.text ?? "");
    } catch {
      throw new ServiceError(
        502,
        "The AI returned an incomplete response. Please try again.",
      );
    }
    const result = schema.safeParse(json);
    if (!result.success)
      throw new ServiceError(
        502,
        "The AI response did not match the required format. Please try again.",
      );
    return result.data;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    if (options.signal?.aborted)
      throw new DOMException("Cancelled", "AbortError");
    const status = providerStatus(error);
    if (status === 429)
      throw new ServiceError(
        429,
        "The AI service quota or rate limit was reached. Please try again later.",
      );
    if (status === 400 || status === 404)
      throw new ServiceError(
        503,
        "The AI model configuration is unavailable. Ask the owner to check GEMINI_MODEL and account access.",
      );
    if (status === 401 || status === 403)
      throw new ServiceError(
        503,
        "The AI provider could not authorize this request. Ask the owner to check the server configuration.",
      );
    if (
      status === 408 ||
      status === 504 ||
      (error instanceof Error &&
        (/timeout|timed\s*out|abort/i.test(error.message) ||
          error.name === "TimeoutError"))
    )
      throw new ServiceError(
        504,
        "The AI request timed out. Please try again.",
      );
    throw new ServiceError(
      502,
      "The AI provider could not be reached. Please try again shortly.",
    );
  }
}
export async function generate(feature: Feature, input: unknown) {
  const result = await generateStructured(
    outputSchemas[feature] as z.ZodType<unknown>,
    systemPrompt(feature),
    input,
  );
  if (
    feature === "research" &&
    (result as { basis: string }).basis !==
      ((input as { mode: string }).mode === "source"
        ? "Supplied material"
        : "General model knowledge")
  )
    throw new ServiceError(
      502,
      "The AI response used the wrong research basis. Please try again.",
    );
  return result;
}
