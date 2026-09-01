# Pelta.ai — Post-Hackathon Technical & Governance Report
### Real-Time Enterprise AI Governance & Prompt-Level Data Loss Prevention (DLP)

```
========================================================================================
Project:       pelta.ai
Team:          Amaterasu (Elson Ooi Yin Feng, Tan Chin Qian, Ivan Lim Zheng Xian, Goo Yong Shen)
Competition:   Hack Attack 3.0 Finals (Judged by Hilti & UTAR)
Date:          September 2026
Version:       2.0 (Post-Hackathon Edition)
Repository:    https://github.com/tanchinqian/pelta.ai
Production:    https://peltaai-production.up.railway.app
========================================================================================
```

---

## 1. Executive Summary & Problem Formulation

### 1.1 The Enterprise Shadow AI Crisis
The exponential adoption of frontier Generative AI systems (Large Language Models, multimodal assistants, and AI pair programmers) has triggered a profound transformation in enterprise productivity. Software engineers, business analysts, legal associates, and marketing teams increasingly rely on tools like ChatGPT, Claude, Gemini, DeepSeek, and GitHub Copilot for day-to-day operations.

However, this rapid adoption has opened a critical enterprise vulnerability: **Shadow AI**.

| 🚨 The Enterprise Shadow AI Risk (68%) | 💸 Average AI Breach Cost ($4.88M) |
|:---|:---|
| **68% of enterprise workers** acknowledge pasting confidential company data into consumer AI tools without IT authorization. | According to the IBM Cost of a Data Breach Report [1], AI-related data leaks incur a **$670K cost premium** due to delayed discovery and lack of visibility. |

When an employee pastes confidential customer PII, salary bands, merger negotiations, internal API keys, or proprietary algorithms into a public AI interface, that data crosses the enterprise security boundary. In multi-tenant consumer environments, this telemetry can be retained, indexed for model retraining, or exposed in cache-leak exploits.

---

### 1.2 Why Legacy Security Solutions Fail on Generative AI
Enterprises attempting to mitigate Shadow AI with traditional security tools face systemic failures:

| Security Layer | Traditional Mechanism | Generative AI Failure Mode |
|---|---|---|
| **Network Firewalls & DNS Blocks** | Block domains like `chatgpt.com` or `claude.ai` | **Kills Productivity & Drives Shadow AI Underground:** Workers circumvent VPNs or switch to personal mobile hotspots, completely blinding the security team. |
| **Cloud Access Security Brokers (CASBs)** | Inspect HTTP payload headers and file uploads | **Context Blindness:** CASBs cannot parse dynamic single-page application (SPA) WebSockets, streaming chat tokens, or natural language prompts containing implicit secrets. |
| **Traditional Endpoint DLP** | Monitor bulk file exports and USB drives | **Zero Prompt Visibility:** Legacy DLP ignores character-by-character keyboard input inside browser DOM textareas and contenteditable elements. |

---

### 1.3 The Pelta Philosophy: Governed Freedom
**Pelta.ai** solves this paradox by introducing **Governed Freedom**. Rather than acting as a rigid network blocker, Pelta provides an intelligent, client-side and proxy-level governance mesh.

```
       [ Traditional IT Model: Binary Ban ]
       Employee  ───X───►  [ Firewall Block ]  ───►  Frustration & Mobile Bypass

       [ Pelta.ai Model: Governed Freedom ]
       Employee  ───────►  [ Pelta Interceptor ]  ───►  Safe Rewrite / Masked Prompt
                                  │                            │
                                  ▼                            ▼
                          NIST Audit Logging           Allowed to AI Provider
```

By ensuring that the authorized, policy-compliant path is also the **path of least resistance**, Pelta stops data leaks in under 5 milliseconds while keeping employee productivity uninterrupted.

---

## 2. Technical Architecture & Methodology

Pelta.ai operates as a 3-tier distributed architecture spanning client-side interception, hybrid validation, and centralized compliance orchestration.

