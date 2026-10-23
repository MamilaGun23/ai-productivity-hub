# Verified public deployment

**Submission URL:** https://ai-productivity-hub-tshifhiwa11austin-4119.vercel.app

Markers can open the application without registration, a Vercel login, an API key, Node.js or local setup.

## Deployment

- Project: `ai-productivity-hub`, account/team `tshifhiwa11austin-4119`.
- Deployment ID: `dpl_BhKtw4BUc46wq9awX4pag4RF6EEk`, confirmed **READY** on 23 October 2026.
- Deployment URL: https://ai-productivity-pevl9xig3-tshifhiwa11austin-4119.vercel.app
- Framework: Next.js, Node 24; Vercel-reported build duration: 48 seconds.
- Used authorized Vercel CLI 65.2.0 because the installed integration did not expose service tools in this session.
- Project hosting sign-in protection is disabled. Public checks used ordinary HTTP and a fresh browser context, with no authentication or protection bypass.
- Gemini key is a server-only Production Secret. Model and limiter selection are Config values. Environment files are excluded from source uploads and Git.

## Verified results

| Check                                                  | Result                                                             | Evidence                                |
| ------------------------------------------------------ | ------------------------------------------------------------------ | --------------------------------------- |
| Nine public pages                                      | All HTTP 200 without authentication                                | `production-browser-results.json`       |
| All five AI modules, both research modes and revision  | Seven genuine Gemini checks passed full response validation        | `production-ai-results.json`            |
| Browser → live email API → editing → copy → Checkpoint | Passed after rate-limit enforcement                                | `production-browser-results.json`       |
| Managed limiter                                        | 10 requests allowed; the 11th blocked                              | `production-rate-limit-results.json`    |
| Accessibility and responsive layout                    | 15 states, zero axe violations, no page errors or checked overflow | `production-accessibility-results.json` |
| Secret exposure                                        | Exact key absent from 14 fetched client script assets              | `production-browser-results.json`       |
| Regression tests                                       | 48 Vitest and 8 Playwright tests passed                            | Recorded command outcomes               |
| TypeScript, ESLint and builds                          | Passed locally; hosted build READY                                 | Recorded command outcomes               |
| Production dependency audit                            | Zero vulnerabilities                                               | `npm audit --omit=dev`                  |
| Recent runtime error scan                              | Zero matching records in the supported 5-minute window             | `production-log-scan.json`              |

## Managed protection

Production uses `@vercel/firewall` with `RATE_LIMIT_PROVIDER=vercel` and SDK rule `ai-generation`. Its fixed window permits 10 requests per 600 seconds per client IP per region, shared across all tools. Shared networks share an allowance; counters are regional, not a worldwide quota guarantee.

The rule was first published in log mode for functional checks, then reviewed and switched to enforcement. A separate verification bucket tested the threshold without consuming Gemini quota or exhausting the marker's bucket. The application fails closed if the rule is missing or unavailable. Its definition is `vercel-rate-limit-rule.json`.

Upstash is an optional alternative backend. No Upstash account is required for this public deployment.

## Source and remaining actions

Source, lockfile, tests, README, screenshots, ignore rules and CI are prepared. Git is now available at `C:/Program Files/Git/cmd/git.exe`, although it is not on this shell's PATH. A local repository was initialized on `main`; all 71 staged files passed checks for excluded environment/build files and the actual Gemini credential, with zero matches. GitHub remote publication is separate and no remote URL has been fabricated.

Five development lint-toolchain audit entries remain documented in `VERIFICATION.md`; production dependencies are clean. Automated accessibility checks are not a formal WCAG certification. CAPACITI's acceptance of Next.js/Vercel in place of Lovable still needs separate confirmation. No Teams submission has been sent automatically.

This report supersedes the earlier local-only and account-connection status notes.
