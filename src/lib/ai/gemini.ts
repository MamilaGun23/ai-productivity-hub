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
export async function generate(feature: Feature, input: unknown) {
  if (!process.env.GEMINI_API_KEY)
    throw new ServiceError(
      503,
      "AI is not configured yet. Ask the site owner to set GEMINI_API_KEY on the server.",
    );
  const client = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  const schema = outputSchemas[feature];
  try {
    const response = await client.models.generateContent({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash-lite",
      contents: JSON.stringify({ userProvidedData: input }),
      config: {
        systemInstruction: systemPrompt(feature),
        responseMimeType: "application/json",
        responseJsonSchema: providerSchema(z.toJSONSchema(schema)),
        maxOutputTokens: 8192,
        httpOptions: { timeout: 45000 },
      },
    });
    let json: unknown;
    try {
      json = JSON.parse(response.text ?? "");
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
    if (feature === "research") {
      const mode = (input as { mode: string }).mode;
      if (
        (result.data as { basis: string }).basis !==
        (mode === "source" ? "Supplied material" : "General model knowledge")
      )
        throw new ServiceError(
          502,
          "The AI response used the wrong research basis. Please try again.",
        );
    }
    return result.data;
  } catch (error) {
    if (error instanceof ServiceError) throw error;
    const status =
      typeof error === "object" && error !== null && "status" in error
        ? Number(error.status)
        : 0;
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
    if (error instanceof Error && /timeout|abort/i.test(error.message))
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
