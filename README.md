# pelta.ai

An AI governance dashboard for mapping, measuring, and managing risk across third-party AI tools. Built on the NIST AI RMF framework (Govern, Map, Measure, Manage).

## Features

**Tool Risk Classification** — Submit an AI tool name and its intended use case. The system runs an LLM-powered classification that returns a risk tier (Low/Medium/High), NIST function mapping, applicable data categories, a plain-English justification, and a recommended access policy. Results feed into a searchable registry with sort, filter, and export.

**Prompt Guard Proxy** — A simulated proxy that scans outgoing prompts for PII, financial data, and credential leakage using regex + LLM hybrid detection. Emails, phone numbers, API keys, and payment card patterns are intercepted in real time and assigned an allow/flag/block verdict.

**Access Requests** — Employees submit requests for new tools or redress appeals. Admins approve or deny with mandatory comments, captured in a persistent audit trail.

**Dashboard** — Charts and tables covering verdicts, risk distribution, NIST function coverage, detection method split, verdict trends, department breakdowns, and a collapsible registry view.

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 |
| Charts | Recharts |
| Animations | Framer Motion |
| Forms | React Hook Form + Zod |
| LLM | Google Gemini (via `@google/generative-ai`) |
| Persistence | JSON file store (`data/`) |
| Icons | Lucide |

## Getting Started

```bash
npm install
```

Copy the environment template and add your Gemini API key:

```bash
# .env.local
LLM_API_KEY=your_gemini_api_key
```

Without an API key, the classify endpoint returns a deterministic fallback so the app remains fully functional.

```bash
npm run dev
```

Open `http://localhost:3000`.

Seed data ships with the repo. Run the seed endpoint once to populate detection logs, access requests, and tool entries:

```bash
curl http://localhost:3000/api/seed
```

## Pages

| Route | Purpose |
|-------|---------|
| `/` | Landing page with role switcher and navigation |
| `/admin/dashboard` | Charts, stats, registry preview, recent detections |
| `/admin/tools/new` | Classify a tool + view/edit the registry |
| `/admin/requests` | Approve/deny appeals and tool requests with audit log |
| `/admin/logs` | Full detection log with filters and export |
| `/employee/requests/new` | Submit a new tool request |
| `/employee/redress` | File a redress appeal (EU AI Act Article 86) |

## API Routes

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/tools` | GET/PATCH/DELETE | Registry CRUD |
| `/api/tools/classify` | POST | Runs LLM classification on a tool |
| `/api/requests` | GET/PATCH | Tool access requests |
| `/api/access-requests` | GET/PATCH | Redress appeals |
| `/api/guard/check` | POST | Scans a prompt for PII/credentials |
| `/api/guard/suggest` | POST | Returns safe alternatives for flagged prompts |
| `/api/logs` | GET | Detection log stream |
| `/api/audit-log` | GET | Admin approval/rejection trail |
| `/api/seed` | GET | Populates sample data |

## Project Structure

```
app/
  admin/         — dashboard, classify, requests, logs
  api/           — route handlers
  employee/      — tool request, redress
components/      — Sidebar, RadarIcon, ApprovalsNavLink
data/            — JSON file store (tools, logs, requests)
lib/             — gemini client, regex patterns, NIST retrieval, seed data
hooks/           — shared React hooks
extension/       — browser extension for proxy detection
```

## Notes

No authentication — this is a demo/hackathon build. The file store at `data/` replaces a database. Both light and dark themes are available.

The landing page intro text refers to Gemini but the platform is LLM-agnostic. Swap `lib/gemini.ts` with another provider and update the env key to switch backends.