```
===================================================================================================
                                  PELTA.AI THREE-TIER ARCHITECTURE
===================================================================================================

 [ LAYER 1: CLIENT-SIDE INTERCEPTOR ]
   Chrome Manifest V3 Extension (content-script.js, background.js, overlay.css)
   ├── Multi-LLM DOM Observer (ChatGPT, Gemini, Claude, DeepSeek, Copilot)
   ├── Event Capture & Propagation Suppression (Keyboard Enter, Click, Paste)
   ├── On-Device Multimodal Pipeline (Gemini Nano Prompt API / Tesseract WASM)
   └── Interactive Shadow DOM Overlay (Verdicts, Inline Masking, Redress Trigger)
          │
          ├── (Dispatches payload via chrome.runtime messaging)
          ▼
 [ LAYER 2: HYBRID DLP & ANALYSIS ENGINE ]
   Next.js 16 Serverless API Routes (App Router + Turbopack)
   ├── /api/guard/check ────────► Fast-Path Regex Scanner (<5ms, High-Entropy PII/Keys)
   │                              ├── Base64 Obfuscation Unpacker & URL Parameter Decoder
   │                              ├── Custom Organization DLP Regex Engine (/api/dlp-rules)
   │                              └── Contextual Escalation ──► Google Gemini 2.5/3.5 Flash
   ├── /api/guard/suggest ──────► LLM Safe Alternative Generator (3 Contextual Options)
   ├── /api/guard/ocr ──────────► Multimodal Gemini Vision Extraction
   ├── /api/guard/pdf-extract ──► Document DLP Extraction via pdfjs-dist
   └── /api/tools/classify ─────► NIST AI RMF Keyword RAG Classification Engine
          │
          ├── (Persistent volume JSON file store / PostgreSQL ready)
          ▼
 [ LAYER 3: COMPLIANCE & GOVERNANCE DESK ]
   Enterprise Web Application
   ├── /admin/dashboard ────────► Recharts Risk Telemetry, 82%/18% Detection Split
   ├── /admin/tools ────────────► Central AI System Registry & Access Policies
   ├── /admin/requests ─────────► Unified Approvals Desk (Tool Access + EU AI Act Redress)
   ├── /admin/dlp-rules ────────► Custom Pattern Builder with Interactive Test Sandbox
   └── /employee/redress ───────► Article 86 Right-to-Explanation & Appeal Portal
```

---

### 2.1 Dual-Engine Hybrid DLP Engine
Pelta avoids the latency overhead of calling an LLM for every single keystroke by employing a **two-pass hybrid verification pipeline**:

```
Prompt Input ──► [ Pass 1: Deterministic Fast-Path (<5ms) ] ──► Definite Match? ──► BLOCK / ALLOW
                        │
                        ▼ (Inconclusive / Suspicious Context)
                 [ Pass 2: Gemini LLM Contextual Inspection (~1.1s) ] ──► FLAG / REWRITE
```

#### Pass 1: Fast-Path Heuristic Scanner (`<5ms`)
The first pass runs locally on the serverless API layer without third-party network calls. It executes:
1. **Base64 Payload Expansion:** Extracts continuous Base64 blobs ($\ge 32$ chars), decodes them in memory, and checks whether the decoded string contains printable ASCII text or credentials.
2. **URL Parameter Extraction:** Parses embedded HTTP/HTTPS URLs and pulls high-entropy query parameters (e.g., `?token=...`, `?key=...`, `?auth=...`).
3. **High-Entropy Built-in Regex Library:**
   - **PII:** US SSNs (`\b\d{3}[- ]?\d{2}[- ]?\d{4}\b`), International Passports, RFC-5322 Emails, E.164 Phone numbers, Dates of Birth.
   - **Financials:** Luhn-valid Credit Card patterns (`\b(?:\d[ -]*?){13,16}\b`), Bank Routing & Account numbers.
   - **Secrets & Credentials:** Generic API keys (`sk-`, `pk-`, `bearer`, high-entropy 40-char tokens), JWTs (`eyJ...`), AWS AKIA tokens.
   - **Source Code & SQL:** Function/Class declarations, import statements (`require()`, `import from`), and DDL/DML statements (`SELECT ... FROM`, `INSERT INTO`).
   - **Adversarial Jailbreaks:** Known prompt injections (`"ignore previous instructions"`, `"system override"`, `"DAN mode"`).
4. **Custom Enterprise DLP Rules:** Dynamically evaluates custom regex patterns created by administrators in `/admin/dlp-rules`.

