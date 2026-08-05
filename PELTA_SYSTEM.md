# pelta.ai — System Overview

AI Governance platform for mapping, measuring, and managing risk across third-party AI tools. Built on the NIST AI RMF framework (Govern, Map, Measure, Manage). Deployed at https://peltaai-production.up.railway.app.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Styling | Tailwind CSS v4 with zinc color palette + `dark:` variants |
| Charts | Recharts |
| Animations | Framer Motion (all pages use staggered fade-up `opacity:0→1, y:10→0`, 0.2–0.6s duration) |
| LLM | Google Gemini (`@google/generative-ai`) — used for tool classification and prompt risk assessment |
| PDF parsing | pdfjs-dist v6 (Uint8Array input, not Buffer) |
| Persistence | JSON file store (`data/*.json`) via `lib/fileStore.ts` — mounted as persistent volume on Railway at `/app/data` |
| Icons | Lucide React |
| Forms | React Hook Form + Zod |
| Notifications | Sonner (toast) |
| Extension | Chrome Manifest V3 — injects into ChatGPT, Gemini, Claude, DeepSeek, Copilot |

---

## Architecture

```
Browser Extension (content-script.js)
  │
  ├─ POST /api/guard/check     ← prompt scanning (regex + LLM)
  ├─ POST /api/guard/ocr       ← image OCR via Gemini Vision
  ├─ POST /api/guard/pdf-extract ← PDF text extraction
  ├─ POST /api/access-requests ← submit appeal / request exception
  └─ GET  /api/access-requests ← poll for admin decision

Web App (Next.js App Router)
  │
  ├─ /api/tools          GET/PATCH/DELETE  ← tool registry CRUD
  ├─ /api/tools/classify POST              ← LLM risk classification
  ├─ /api/requests       GET/PATCH         ← employee tool requests
  ├─ /api/access-requests GET/POST/PATCH   ← redress appeals + extension bypass requests
  ├─ /api/audit-log      GET               ← admin approval/rejection trail
  ├─ /api/logs           GET               ← detection log stream
  ├─ /api/seed           POST              ← reset all data to seed state
  ├─ /api/dlp-rules      GET/POST          ← custom regex rules CRUD
  └─ /api/dlp-rules/[id] PATCH/DELETE      ← toggle/delete individual DLP rule
```

---

## Design System

### Color tokens (defined in `app/globals.css`)

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--bg` | `#0d0d0c` | `#f5f4ef` | Page background |
| `--surface` | `#141413` | `#ffffff` | Panel/card background |
| `--border` | `#242422` | `#e6e4de` | Panel borders |
| `--text-primary` | `#f3f3f0` | `#1f1e1c` | Headings, body text |
| `--text-secondary` | `#96958f` | `#66645e` | Secondary text |
| `--text-tertiary` | `#64635e` | `#94918a` | Muted/label text |
| `--accent` | `#bf9143` | `#9c742c` | Gold accent (buttons, icons, badges) |
| `--risk-low` | `#10b981` | `#059669` | Green (approved, allow) |
| `--risk-medium` | `#d97706` | `#b45309` | Amber (pending, flag) |
| `--risk-high` | `#e11d48` | `#be123c` | Red (blocked, denied) |
| `--data-pii` | `#818cf8` | — | Indigo (PII) |
| `--data-financial` | `#c084fc` | — | Violet (Financial) |
| `--data-source-code` | `#22d3ee` | — | Cyan (Source Code) |
| `--nist-govern` | `#3b82f6` | — | Blue |
| `--nist-map` | `#06b6d4` | — | Teal |
| `--nist-measure` | `#22c55e` | — | Green |
| `--nist-manage` | `#8b5cf6` | — | Purple |

### Zinc palette (used on most admin/employee pages)
Standard Tailwind zinc scale: `zinc-50` through `zinc-950` with `dark:` variants.
- Panels: `bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-sm rounded-lg`
- Inputs: `bg-zinc-50 dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 rounded-lg`
- Table headers: `bg-zinc-100 dark:bg-zinc-800`
- Text: `text-zinc-900 dark:text-zinc-100` (primary), `text-zinc-600 dark:text-zinc-300` (secondary), `text-zinc-500 dark:text-zinc-400` (tertiary)

### Shared Components

| Component | File | Description |
|-----------|------|-------------|
| `RiskBadge` | `components/Badge.tsx` | Risk tier badge (Low/Medium/High) |
| `StatusBadge` | `components/Badge.tsx` | Governance status (approved/pending/blocked/denied) |
| `VerdictBadge` | `components/Badge.tsx` | Guard verdict (allow/flag/block) |
| `DataCategoryBadge` | `components/Badge.tsx` | Data category tag (PII/Financial/Source Code) |
| `Sidebar` | `components/Sidebar.tsx` | Global navigation (Employee: Workspace, Request Tool, Redress | Admin: Dashboard, Classify, Tools, DLP Rules, Requests, Logs) |
| `SeedButton` | `components/SeedButton.tsx` | Resets all data to seed state (POST /api/seed + reload) |
| `RadarIcon` | `components/RadarIcon.tsx` | Brand radar icon (SVG component) |

