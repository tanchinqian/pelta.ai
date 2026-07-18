# agent.md — AI Governance Platform (Hackathon Build)

## Project Name (working title)
**pelta.ai** — a hybrid AI governance platform combining a real-time prompt-risk proxy with an admin dashboard for AI tool approval, usage tracking, and risk classification.

## Case Study Alignment
Case Study 3: AI Governance — Responsible AI in Enterprise. This build directly answers:
- **Challenge 1** (Employee Compliance): frictionless approval workflow, not an outright ban.
- **Challenge 2** (Data Privacy & Security): hybrid regex + LLM detection before data leaves the org.
- **Challenge 3** (Transparency): every logged event and tool decision is explainable and auditable.

Framed around NIST AI RMF functions (**Govern, Map, Measure, Manage**) — reference this explicitly in UI copy and the proposal, since the case study calls it out directly.

---

## Time Budget: 1–2 Days
Build order below is priority-sequenced — if time runs short, cut from the bottom up, not the top.

---

## Tech Stack
- **Framework**: Next.js (App Router), React, TypeScript
- **Styling**: Tailwind CSS
- **Backend**: Next.js API routes (no separate server)
- **Data persistence**: JSON file on disk (`/data/*.json`), read/written via simple fs helpers. No real DB — resets on restart, which is fine for a demo.
- **LLM**: LLM API (Messages endpoint), called server-side only from API routes (never expose the key client-side).
- **Auth**: none. Single implicit demo user. A role switcher (Employee / Admin toggle) in the UI is enough — no login flow.

---

## The Two Core Features

### 1. 🌟 KILLER FEATURE (real, LLM-powered): AI Tool Risk Classification
**What it does**: Admin submits a new AI tool (name + short description of what it's used for, e.g. "Grammarly for customer emails"). The system calls LLM to classify it and returns a structured risk profile:
- Risk tier: Low / Medium / High
- Which NIST RMF function(s) it implicates (Govern/Map/Measure/Manage)
- What data categories it's likely to touch (PII, financial, source code, none)
- A one-paragraph plain-English justification
- A recommended access policy (e.g. "Allow for non-sensitive drafting only, block file upload")

This is the centerpiece of the live demo — type in a real, unfamiliar tool name live in front of judges and get a genuine classification back.

**Implementation**: one API route `POST /api/tools/classify` that sends a structured prompt to LLM, requesting **JSON-only output** (see structured output pattern), then renders it as a risk card in the UI. Store the result in the tool registry JSON file so it shows up in the dashboard immediately after.

### 2. Real (hybrid) Prompt Guard: Sensitive Data Detection
**What it does**: Simulates the "proxy" — a text box where an employee pastes a prompt before sending it to an AI tool. On submit:
1. **Regex first pass** (fast, deterministic): flags emails, phone numbers, credit card patterns, API key-looking strings, IC/passport number patterns.
2. **If regex is inconclusive** (e.g. no hard pattern match but text looks like it might contain confidential business info — long text, mentions "confidential," "salary," "internal," names, financials), escalate to LLM for a judgment call: "Does this text likely contain sensitive company or personal data? Classify: none / low / medium / high, and say why in one sentence."
3. Result renders as a redaction preview: sensitive spans highlighted, an allow/block/flag verdict, and the reason. Log the event to the usage log JSON file.

This is your second real feature — genuinely functional, not mocked, but simpler logic so it's fast to build.

---

## Mocked / Simulated Pieces (do NOT over-invest time here)
- **Approval workflow**: static list of pending requests with Approve/Deny buttons that just update local state + JSON file. No real notification system, no email.
- **Usage dashboard charts**: can be seeded with a mix of real logged events (from the Prompt Guard) plus a handful of pre-seeded fake historical events, so the chart doesn't look empty on first load. Use a simple bar/line chart (recharts).
- **"Redress" / explainability trail** (Challenge 3 nod): a single static example page showing what an end-user would see if an AI-assisted decision affected them — this can be hardcoded content, not a real flow. Include it mainly so the proposal/pitch can point to it as "here's how Challenge 3 is addressed," without spending real build time.

---

## Data Model (JSON files under `/data`)

**`tools.json`** — AI tool registry
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "status": "pending | approved | blocked",
  "riskTier": "Low | Medium | High | null",
  "nistFunctions": ["Govern","Map","Measure","Manage"],
  "dataCategories": ["PII","Financial","Source Code","None"],
  "justification": "string",
  "recommendedPolicy": "string",
  "createdAt": "ISO date"
}
```

**`logs.json`** — Prompt Guard events
```json
{
  "id": "uuid",
  "promptSnippet": "string (truncated)",
  "verdict": "allow | flag | block",
  "riskLevel": "none | low | medium | high",
  "reason": "string",
  "detectionMethod": "regex | llm",
  "timestamp": "ISO date"
}
```

**`requests.json`** — Approval workflow (mocked)
```json
{
  "id": "uuid",
  "employeeName": "string",
  "toolRequested": "string",
  "status": "pending | approved | denied",
  "requestedAt": "ISO date"
}
```

---

## Folder Structure
```
/app
  /page.tsx                     → landing / role picker (Employee vs Admin)
  /employee/prompt-guard/page.tsx  → Feature 2 UI
  /employee/redress/page.tsx    → mocked explainability example
  /admin/dashboard/page.tsx     → usage charts + tool registry table
  /admin/tools/new/page.tsx     → Feature 1 UI (submit + classify a tool)
  /admin/requests/page.tsx      → mocked approval workflow
  /api/tools/classify/route.ts  → real Claude call
  /api/guard/check/route.ts     → regex + Claude hybrid check
  /api/tools/route.ts           → CRUD for tools.json
  /api/logs/route.ts            → CRUD for logs.json
  /api/requests/route.ts        → CRUD for requests.json