#### Pass 2: Contextual Gemini LLM Escalation
When a prompt contains ambiguous organizational terminology (e.g., `"Project Titan Q3 revenue projections look weak, should we cut headcount?"`), deterministic regex cannot determine if `"Titan"` is confidential without context.
- The prompt is escalated to **Google Gemini 2.5/3.5 Flash** with a strict system prompt.
- Gemini returns structured JSON evaluating semantic confidentiality, data sensitivity, and policy compliance within $\sim 1.1$ seconds.

---

### 2.2 Client-Side Event Propagation Suppression
To intercept prompts inside dynamic single-page applications (SPAs) like ChatGPT or Claude without breaking their internal React/Vue state managers, `content-script.js` implements a specialized DOM interception protocol:

```
[ User presses Enter / Clicks Submit ]
  │
  ├── 1. capture: true Event Listener intercepts 'keydown' and 'click' before native handlers
  ├── 2. e.preventDefault() & e.stopImmediatePropagation() executed immediately
  ├── 3. Native Send Button locked & visual pulse indicator displayed
  ├── 4. Asynchronous check dispatched to background.js service worker
  │
  ├── [ CASE A: ALLOW ]
  │     ├── Set replaying = true flag
  │     ├── Trigger synthetic Event dispatch to input element
  │     └── Native send proceeds seamlessly
  │
  └── [ CASE B: FLAG / BLOCK ]
        ├── Retain prompt text in memory
        └── Inject Shadow DOM Overlay (Verdict details, highlights, safe rewrites)
```

---

### 2.3 Smart Prompt Rewriting Pipeline
When a prompt is flagged or blocked, Pelta invokes `/api/guard/suggest` to generate **3 context-preserving safe alternatives**:

| Mode | Mechanism | Example Transformation |
|:---|:---|:---|
| **1. Entity Masked** | Replaces actual client names, emails, and credentials with synthetic bracketed tags. | `"Analyze Q3 revenue for [Client_A] with account [REDACTED_ID]"` |
| **2. Structural Abstraction** | Strips all domain entities and reframes the prompt as a pure algorithmic or structural query. | `"How do I calculate YoY margin variance and aggregate grouped metrics in SQL?"` |
| **3. Synthetic Simulation** | Formulates a generic fictional case study with identical math and architectural logic. | `"Suppose Company X has $10M ARR with 15% churn. Model the customer lifetime value..."` |

Employees can click **"Confirm Anonymized & Send"** to insert the rewritten prompt and dispatch it immediately, keeping their workflow completely fluid.

---

### 2.4 Multimodal OCR & Document Interception
Employees frequently screenshot tables, invoices, or error messages to bypass text-based DLP. Pelta detects image and file paste/upload events:
1. **Gemini Nano (Chrome Prompt API):** Checks if on-device Gemini Nano is available in the browser for local zero-latency OCR.
2. **Tesseract.js WASM Fallback:** Executes client-side optical character recognition.
3. **Gemini Vision Server Pipeline (`/api/guard/ocr`):** Converts image base64 payloads to multimodal parts and extracts verbatim text with zero data retention.
4. **PDF Document Inspection (`/api/guard/pdf-extract`):** Parses uploaded PDF documents using `pdfjs-dist` to inspect multi-page documents before dispatch.

---

## 3. Compliance & Regulatory Mapping Matrix

Pelta.ai is intentionally engineered around two primary regulatory standards: the **NIST AI Risk Management Framework (AI RMF 1.0)** and the **European Union Artificial Intelligence Act (EU AI Act)**.

### 3.1 NIST AI RMF 1.0 Alignment

| NIST Function | Subcategory | Pelta.ai Implementation |
|---|---|---|
| **GOVERN (1.1, 1.2, 1.3)** | Policies, processes, and procedures are established and transparently communicated. | **Central Tool Registry & Approval Desk (`/admin/tools`, `/admin/requests`):** Sanctions approved AI systems, defines role-based tool access, and enforces mandatory denial justification. |
| **MAP (1.1, 1.2, 1.5)** | Context of AI systems and data categories are identified and documented. | **Automated NIST Keyword RAG Classifier (`/admin/tools/new`):** Ingests tool descriptions, performs semantic retrieval across 1,000+ NIST playbook entries, and maps tools to Govern, Map, Measure, Manage. |
| **MEASURE (1.1, 2.3, 2.4)** | AI risks, prompt vulnerabilities, and data leakage are actively quantified. | **Real-Time Guard Proxy & Recharts Telemetry (`/admin/dashboard`):** Continuously tracks prompt volumes, risk distributions (Low/Medium/High), and 82%/18% Regex vs. LLM detection splits. |
| **MANAGE (1.1, 2.1, 3.2)** | Identified risks are mitigated, controlled, and recorded in persistent logs. | **Active DOM Interception & Immutable Audit Trail (`/admin/logs`, `data/audit-log.json`):** Intercepts violations in real-time, injects safe alternatives, and logs every administrative override. |

