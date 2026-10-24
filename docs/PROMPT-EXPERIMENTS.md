# Prompt experimentation

The Checkpoint workspace includes a prompt lab alongside its existing human review workflow. A user can test a prompt, edit the response, refine it with feedback, ask AI to improve the prompt and test it, compare versions, and save or export the experiment. Generating or refining creates a separate version; switching versions does not spend an AI request. Comparison shows both actual prompts and responses with character counts, without inventing quality scores.

Experiments are saved explicitly to this browser's IndexedDB and can be opened or deleted individually. They are not cloud synced. The experiment title is optional; its prompt supplies the default title. An experiment keeps up to 30 versions. At that limit, the interface asks the user to save and start another experiment instead of discarding earlier versions. Export downloads all current versions as Markdown.

`POST /api/experiments` shares the server-only Gemini generation layer and managed request limiter with the other tools. It checks the origin, JSON media type, a streaming 65,000-byte body limit, typed input, and typed output. It sends only the current prompt, optional refinement instruction, and current response to the provider. API credentials remain on the server. User-supplied drafts are treated as untrusted text, and no external tools or app actions are exposed.

The prompt has a 12,000-character limit, refinement instructions 4,000 characters, and each response 20,000 characters. The byte limit can be reached sooner by large multilingual refinements; the interface retains the prompt and earlier versions when the server rejects a request. Generation, cancellation, provider failures, and storage failures retain the draft. Usage is recorded from actual successful or failed requests.

Routine tests use mocked provider responses. The tests cover input and output validation, origin and body-size protection, rate limiting, generation and refinement, editable version comparison, explicit saves, duplicate prevention, and retention of previous responses on errors. No paid API call is required to test this workflow.
