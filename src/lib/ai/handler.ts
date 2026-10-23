import { featureSchema, requestSchemas } from "../contracts";
import { generate, ServiceError } from "./gemini";
import { enforceLimit } from "../security";
export async function handleAI(request: Request, feature: string) {
  try {
    const parsedFeature = featureSchema.safeParse(feature);
    if (!parsedFeature.success)
      return Response.json({ error: "Unknown AI tool." }, { status: 404 });
    const origin = request.headers.get("origin");
    if (origin && origin !== new URL(request.url).origin)
      throw new ServiceError(403, "Cross-origin requests are not allowed.");
    if (!request.headers.get("content-type")?.includes("application/json"))
      throw new ServiceError(415, "Send an application/json request.");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 65000)
      throw new ServiceError(
        413,
        "This request is too large. Shorten your input.",
      );
    const reader = request.body?.getReader();
    if (!reader) throw new ServiceError(400, "Request body is required.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 65000) {
        await reader.cancel();
        throw new ServiceError(
          413,
          "This request is too large. Shorten your input.",
        );
      }
      chunks.push(value);
    }
    let body: unknown;
    try {
      body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      throw new ServiceError(400, "The request contains invalid JSON.");
    }
    const input = requestSchemas[parsedFeature.data].safeParse(body);
    if (!input.success)
      return Response.json(
        { error: input.error.issues[0]?.message ?? "Check your input." },
        { status: 400 },
      );
    await enforceLimit(request);
    const output = await generate(parsedFeature.data, input.data);
    return Response.json(
      { output },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const safe =
      error instanceof ServiceError
        ? error
        : new ServiceError(
            500,
            "An unexpected server error occurred. Please try again.",
          );
    return Response.json(
      { error: safe.message },
      {
        status: safe.status,
        headers: {
          "Cache-Control": "no-store",
          ...(safe.status === 429 ? { "Retry-After": "600" } : {}),
        },
      },
    );
  }
}
