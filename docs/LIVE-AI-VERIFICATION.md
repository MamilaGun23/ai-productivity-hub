# Live Gemini verification

On 23 October 2026, an owner-supplied key successfully authenticated and listed available models. The application uses `gemini-3.5-flash-lite`; the key is configured only in ignored `.env.local`.

All seven final requests to the actual local Next.js API returned HTTP 200 and passed the complete Zod response schemas:

1. Email generation.
2. Meeting summary and action extraction.
3. Task planning with a relative schedule and no invented absolute deadline.
4. General-knowledge research with the correct evidence label.
5. Supplied-material analysis with the correct evidence label.
6. Checkpoint review.
7. Checkpoint revision with changed, nonempty content.

See `live-ai-results.json` for status and timing metadata. Generated content and credentials are deliberately excluded.

## Compatibility fix

The initial live meeting call exposed a schema-grammar rejection by the provider. The provider-facing schema now omits array/length/numeric bounds that increase grammar complexity. Types, required fields, object structure and enums are retained. The complete Zod contract still validates all limits and task dependency rules after generation; application validation was not relaxed.

Google documents this limitation in its [structured-output guidance](https://ai.google.dev/gemini-api/docs/structured-output.md?example=recipe). Two regression tests cover the schema conversion, including preserving output property names that coincide with constraint keywords.

## Reproduction and remaining work

With the local development server running, set `RUN_LIVE_AI_TESTS=1`, then run `node scripts/verify-live-ai.mjs`. This makes seven real provider requests and consumes quota. It is excluded from routine tests and CI. Routine tests continue to use mocks.

This update supersedes earlier statements that Gemini account access was unavailable or live integration unverified. It verifies local integration only. Production Redis configuration, GitHub publication, Vercel deployment, public access and CAPACITI platform confirmation remain outstanding.

Rotate the key shared in chat and replace it in `.env.local`; configure the replacement separately in Vercel environment secrets when deploying. Never commit or share the key.
