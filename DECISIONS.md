# DECISIONS.md

Locked-in choices, in plain English. Three sentences each: what we chose, what we
rejected, what it costs to undo. Backfilled on 2026-08-20 during the onboarding
sweep — these decisions were all made before the record existed, so the dates are
approximate and the reasoning is reconstructed from the code.

## Database — Supabase (Postgres)

We store everything — users, CVs, master records, generated documents, the AI
cost ledger — in Supabase Postgres, reached only through the service-role key in
`utils/database.js`. The alternative would have been a plain managed Postgres or
Firebase; Supabase gave us hosted auth-adjacent plumbing and a SQL console
without running a server. Undoing it is a week or so: the data is ordinary
Postgres and would move, but every read and write in the app goes through
Supabase's client library and the token operations are Postgres functions written
inside Supabase.

## Hosting — Netlify

The app is deployed on Netlify with the official Next.js plugin. Vercel is the
obvious alternative and would have removed a constraint we now design around;
Netlify was already in place. Undoing it is a day or two, but the cost is
structural rather than mechanical: Netlify caps ordinary functions at 10 seconds
on this plan, which is why analysis and generation are background functions that
the browser polls, and that whole shape exists to satisfy this host.

## AI — Google Gemini, through one file

Every AI call in the product goes to Gemini through `utils/openai.js` and nowhere
else, with the model for each task chosen by measured bake-offs. We rejected
OpenAI and Anthropic on cost: the work is high-volume prose generation and
Gemini's flash tier does it at a fraction of the price. Undoing it is small in
principle — one file to rewrite — but every prompt in `prompts/` was tuned and
measured against these models, so the real cost is re-running that measurement.

## Sessions and rate limiting — Upstash Redis

Signed-in sessions, the double-submission lock and the per-user rate limits use
Upstash Redis over its REST API. We rejected an in-process cache because Netlify
functions do not share memory. It carries a known scar: Upstash is not reachable
from the Next server runtime, so anything that must work there (generation
status, the daily spend total) reads Postgres instead — undoing Redis entirely
would mean moving the remaining locks and limits to Postgres, roughly a day.

## Payments — Stripe

Tokens are sold through Stripe Checkout in euros, and the free download is
unlocked by a card-on-file setup that takes no money. There was no serious
alternative for an EU consumer product. Undoing it would mean rebuilding
checkout, the webhook and the card-verification flow — a week, and customers
with saved cards would have to re-enter them.

## Error monitoring — Sentry

Errors from the browser, the server, the edge middleware and the background
function all go to Sentry. We rejected log-scraping on Netlify because
background-function failures are invisible there. Undoing it is an afternoon:
remove four config files and one build wrapper.

## Email — Gmail SMTP, not Resend

Magic-link emails are sent with nodemailer over Gmail SMTP from a hardcoded
personal address, even though Resend is installed and configured. This was not
chosen so much as left: Resend was wired in and then reverted. It is on the risk
register (R2) and costs about an hour to undo, because the Resend path already
exists in the project's history.

## No spend cap on AI (2026-08-16, owner decision)

Every Gemini call is metered and recorded, but nothing blocks a call for being
expensive. We rejected the daily budget ceiling we previously had because it
blocked real work, including the measurement runs the project requires before any
prompt or model change. Undoing it is an hour, and it must be an explicit owner
order — the metering, which is what made the one bad spend day impossible to
repeat, stays either way.