### Key CSS
- `.panel` class provides `background: var(--surface)`, border, `border-radius: 0.5rem`, `box-shadow: var(--shadow-sm)`. Used on Dashboard, Tools, and Redress pages.
- Theme toggle in sidebar: stores `pelta-theme` in localStorage, toggles `.dark` class on `<html>`, sets `data-theme` attribute.
- Dark mode via `@custom-variant dark (&:where(.dark, .dark *))`

---

## File Structure

```
app/
  globals.css              ← design tokens, panel classes, theme
  layout.tsx               ← root layout (sidebar + page router)
  page.tsx                 ← landing page (hero, NIST section, role toggle)
  
  admin/
    dashboard/page.tsx       ← charts (verdicts, risk, NIST, dept), tool registry, recent detections, governance impact
    tools/new/page.tsx       ← Classify page: form + LLM classification + registry table
    tools/page.tsx           ← Tool Registry: searchable table + detail slide-over with edit mode
    requests/page.tsx        ← Access Requests: Redress Appeals + Tool Requests tabs, inline approve/deny, audit trail
    logs/page.tsx            ← Detection Logs: filterable table with expanded detail
    dlp-rules/page.tsx       ← Custom DLP Rules: add/toggle/delete custom regex patterns

  employee/
    page.tsx                 ← Employee Workspace: stats, recent requests, approved tools
    requests/new/page.tsx    ← Request Tool: submit new AI tool request form + history
    redress/page.tsx         ← Redress: flagged event list, timeline, appeal submission, safe prompt suggestions

  api/
    guard/check/route.ts     ← Prompt scanning (regex + custom DLP + optional LLM escalation)
    guard/ocr/route.ts       ← Image OCR via Gemini Vision
    guard/pdf-extract/route.ts ← PDF text extraction via pdfjs-dist v6
    guard/suggest/route.ts   ← Generate safe prompt alternatives
    tools/route.ts           ← Tool registry GET/PATCH/DELETE
    tools/classify/route.ts  ← LLM classification (returns risk tier, NIST functions, data categories, justification)
    requests/route.ts        ← Employee tool requests
    access-requests/route.ts ← Redress appeals + extension bypass requests
    audit-log/route.ts       ← Admin approval/rejection audit trail
    logs/route.ts            ← Detection log stream
    seed/route.ts            ← Reset all data to seed state
    dlp-rules/route.ts       ← Custom DLP rules CRUD
    dlp-rules/[id]/route.ts  ← Toggle/delete individual DLP rule

components/
  Badge.tsx          ← Shared risk/status/verdict badges
  Sidebar.tsx        ← Global navigation + theme toggle
  SeedButton.tsx     ← Reset seed data button
  RadarIcon.tsx      ← Brand icon
  ApprovalsNavLink.tsx ← Navigation link for approvals

lib/
  fileStore.ts       ← JSON file read/write/update/delete (data/*.json)
  regexPatterns.ts   ← Built-in prompt scanning patterns (email, SSN, API keys, jailbreaks, etc.)
  gemini.ts          ← Gemini LLM client (tool classification + prompt risk assessment)
  nistRetrieval.ts   ← NIST AI RMF keyword retrieval for grounded classification context
  highlightUtils.tsx ← Prompt text highlighting for detected patterns
  seedData.ts        ← Seed data factory (tools, logs, requests, appeals, audit entries)
  constants.ts       ← Shared constants (DEMO_EMPLOYEE = 'Alice Chen')

data/                 ← JSON file store (persistent volume on Railway)
  tools.json          ← Tool registry records
  logs.json           ← Detection log entries
  requests.json       ← Employee tool requests
  access-requests.json ← Redress appeals + extension bypass requests
  audit-log.json      ← Admin approval/rejection trail
  dlp-rules.json      ← Custom DLP regex rules

extension/
  manifest.json       ← Chrome MV3 manifest
  background.js       ← Service worker (proxies prompt checks to API)
  content-script.js   ← Injected into AI tool pages (ChatGPT, Gemini, Claude, DeepSeek, Copilot)
  overlay.css         ← Guard verdict overlay styles
  popup.html/js       ← Toolbar popup
  options.html/js     ← API base URL toggle (localhost ↔ production)
  tesseract.esm.min.js ← Fallback OCR engine

scripts/              ← Utility scripts (PDF extraction, docx generation)
tmp/                  ← Temporary/test artifacts
screenshots/          ← Audit and debug screenshots
```

---

## Core Feature Details