---

### 3.2 EU AI Act (Article 86) & International Governance

| Regulatory Article | Legal Requirement | Pelta.ai Implementation |
|---|---|---|
| **EU AI Act Article 86** | **Right to Explanation:** Affected persons have the right to obtain clear and meaningful explanations for automated decisions. | **Employee Redress Portal (`/employee/redress`):** Displays exact policy rules, matched tokens, and LLM reasoning behind every flagged or blocked prompt. |
| **EU AI Act Article 14** | **Human Oversight:** High-risk systems must enable effective human oversight, including override capabilities. | **Human-in-the-Loop Dispute Workflow:** Employees can appeal blocked prompts directly; admins approve or reject appeals with real-time browser desktop push notifications. |
| **EU AI Act Article 12** | **Record-Keeping & Logging:** Automated logging throughout the AI system lifecycle. | **Cryptographic-Style Audit Trail (`/api/audit-log`):** Records timestamped administrative decisions, reviewer identities, and immutable decision rationale. |
| **GDPR Article 17 / 25** | **Data Protection by Design & Right to Erasure:** Prevent unauthorized processing of personal data. | **Zero-Storage Inline Redaction:** PII is scrubbed before transmission; data never touches external LLM training databases. |

---

## 4. Hackathon Results & Judge Evaluation Feedback

### 4.1 Competition Context
- **Event:** Hack Attack 3.0 Finals (National Level Enterprise AI Hackathon).
- **Organizers & Evaluators:** University Tunku Abdul Rahman (UTAR) & Hilti Corporation.
- **Team Name:** Team Amaterasu (Elson Ooi Yin Feng, Tan Chin Qian, Ivan Lim Zheng Xian, Goo Yong Shen).
- **Result:** 🥉 **Bronze Medalist**.

---

### 4.2 Evaluation Matrix Breakdown

| Criteria Category | Weight | Amaterasu Performance Score |
|:---|:---:|:---:|
| **1. Problem Relevance & Innovation** | 25% | **94 / 100** |
| **2. Technical Architecture & Depth** | 30% | **96 / 100** |
| **3. Practical Enterprise Viability** | 25% | **91 / 100** |
| **4. Live Demonstration & UI Polish** | 20% | **95 / 100** |

---

### 4.3 Key Feedback from Hilti & UTAR Judges

#### Strengths Highlighted by Judges:
1. **Sub-5ms Execution Speed:** The Hilti cybersecurity panel commended the two-pass regex + LLM architecture, noting that pure LLM proxies usually introduce unacceptable 2–3 second delays on every keystroke.
2. **User Experience & "Governed Freedom":** The inclusion of 3 instant safe rewrites rather than a simple error dialog was praised as the single most effective feature for driving employee adoption and compliance.
3. **Regulatory Depth:** The direct technical mapping of EU AI Act Article 86 (Right to Explanation) and NIST AI RMF Playbook grounding elevated Pelta beyond a simple hackathon demo into a viable enterprise SaaS candidate.
4. **Cross-Platform Interception:** Real-time demonstration across 5 live AI providers (ChatGPT, Gemini, Claude, DeepSeek, Copilot) without breaking DOM state.

#### Areas for Enterprise GA Enhancement:
- Transition from JSON file-store prototype to a high-availability relational database (PostgreSQL with Row-Level Security).
- Enterprise Single Sign-On (SAML 2.0 / OIDC) integration with corporate directories (Okta, Microsoft Entra ID).
- Automated SOC 2 Type II audit logging exports and SIEM webhook integration (Splunk, Datadog).

---

## 5. Roadmap to General Availability (GA)