/lib
  /claude.ts                    → Claude API wrapper
  /regexPatterns.ts             → PII/secret detection patterns
  /fileStore.ts                 → read/write JSON helpers
/data
  tools.json, logs.json, requests.json (seed with a few example rows)
```

---

## Build Sequence (priority order)

**Phase 1 — Skeleton (2–3 hrs)**
1. Scaffold Next.js + Tailwind project.
2. Build `fileStore.ts` (read/write JSON safely, create files if missing).
3. Seed `/data` with a few example tools, logs, and requests so the UI isn't empty on first run.
4. Build role-picker landing page + basic nav shell (Employee / Admin).

**Phase 2 — Killer Feature: Tool Risk Classification (3–4 hrs)**
5. Build `lib/claude.ts` wrapper — server-side only, structured JSON-only prompt.
6. Build `/api/tools/classify` route.
7. Build `/admin/tools/new` UI: form → submit → loading state → risk card result.
8. On success, persist to `tools.json` and show it in the registry table.

**Phase 3 — Prompt Guard (2–3 hrs)**
9. Build `regexPatterns.ts` with common PII/secret patterns.
10. Build `/api/guard/check`: regex pass → if inconclusive, call Claude for judgment.
11. Build `/employee/prompt-guard` UI: textarea → submit → highlighted verdict card.
12. Log every check to `logs.json`.

**Phase 4 — Dashboard (2 hrs)**
13. Build `/admin/dashboard`: pull from `tools.json` + `logs.json`, render:
    - Tool registry table (status, risk tier)
    - Usage log table/timeline
    - A simple chart (recharts) — e.g. verdicts over time or risk distribution

**Phase 5 — Polish for judging (2–3 hrs)**
14. Mocked approval workflow (`/admin/requests`) — simple approve/deny buttons.
15. Static redress example page — for Challenge 3 talking point.
16. Visual pass: consistent color system for risk tiers (Low=green, Medium=amber, High=red), clean typography, no default-looking UI.
17. Prepare demo script: submit a real unfamiliar tool live, then paste a fake-sensitive prompt live. These two moments are your live-demo centerpiece — rehearse them.

---

## Visual Verification (Playwright MCP)
This project has the Playwright MCP server configured (see `opencode.json`). For ANY task that changes layout, styling, colors, spacing, animations, or visual structure of a page:
- After making the change, use Playwright to navigate to every affected page on `localhost:3000` (assume the dev server is already running unless told otherwise) and take a screenshot to visually verify the result.
- Check specifically for: dead/empty space, overlapping or clipped elements, broken responsive behavior, leftover debug artifacts (stray characters, unstyled defaults), and whether the change actually matches what was asked for.
- If something looks wrong in your own screenshot, fix it and re-check before reporting the task as done.
- Always show the screenshot alongside your summary of what changed — don't just describe the result in text.
- This applies by default without needing to be asked each time. Skip it only for changes with no visual impact (e.g. pure backend/API logic, data model changes with no UI change).


---

## Notes for the Coding Agent
- Keep API responses to Claude **strictly JSON** — instruct the model explicitly to return only JSON, no markdown fences, no preamble. Parse defensively (strip fences if present) since models occasionally add them anyway.
- Don't build real auth, real DB, or real notification/email systems — time is better spent on visual polish and demo reliability than infrastructure that isn't being judged.
- Every mocked feature should still be **visually complete** — judges score Design/UI-UX regardless of whether the logic behind it is real.
- Reference NIST AI RMF (Govern/Map/Measure/Manage) and EU AI Act explicitly in on-screen copy — this signals to judges that the framework research (mentioned in the case study) was actually applied, not just the tech.
- If time is very short, cut in this order: redress page → mocked approval workflow → dashboard chart polish. Never cut the two real features — they're what makes the demo credible.

## Design Decision: NIST AI RMF Retrieval Grounding

Tool Risk Classification does not rely on the LLM's general knowledge of the NIST AI RMF. Instead, it uses a lightweight, static retrieval layer:

- `data/nist_ai_rmf_playbook.json` is the single source of truth (curated NIST AI RMF playbook content).
- `scripts/build-nist-functions.js` derives `data/nist_ai_rmf_functions.json` into a queryable shape: `{ function, definition, concerns, keywords }`.
- `lib/nistRetrieval.ts` performs case-insensitive keyword matching against the tool name + description, returns the top 1–3 most relevant functions, and falls back to all four short definitions if no strong match is found.
- The retrieved context is injected into the live LLM classification prompt, so the model's NIST function selection is grounded in the actual reference file rather than its training data.
- The Classify result card exposes an expandable "Grounded in NIST AI RMF" section with a citation, making the retrieval step visible to judges.

This is a deliberate hackathon-scoped tradeoff: keyword retrieval is fast, fully offline, and easy to inspect and demo. A natural next step is replacing it with a vector-embedding retriever over the same curated playbook.