### Prompt Guard Proxy (Extension)

The browser extension intercepts prompts before they're sent to AI tools (ChatGPT, Gemini, Claude, DeepSeek, Copilot). Flow:

1. User types prompt + presses Enter/clicks Send
2. Content script captures the text, pauses the native send
3. Sends prompt to `/api/guard/check` via background.js service worker
4. API runs: built-in regex scan → custom DLP rules scan → optional LLM escalation
5. Returns verdict + highlights + redacted alternative
6. Extension overlays result on the AI tool page:
   - **Allow** → prompt sends normally
   - **Flag** → overlay with "Confirm Anonymized & Send" (auto-redacted version) or "Request Admin Approval" (creates access request, polls for admin decision)
   - **Block** → overlay with "Confirm Anonymized & Type" (redacted, no send) or "Report False Positive" (polls for admin decision)

The extension supports OCR (paste image → Gemini Vision extracts text → scanned) and PDF (paste file → pdfjs-dist extracts text → scanned).

### Tool Risk Classification

Admin submits an AI tool name + intended use case → Gemini LLM classifies it:
- **Risk tier** (Low/Medium/High)
- **NIST functions** implicated (Govern, Map, Measure, Manage)
- **Data categories** exposed (PII, Financial, Source Code)
- **Justification** (plain-English reasoning)
- **Recommended access policy**
- **NIST RMF grounded context** (matched functions, definitions, concerns from keyword retrieval)

Results feed into the registry table, dashboard charts, and tool flyout panels.

### Custom DLP Rules Engine

Admins can create custom regex patterns that the Prompt Guard checks against every submitted prompt. This extends protection beyond the built-in pattern library (email, SSN, API keys, etc.) to organization-specific terms.

- Create rule: name + regex pattern + severity (high/medium/low) + category
- Live tester: paste sample text to see if your regex matches before saving
- Toggle: enable/disable rules without deleting
- Integration: `/api/guard/check` loads all enabled DLP rules and merges hits with built-in patterns

### Access Requests (Approve/Deny Flow)

Two request types managed on the unified `/admin/requests` page:
1. **Redress Appeals** — employee disputes a flag/block verdict (EU AI Act Article 86)
2. **Tool Requests** — employee requests access to a new AI tool

Admins can approve/deny inline or via modal. Deny requires a reason. Approving a tool request triggers automatic LLM classification and tool registry entry. Both create audit log entries.

### Data Freshness

- Employee pages listen for `pelta:refetch-requests` custom event (dispatched by admin pages on status changes)
- Employee pages use `{ cache: 'no-store' }` on all fetch calls to prevent stale Next.js cache
- `visibilitychange` listener re-fetches when tab regains focus
- `mounted` guard prevents state updates after unmount

### Browser Extension Options Page

Toggle between local development (`http://localhost:3000`) and production (Railway URL) via `chrome://extensions` → Options. Stores `pelta_api_base` in `chrome.storage.sync`. Both background.js and content-script.js read from this storage on startup.

---

## Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `GEMINI_API_KEY` | Yes | Google Gemini API key for LLM classification and prompt risk assessment |
| `LLM_API_KEY` | No | Alternative key name (fallback) |

Set in Railway dashboard or `.env.local` (gitignored). Never committed.

---

## Git Branches

| Branch | Purpose |
|--------|---------|
| `dev` | Active development — run locally, make changes, test |
| `main` | Production — Railway auto-deploys on push. Only receives verified merges from `dev` |

Workflow: `git checkout dev` → make changes → test → `git checkout main; git merge dev; git push` → Railway rebuilds.

---

## Build & Deploy

**Local dev:** `npm run dev` (port 3000)
**Build:** `npm run build` (TypeScript + Next.js)
**Production start:** `npx next start -p 3000`
**Seed data:** `POST /api/seed` or click Reset button on landing page

**Railway:** Dockerfile at root (Node 22 Alpine, `npm ci`, `npm run build`, `next start`). Persistent volume mounted at `/app/data`. CORS headers for all `/api/*` routes configured in `next.config.ts`.

---

## Key Design Decisions

1. **JSON file store over database** — Chose `data/*.json` with fs writes for simplicity (no DB setup needed). Railway persistent volume makes this viable in production.
2. **Server-side rendering disabled** — All pages use `'use client'` directive. The app is a SPA with client-side data fetching.
3. **CSS variables + Tailwind zinc** — Two color systems coexist intentionally. CSS variables handle the semantic risk/accent palette. Zinc handles neutral grays with explicit light/dark control. The `.panel` class bridges both via CSS variables.
4. **Framer Motion on all pages** — Uniform entrance animation pattern (`initial={ opacity:0, y:10 }`) creates consistent feel across the app.
5. **Extension as separate Chrome extension** — Not part of the Next.js build. Must be loaded unpacked. API base is configurable via options page.