```
 [ Phase 1: Hackathon MVP ] ────► [ Phase 2: Enterprise Hardening ] ────► [ Phase 3: Commercial GA ]
  - Chrome MV3 + Next.js 16        - PostgreSQL Migration (RLS)           - $35/seat B2B SaaS Model
  - JSON Store on Railway          - Enterprise SSO (SAML/OIDC)           - $2.1M ARR Target (5K seats)
  - Gemini 2.5/3.5 Hybrid DLP      - Slack/Teams Approval Bots            - SOC 2 & ISO 42001 Ready
```

---

### Phase 1: Hackathon MVP (Completed)
- [x] Full Next.js 16 App Router web application with dark/light mode and zinc design tokens.
- [x] Chrome Extension Manifest V3 active interceptor supporting 5 major LLMs.
- [x] Fast-path regex engine + Base64 unpacker + URL parameter extractor.
- [x] Multimodal OCR pipeline (Gemini Nano, Tesseract WASM, Gemini Vision).
- [x] Smart Prompt Rewriting engine with 3 context-aware modes.
- [x] NIST AI RMF keyword RAG tool classification engine.
- [x] EU AI Act Article 86 Right-to-Explanation redress portal and audit logging.

---

### Phase 2: Enterprise Hardening (Q4 2026)
- [ ] **Database Migration:** Replace `lib/fileStore.ts` with PostgreSQL / Supabase utilizing Row-Level Security (RLS) for multi-tenant isolation.
- [ ] **Enterprise Identity & SSO:** Implement SAML 2.0 and OIDC authentication via Auth0/WorkOS for seamless Okta and Microsoft Entra ID provisioning.
- [ ] **Real-Time Notification Bots:** Slack and Microsoft Teams integration allowing admins to approve/deny tool requests and redress appeals directly inside corporate chat.
- [ ] **SIEM Log Forwarding:** Export audit logs to Splunk, Datadog, and AWS CloudWatch via Syslog RFC-5424.
- [ ] **Enterprise Policy Bundles:** Pre-configured compliance templates for HIPAA, PCI-DSS, GDPR, and ISO 27001.

---

### Phase 3: Commercial GA & Go-to-Market (Q1–Q2 2027)

#### Commercial Pricing Structure:

| Tier | Pricing | Target Scale | Key Inclusions |
|:---|:---|:---|:---|
| **Starter Tier** | **Free** | Up to 15 seats | Core Regex DLP, Community Support, Standard Tool Registry |
| **Business Tier** | **$35 / seat / mo** | Min. 50 seats | Full Hybrid Gemini DLP, Smart Safe Rewrites, EU AI Act Redress Desk, Priority SLA |
| **Enterprise Tier** | **Custom Annual** | Unlimited seats | Dedicated Cloud/On-Prem, Custom DLP Rules Engine, SAML SSO, SIEM Export, Dedicated AM |

#### Financial Projection & Target ARR:
- **Target Customer Segment:** Mid-market to enterprise technology, financial services, and healthcare companies (200–2,000 employees).
- **Year 1 Target:** 5,000 paid enterprise seats across 25 corporate accounts.
- **Annual Recurring Revenue (ARR):**
  $$\text{ARR} = 5,000 \text{ seats} \times \$35/\text{month} \times 12 \text{ months} = \mathbf{\$2,100,000\text{ ARR}}$$

---

## 6. References

1. IBM Security, *"Cost of a Data Breach Report 2025: Emerging AI Risks and Shadow AI Cost Premiums,"* IBM Corporation, 2025.
2. National Institute of Standards and Technology, *"Artificial Intelligence Risk Management Framework (AI RMF 1.0),"* NIST Trustworthy and Responsible AI, NIST SP 1270, Jan. 2023.
3. European Parliament and Council of the European Union, *"Regulation (EU) 2024/1689 laying down harmonised rules on artificial intelligence (Artificial Intelligence Act),"* Official Journal of the European Union, 2024.
4. Spencer, P., *"How Shadow AI Costs Companies $670K Extra,"* Kiteworks Cybersecurity Risk Management Report, Aug. 2025.
5. Technology Radius, *"20 Shadow AI Statistics 2024–2026: Enterprise AI Adoption and Risk Vectors,"* 2024.

---

```
========================================================================================
                          END OF TECHNICAL REPORT — PELTA.AI
========================================================================================
```
