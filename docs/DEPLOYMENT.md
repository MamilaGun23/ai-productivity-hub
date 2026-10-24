# Publish to GitHub and Vercel

This source runs on Vercel's native Next.js Node runtime. The verified production site is https://ai-productivity-hub-tshifhiwa11austin-4119.vercel.app and requires no registration. The following instructions support reproducing the deployment and publishing the source repository.

## 1. Publish the repository

Install Git if `git --version` fails, then open a new terminal. Create an empty GitHub repository named `ai-productivity-hub` using your account; do not initialize it with a separate README. From this project:

```powershell
git init
git add .
git status
git diff --cached --check
git commit -m "Build AI Productivity Hub with Gemini and human review"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/ai-productivity-hub.git
git push -u origin main
```

Replace the example owner with your actual account. Check staged files before committing. `.env.local`, `.next`, `node_modules`, browser traces and `.vercel` are ignored. The lockfile belongs in the repository. No force-push is needed.

## 2. Configure Gemini

Create a key in Google AI Studio. Confirm that the account can access `gemini-3.5-flash-lite` or choose another currently supported text model with JSON Schema output support. Enable billing/quota as your account requires and set usage/spending restrictions. Do not assume a free tier.

Only add the key through `.env.local` for local development or Vercel's secret environment configuration for hosting. Never paste it in client code, repository files, screenshots, issue reports, or chat.

## 3. Configure shared rate limiting

The current public deployment uses **Vercel Firewall**, not Redis. Set `RATE_LIMIT_PROVIDER=vercel` in Production and configure the `ai-generation` SDK rule shown in `docs/vercel-rate-limit-rule.json`. Publish the rule after reviewing it. It enforces a fixed window of 10 requests per 600 seconds per client IP per region. The application checks the managed rule before calling Gemini and fails closed when the rule is missing or unavailable. No additional database credentials are required for this Vercel deployment. Native rate-limit enforcement has been verified: 10 allowed, the 11th blocked.

For deployments using the alternative Redis adapter, leave `RATE_LIMIT_PROVIDER` unset and follow the steps below.

Create an Upstash Redis database in a suitable region. Obtain the **REST URL** and **REST token** from its console. This is request-counter storage, not a workspace database. Content is not stored there.

With the Redis adapter selected, production generation returns 503 without both Redis values. That adapter shares a 10-request/10-minute sliding window per hashed platform IP and blocks requests if Redis is unavailable. Users behind one shared IP share the allowance; consider that for assessor demonstrations. For an alternate host, review `src/lib/security.ts` and adapt trusted client-IP extraction first.

## 4. Import into Vercel

1. Sign in to Vercel and select **Add New → Project**.
2. Import the actual GitHub repository.
3. Use the **Next.js** preset, repository root, and Node **24.x** runtime.
4. Keep the standard build command `npm run build`; install with `npm ci` if overriding defaults.
5. Set these environment values for Production and, if wanted, Preview:

| Variable                   | Value                                                                     |
| -------------------------- | ------------------------------------------------------------------------- |
| `GEMINI_API_KEY`           | Your server-only Gemini secret                                            |
| `GEMINI_MODEL`             | `gemini-3.5-flash-lite`, or an account-accessible structured-output model |
| `RATE_LIMIT_PROVIDER`      | `vercel` for the existing managed `ai-generation` rule                    |
| `UPSTASH_REDIS_REST_URL`   | Optional: only for the alternative Redis adapter                          |
| `UPSTASH_REDIS_REST_TOKEN` | Optional: only for the alternative Redis adapter                          |

`REQUIRE_RATE_LIMIT` is optional for local verification; production always requires the limiter. No `NEXT_PUBLIC_` secrets are used. Route `maxDuration` is 60 seconds; ensure the selected Vercel plan supports it. Deploy, and wait for Vercel to report a successful Ready state. Environment changes require redeployment.

The redesign adds `/api/transcripts/step` and `/api/experiments`; both share the same validation, 65,000-byte request ceiling and managed allowance. `npm run build` prepares the version-matched PDF worker, fonts and character maps locally. No browser file is uploaded through a serverless function. Large jobs resume from browser IndexedDB while the page is open; they can span many quota windows. See [large transcript operations](LARGE-TRANSCRIPTS.md) before treating a 25-MiB file target as a completion-time promise.

## 5. Verify public access and live functionality

Open the actual Production URL in a signed-out/private browser. If Vercel asks for a Vercel login, inspect **Project Settings → Deployment Protection** and allow public access to the production domain for assessors. Do not make unrelated projects public.

- Load `/`, then navigate to all five tools, History, Settings and About.
- Generate an email using live Gemini, edit/copy/download, regenerate and transfer to Checkpoint.
- Summarize non-sensitive meeting notes with explicit owners; select actions and transfer to Planner.
- Generate a plan, edit/complete tasks, view the schedule, save, refresh and restore from History.
- Test general research and source-material analysis; verify evidence labels and no claim of live search.
- Review imported content, request an AI revision, compare versions, approve/reject/reopen, and restore a saved review.
- Check responsive navigation and keyboard operation.
- Check controlled failures for invalid input and quota; verify the limiter after the allowed request window using your own test deployment/account.
- Inspect browser requests/bundles to confirm no secret values are sent to the client. Do not share screenshots of secrets.

Record actual results in `docs/VERIFICATION.md`; do not mark live integration or deployment successful on the basis of fixture-based automated tests.

## 6. Submit

Add the real repository URL and real public live URL to README and GitHub's About section. Confirm with CAPACITI that Next.js/Vercel meets the platform requirement. Submit the two required links in Teams yourself; this project does not send messages or submissions automatically.

## Common failures

| Symptom                                    | Next action                                                                             |
| ------------------------------------------ | --------------------------------------------------------------------------------------- |
| AI is not configured                       | Set `GEMINI_API_KEY` server-side and restart/redeploy.                                  |
| Generation paused for protection           | Check the selected managed Firewall rule, or both Redis values when using that adapter. |
| Model unavailable or authorization failure | Check model spelling, account access, key restrictions, quota and billing.              |
| Rate limit reached                         | Wait for the 10-minute sliding window; shared networks share one allowance.             |
| Provider timeout or invalid JSON           | Retry with less input; check model compatibility and provider status.                   |
| Browser history unavailable                | Check storage permissions/quota; clear damaged content in Settings and use exports.     |
| Public site asks for sign-in               | Review production Deployment Protection for this project.                               |

Rollback by promoting a previously verified Vercel deployment through the project dashboard; do not overwrite repository history.
