// Keep provider grammar small; the complete Zod contract still validates results.
const applicationConstraints = new Set([
  "$schema",
  "minItems",
  "maxItems",
  "minLength",
  "maxLength",
  "minimum",
  "maximum",
]);
export function providerSchema(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(providerSchema);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !applicationConstraints.has(key))
      .map(([key, child]) => [
        key,
        key === "properties" && child && typeof child === "object"
          ? Object.fromEntries(
              Object.entries(child).map(([name, property]) => [
                name,
                providerSchema(property),
              ]),
            )
          : providerSchema(child),
      ]),
  );
}
