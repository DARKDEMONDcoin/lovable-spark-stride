<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Platform keys use server-only `app_secrets` then runtime secrets; user credentials remain encrypted.
- Social outputs use `src/lib/post-format.ts` across site, queue, and Telegram.
- Cloud browsing uses `src/lib/cloud-browser.server.ts`; sensitive intents require owner approval.
- Supabase Function Secrets and runtime secrets are isolated write-only stores.
- Multi-step browsing lives in `src/lib/browser-agent.server.ts`; page content is untrusted and sensitive clicks stop for approval.
- Global destinations live in the AppShell primary navigation rail beside the unchanged employee inbox; employee-specific tools remain in chat, not a duplicate header menu. Why: separate platform navigation from employee conversations.
- The desktop AppShell sidebar collapses to an employee icon rail and persists its state locally; keep fixed chat overlays aligned to its width so the conversation stays usable.
- The primary rail expands independently and the chat topbar/composer must clear both rail and employee sidebar; hide the rail for embedded chat. Why: fixed controls must not overlap either navigation surface.
- `runEmployeeTurn` delegates out-of-specialty work via smartHandoff while keeping the conversation.
- Employee tools live in `employee-toolbelt.ts`; browser tasks stop before payment.
- Chat action commands use `chat-commands.ts`; edits use `reviseEmployeeAction`.
- All employee paths derive research depth, reasoning effort, risk, and success checks from `src/lib/turn-plan.ts`; this prevents conflicting execution decisions.
- Telegram buttons stay inside the chat: `telegram-ui*.server.ts` keep no `publicOrigin()` deep links, and manual platform credentials are collected in-chat via `src/lib/telegram-connect.server.ts` so no flow depends on the website.
- Brand data is optional per turn via `src/lib/brand-relevance.ts` (opt-out/opt-in from recent user messages); forcing the brand name into every post broke user intent.
- Chat messages persist their approval task and safe pending action directly; this keeps the correct employee action attached across refreshes and history.
- Semantic memory lives in `knowledge_chunks` (google/gemini-embedding-2, 3072 dims) via `src/lib/knowledge.server.ts`; never mix embedding models in that column.
- Public site origin comes from `src/lib/site-origin.ts`; do not hard-code other lovable.app hosts.
- Chat research requests run `runBrowserAgent` inside the turn and stream `browser`/`step` events to the chat; employees never redirect users to colleagues (routing is silent). Why: users need real results and live visibility, not hand-off ping-pong.
- Public signup CTAs enter optional `/welcome` before `/auth`; after sign-up, an account-bound session marker lets the first-run profile card analyze the draft website into that workspace once, without another onboarding or cross-account reuse.
- Pre-signup site previews read a few same-site pages (fetch → Jina → Browserbase → Tavily), then one rate-limited, per-host-cached AI pass builds the business profile. Why: deep understanding at bounded anonymous cost.
- Public website color swatches come only from the scanned site's declared theme and same-site stylesheet brand tokens, never generic CSS color frequency or invented defaults. Why: the introduction must not misrepresent the visitor's branding.
- Public pre-signup industry recommendations are short, rate-limited, validated AI suggestions grounded in a selected sector and optional public-site evidence; no account data or market metrics are implied. Why: visitors get useful next actions without confusing hypotheses with verified findings.
- Welcome purpose variants live in a browser-safe shared module used by every tour/recommendation path, avoiding business-only claims.
- The chat toolbelt derives capabilities from shared skill definitions so requests match each employee's skills.
- Each workspace has exactly one persistent conversation per employee across web and Telegram; this keeps history and unread state WhatsApp-like.
- Website context is controlled by one workspace-level switch that every employee execution path must honor.
- Chat voice dictation records in the browser and streams transcription through the authenticated `/api/transcribe` route into the draft (never auto-sends). Why: users review spoken text before it reaches an employee.
- Team workspace = real human members (invite-bound) sharing projects/tasks; tasks may also be assigned to one digital employee run via `collab-ai.functions.ts`, and activity is written only by DB triggers. Why: shared human+AI board without exposing owner-private data.
- Team spaces share employee chats: stream route verifies membership, runs turn via admin client; messages store sender. Why: shared human+AI threads.
- Invitees accept/decline in the AppShell NotificationBell (`invite-inbox.functions.ts`); inviters get a `user_notifications` row. Why: no reliance on copied links.
- Project spaces get a team block (members + sender) in employee turns; stream passes verified client+sender. Why: chats address the team.
