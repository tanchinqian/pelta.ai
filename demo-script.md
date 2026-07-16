# peris.ai — Demo Script (2–3 min)

## Setup (before judges arrive)

1. Open 3 tabs: **Landing** (`/`), **Classify** (`/admin/tools/new`), **Prompt Guard** (`/employee/prompt-guard`)
2. Toggle Admin on the landing page so the role switcher is visible
3. If using real Gemini key: verify `.env.local` has `GEMINI_API_KEY` set. If not, the mock fallback still works — just have the responses in mind.
4. Window size ~1400px wide so charts are legible

---

## 1. Opening (15s)

> *Landing page visible. Toggle between Employee and Admin once.*

**"peris.ai is an AI governance platform built for the NIST AI RMF framework. It solves three challenges from the case study: employee compliance without blocking productivity, data privacy before data leaves the org, and full transparency for every AI-related decision. I'll show you two live features — both using real LLM inference, not mock data."**

---

## 2. Killer Feature: Tool Risk Classification (60s)

> *Click "Classify" in the nav to go to `/admin/tools/new`*

**"An admin needs to assess whether a new AI tool is safe for the organisation. I'll submit one I've never tested before — live."**

> *Type in a real, lesser-known AI tool so the classification is genuinely live. Suggestions:*

| Pick one that sounds plausible | Example description |
|---|---|
| **"Synthesia"** | "AI video generation for creating training content with digital avatars" |
| **"Notion AI"** | "AI writing assistant integrated into Notion for internal documentation" |
| **"Otter.ai"** | "Real-time meeting transcription and summarization" |
| **"Mem"** | "AI-powered knowledge base for team notes" |

*(Don't use ChatGPT, Copilot, or Grammarly — those are already in the seed data and feel rehearsed.)*

> *Type name + description, click **Classify**. Wait ~2-3s for the response.*

**"The system sends this to Gemini with a structured prompt requesting JSON-only output — no markdown, no preamble. The result is a full risk profile: tier, NIST functions implicated, data categories touched, a plain-English justification, and a recommended access policy."**

> *Result card appears with all fields.*

**"Notice the amber border and subtle tint — the UI treats this as a primary panel so the outcome is visually distinct. The tool is now persisted to the registry."**

> *Scroll down to the registry table. Point to the new entry.*

**"It shows up in the live registry immediately, visible in the dashboard charts. Every admin from this point has visibility into what's approved and why."**

---

## 3. Prompt Guard: Hybrid Detection (60s)

> *Click "Prompt Guard" in the nav or navigate to `/employee/prompt-guard`*

**"The other side of the platform — the employee-facing proxy. An engineer wants to paste a message into ChatGPT. Before it leaves the organisation, peris.ai scans it."**

> *Paste this prompt (or something similar):*

```
Hey team, please find the Q2 financial summary attached. 
Contact Sarah at s.martinez@acmecorp.com or +1-415-555-0192 if you have questions.
Our internal budget is confidential — do not share externally.
```

> *Click **Scan**.*

**"First pass: regex. The system immediately flags the email address and phone number against known patterns — credit cards, API keys, SSNs, phone numbers, emails. These are deterministic rules, zero latency."**

> *Verdict card appears on the right.*

**"If no hard regex matched, the system would escalate to Gemini for a judgment call — does this look like confidential business content? But here, the regex caught high-severity patterns, so the verdict is instant. Blocked."**

> *Point to the highlighted spans in the scanned text panel.*

**"The employee sees exactly which spans triggered the block, the risk level, the detection method, and the reason. Every scan is logged to the audit trail with the ID shown here."**

> *Point to the hexadecimal ID at the bottom of the result panel.*

**"That ID correlates back to the dashboard logs for review. This is how Challenge 3 — transparency — is satisfied in real time."**

---

## 4. Dashboard Quick Glance (20s)

> *Click "Dashboard" in the nav to go to `/admin/dashboard`*

**"The admin dashboard aggregates everything: verdict distribution, risk distribution across classified tools, data category breakdown, NIST RMF coverage, and a trend line showing verdicts over time. All charts are driven by live data from the same JSON store — no mock endpoints."**

> *Point to the stat row.*

**"Seven key metrics at a glance. The first stat card has the accent treatment to anchor the read."**

---

## 5. Close (10s)

**"peris.ai addresses all three case study challenges: frictionless approval workflows, real-time data privacy protection, and full explainability. Built in ~2 days on Next.js with Gemini for LLM inference, recharts for visualisation, and zero infrastructure — everything runs off flat files on disk. Happy to take questions."**

---

## Appendix: If They Ask About...

### "What if you don't have a Gemini key?"
The mock fallback returns realistic data. The demo works identically — just say "The Gemini call is disabled in this environment, but the response structure is the same."

### "Is the regex + LLM hybrid novel?"
"The hybrid approach is pragmatic: regex catches the obvious patterns instantly at zero cost, LLM only fires for ambiguous cases. This keeps latency low on common paths while still catching nuanced confidential content."

### "What about deployment?"
"This is a monorepo ready to deploy to Vercel in one command. Swapping JSON files for Postgres is a single adapter change — the API routes abstract persistence behind `fileStore.ts`."

### "EU AI Act — is this compliant?"
"We reference Article 86 explicitly in the redress page. The platform provides the *technical mechanism* for compliance — real-time explanation, audit trail, appeal path. Actual compliance depends on organisational policy built around these capabilities."
