# peris.ai

A hybrid AI governance platform that sits between employees and external AI tools. Two real, LLM-powered features: risk classification for new AI tools (calls Gemini to produce a structured risk profile), and a prompt guard that scans outbound text for sensitive data using regex rules escalated to Gemini for ambiguous cases. Built for a hackathon, aligned to NIST AI RMF framework and EU AI Act transparency requirements.

## Core components

**Tool Risk Classification** (`/admin/tools/new`, `POST /api/tools/classify`, `lib/gemini.ts`). Admin submits a tool name + short description. The API route sends a structured JSON-only prompt to Gemini 2.0 Flash, which returns a risk tier (Low/Medium/High), implicated NIST RMF functions, likely data categories, a plain-English justification, and a recommended access policy. The result is stored in `data/tools.json` and immediately visible in the dashboard and registry table. If `GEMINI_API_KEY` is not set, the route falls back to hardcoded mock responses so the UI is still usable in a demo without internet access.

**Prompt Guard** (`/employee/prompt-guard`, `POST /api/guard/check`, `lib/regexPatterns.ts`). Employee pastes text into a split-pane interface. On submit, a regex pass runs against 10 patterns (email, credit card, API key, SSN, passport, phone, IP, bank routing, JWT, date of birth). If no high-severity pattern matches but the text looks suspicious (keywords like "confidential", "salary", "internal"), the system escalates to Gemini for classification. The result is a verdict (allow/flag/block), risk level, highlighted sensitive spans, and a detection-method label. Every scan is logged to `data/logs.json`.

**Dashboard** (`/admin/dashboard`). Seven stat cards and seven charts built with recharts: verdict counts (bar), risk distribution (donut), data categories (donut), detection method split, NIST RMF coverage by approved tools (horizontal bar), verdict trend over 7 days (line), and requests by department (bar). Below the charts: a sortable tool registry table and a capped prompt-guard log table with a "view all" toggle. All data comes from the three JSON files — no separate API calls beyond the initial fetch.

**Approval workflow** (`/admin/requests`, `PATCH /api/requests`). Mocked. A list of employee tool requests with Approve/Deny buttons that update the JSON file optimistically. No notifications, no email, no multi-step flow. The department field and timestamps are real; the logic is not.

**Redress page** (`/employee/redress`). A static example page showing what an employee would see if an AI-assisted decision affected them. Hardcoded content built around the EU AI Act Article 86 right-to-explanation concept. There is no backend — the entire page is a thin presentation layer.

## Data model

Three JSON files under `data/`, read and written by `lib/fileStore.ts`.

**data/tools.json**
```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  "status": "pending | approved | blocked",
  "riskTier": "Low | Medium | High | null",
  "nistFunctions": ["Govern", "Map", "Measure", "Manage"],
  "dataCategories": ["PII", "Financial", "Source Code", "None"],
  "justification": "string",
  "recommendedPolicy": "string",
  "createdAt": "ISO date"
}
```

**data/logs.json**
```json
{
  "id": "uuid",
  "promptSnippet": "string (truncated)",
  "verdict": "allow | flag | block",
  "riskLevel": "none | low | medium | high",
  "reason": "string",
  "detectionMethod": "regex | llm",
  "dataCategory": "string",
  "timestamp": "ISO date"
}
```

**data/requests.json**
```json
{
  "id": "uuid",
  "employeeName": "string",
  "department": "string",
  "toolRequested": "string",
  "status": "pending | approved | denied",
  "requestedAt": "ISO date",
  "decidedAt": "ISO date | null"
}
```

## Setup

Requires Node.js 20+ and npm.

```sh
npm install
```

Create `.env.local` in the project root with a Gemini API key (optional — without it the app uses mock responses):

```
GEMINI_API_KEY=your_key_here
```

Run the dev server:

```sh
npm run dev
```

Seed data is loaded automatically on first startup. To reset all data to its original state during a demo, click the "Reset" button in the header (visible on every page). This hits `POST /api/seed` which rewrites all three JSON files from the hardcoded seed in `lib/seedData.ts`.

## Project structure

```
app/
  page.tsx                         → landing / role picker
  employee/prompt-guard/page.tsx   → prompt scanning interface
  employee/redress/page.tsx        → static explainability example
  admin/dashboard/page.tsx         → charts, tables, metrics
  admin/tools/new/page.tsx         → tool classification form + registry
  admin/requests/page.tsx          → mocked approval workflow
  api/
    tools/classify/route.ts        → Gemini-powered classification
    guard/check/route.ts           → regex + Gemini hybrid scan
    tools/route.ts                 → tools.json read
    logs/route.ts                  → logs.json read
    requests/route.ts              → requests.json read + patch
    seed/route.ts                  → reseed all data from seed file
lib/
  gemini.ts                        → Gemini API wrapper (classify + prompt risk)
  regexPatterns.ts                 → 10 PII/secret patterns, keyword list
  fileStore.ts                     → JSON read/write helpers
  seedData.ts                      → original seed data (10 tools, 16 logs, 8 requests)
components/
  ThemeToggle.tsx                  → dark/light mode with localStorage
  RadarIcon.tsx                    → radar scan SVG icon
  SeedButton.tsx                   → reseed trigger
data/
  tools.json                       → AI tool registry
  logs.json                        → prompt guard event log
  requests.json                    → approval workflow records
```

## Known limitations

- No authentication. There is a role switcher in the UI (Employee/Admin toggle), but no login flow, session management, or authorization enforcement.
- No persistent database. All data is stored in flat JSON files under `data/`. Restarting the server preserves files, but there is no migration, concurrency handling, or backup.
- The approval workflow is mocked. Approve/Deny buttons update the JSON file, but there is no notification system, escalation path, or multi-step review process.
- The redress page is a static hardcoded example. It demonstrates the concept of explainability (EU AI Act Article 86) but is not backed by any real workflow or data lookup.
- Charts in the dashboard are pre-seeded with 16 historical log events and 10 tools. New scans and classifications add to these, but the historical seed is re-added on reset.
- The Gemini API key is optional. Without it, classification and prompt risk detection fall back to mock responses that return realistic but fabricated data.
