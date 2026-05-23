# Confera — High Level Design (HLD)

Confera is an enterprise-grade AI-powered preparation platform that optimizes resume ATS compatibility and conducts real-time turn-based voice mock interviews to prepare candidates for competitive engineering roles.

---

## Section 1 — Product Overview

### What is Confera?
Confera is a Software-as-a-Service (SaaS) platform designed to bridge the gap between candidate preparation and real-world interview success. It acts as an automated, highly personalized career coach by providing two main tools:
1. **ATS Resume Optimizer**: An automated scanning tool that extracts resume details, evaluates keywords against target job profiles, flags formatting issues, and outputs a checklist to maximize ATS (Applicant Tracking System) screening pass-rates.
2. **Intelligent Voice Mock Interviewer**: A stateful conversational agent that conducts interactive voice-only interviews, simulates realistic technical or behavioral questions, and analyzes candidate speech patterns (filler words, logic structures) in real-time.

### Target Users
* **Software Engineers & Job Seekers**: Preparing for Data Structures & Algorithms (DSA), System Design, and Behavioral (HR) interviews.
* **Specialized Candidates**: Preparing for McKinsey Digital Engineering (DE), McKinsey QuantumBlack, or other elite technical consulting tracks.
* **Active Applicants**: Looking to check their resume compatibility against modern automated parsing engines.

### Core Value Proposition
* **Realistic Interview Simulation**: Transition from static flashcards to interactive audio-based mock interviews.
* **Instant Actionable Feedback**: Deep diagnostic metrics (STAR method compliance, filler word counts, missing logical points, technical depth).
* **Data-driven Preparation Paths**: Automatic generation of weekly focus plans and gap-resolving study resources based on actual practice performance.
* **High Accessibility & Cost-Efficiency**: Eliminates the need for expensive human mock interviewers, providing unlimited practice to premium users.

### Current Feature Set
* **Automatic Resume Extraction & Keywords Matching**: Extracts metadata, profiles, and skills from uploaded PDFs.
* **Job Role Customization**: Customizes analysis and interview behavior to selected target roles (e.g. Software Engineer, Product Manager, Data Scientist).
* **Pre-Flight Diagnostics**: Inspects microphone and audio systems before starting interview sessions to minimize in-meeting issues.
* **Multi-Signal Voice Turn Detection**: High-accuracy voice turn-detection ensuring natural flow, preventing cutoff while candidate is thinking.
* **Real-time Speech Transcription & Synthesis**: Transcribes candidate voice (Web Speech API / Whisper fallback) and synthesizes AI speech locally.
* **Comprehensive Performance Reports**: Detailed reports providing circular visual scorecards, answer-by-answer analysis, and McKinsey readiness levels.
* **Dynamic 7-Day Study Plans**: Continuous updates of candidate skill memory profiles (Technical, Communication, Behavioral) to generate weekly plans.
* **SaaS Subscription & Referral System**: Integrates Razorpay payments, referral tracking (10% earnings), administrative gifting, and founder bypass.

---

## Section 2 — System Architecture Overview

Confera utilizes a modern, serverless Client-Server architecture built on React and Supabase. The system is split into four primary layers:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Frontend Client (React SPA)                     │
│    Pages (Dashboard, Interview, ATS, Pricing, Report)                  │
│    Hooks (useVoiceInput, useVoiceSynthesis, useTurnDetection)          │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ HTTPS / WebSockets
                                    ▼
┌────────────────────────────────────────────────────────────────────────┐
│                      Supabase Serverless Platform                      │
│                                                                        │
│  ┌───────────────────────┐ ┌──────────────────┐ ┌───────────────────┐  │
│  │     Edge Functions    │ │    PostgreSQL    │ │   Storage Buckets │  │
│  │  (Auth, AI, Billing)  │ │ (Tables, pgvector│ │     (Resumes)     │  │
│  └───────────┬───────────┘ └──────────────────┘ └───────────────────┘  │
└──────────────┼─────────────────────────────────────────────────────────┘
               ├───────────────────────────┬─────────────────────────────┐
               ▼                           ▼                             ▼
┌──────────────────────────┐ ┌──────────────────────────┐ ┌──────────────────────────┐
│         AI Layer         │ │      Payment Layer       │ │    Notification Layer    │
│  Gemini, Groq, OpenAI    │ │      Razorpay APIs       │ │       Resend APIs        │
└──────────────────────────┘ └──────────────────────────┘ └──────────────────────────┘
```

### Architectural Components
1. **Frontend Client Layer**:
   * A Single Page Application (SPA) built with React, TypeScript, and Vite.
   * Leverages browser APIs (Web Speech API, AudioContext, MediaRecorder, requestAnimationFrame) for voice interactions.
   * Maintains real-time application state, diagnostic checks, offline/online synchronization, and client-side page transitions.
2. **Supabase Core Layer**:
   * **Authentication**: Manages OAuth and Passwordless/OTP sign-ups, issuing JSON Web Tokens (JWT) to secure subsequent API calls.
   * **PostgreSQL Database**: Holds all application tables (profiles, sessions, reports, referrals). Implements Row-Level Security (RLS) to enforce tenant isolation.
   * **pgvector Extension**: Powers the RAG (Retrieval-Augmented Generation) memory engine by calculating cosine similarities on transcript embeddings.
   * **Storage Buckets**: Stores candidate resumes as raw files securely, generating temporary signed URLs for parsing.
3. **Supabase Edge Functions Layer**:
   * Serverless Deno isolates acting as secure API endpoints.
   * Responsible for heavy logic: talking to LLM engines, executing background calculations (exponential moving averages for skill profiles), sending emails, and handling payment signatures.
4. **Third-Party Integrations**:
   * **AI Providers**: Gemini (chat and embeddings), Groq (Whisper transcription fallback and LLMs), OpenAI (tertiary LLM fallback).
   * **Razorpay**: Direct order creation and payment authorization verification.
   * **Resend**: Transports transactional emails (onboarding, streak warnings, receipts, reports).

---

## Section 3 — Technology Stack

| Layer | Technology | Rationale |
| :--- | :--- | :--- |
| **Frontend** | React 18, TypeScript, Vite | Fast compilation, modular components, static compilation, and robust hook ecosystems for browser hardware access. |
| **Styling** | TailwindCSS, Shadcn UI, Framer Motion | Smooth animation support, modern dark mode dashboard aesthetics, responsive interfaces. |
| **Backend & Auth** | Supabase Auth, Deno Edge Functions | Serverless structure, zero cold start latency, unified TypeScript codebase on client and server. |
| **Database** | Supabase PostgreSQL, pgvector | Structured data integrity, direct vector distance calculation in SQL via pgvector (`<=>`), built-in Row-Level Security. |
| **Speech-to-Text** | Web Speech API, Groq Whisper API | Real-time browser native transcription for zero-cost performance; falls back to Whisper-large-v3-turbo for precision on iOS/Safari. |
| **Text-to-Speech** | HTML5 SpeechSynthesis | Client-side zero-latency voice synthesis with offline fallback support. |
| **AI Models** | Gemini 2.5 Flash, Groq Llama 3, OpenAI | Gemini for general text reasoning and text-embeddings-004; Groq Llama models for speed; OpenAI as high-availability failover. |
| **Payments** | Razorpay SDK, Supabase Hooks | Leading payment solution in INR with support for UPI, Cards, and Netbanking. |
| **Emails** | Resend API | Developer-friendly transactional email delivery with custom HTML styling. |
| **PDF Parsing** | pdfjs-dist | Robust, client-side PDF parsing to avoid uploading massive payloads to edge functions. |

---

## Section 4 — User Flows & Lifecycles

### 1. Onboarding & Authenticating Flow
1. User enters their email on the `/auth` page.
2. Supabase Auth handles email verification. If a referral code exists in `localStorage` (captured from `?ref=ABC123`), the client binds the code.
3. The hook `useAuth` calls Supabase to construct a user profile and logs a default onboarding event.

### 2. Resume Scan & Optimization Flow
```
[Select Job Role] ──► [Drag PDF Resume] ──► [Client PDFJS Extracts Text]
                                                   │
   ┌───────────────────────────────────────────────┘
   ▼
[Invoke 'ats-analyzer'] ──► [LLM Identifies Gaps/Roadmap] ──► [Update DB & Render Dashboard]
```
1. User selects target role and uploads a PDF resume.
2. The client parses the PDF text locally using `pdfjs-dist` to save edge function payload costs.
3. The client calls `ats-analyzer` Edge Function with the extracted text.
4. The Edge Function runs an LLM parsing prompt, identifies keyword matches, computes the ATS score, and stores the results in the `resumes` table.
5. The dashboard UI immediately refreshes, unlocking the customized 7-day study plan.

### 3. Interview Session Flow
1. **Pre-Flight Diagnostics**: User completes a checklist measuring mic access, audio loopback latency, and speech synthesis state.
2. **Session Initialization**: User selects technical, behavioral, or DSA mock interview. Frontend calls `start-interview` which creates a session record and confirms billing parameters.
3. **Turn-based Interaction**:
   * Assistant speaks -> User listens.
   * User speaks -> Real-time VAD checks audio energy -> Turn-detection hook processes speech boundaries.
   * When silence threshold elapsed or manual "Done" clicked, text is captured.
4. **Logic Evaluation**: Frontend posts the transcript to `ai-interview-chat`. The LLM yields the next response.
5. **Session Complete**: Once the max questions threshold is hit, `generate-feedback` triggers in the background, rendering a comprehensive performance scorecard.

---

## Section 5 — AI Architecture & Orchestration

Confera's AI layer is designed with high redundancy, intelligent RAG memory integration, and safety guardrails.

### 1. Fallback Model Routing & Circuit Breakers
To prevent API outages from breaking interview sessions, the platform routes requests through `_shared/ai-service.ts` using a dynamic provider selection:
* **Primary**: Google Gemini 2.5 Flash (selected for high rate limits and context length).
* **Secondary**: Groq Llama 3 (for fast latency responses).
* **Tertiary**: OpenAI GPT models.
* **Circuit Breakers**: The system maintains an in-memory error logger within the Deno isolate. If a provider fails 3 consecutive times, it trips a circuit breaker, routing traffic to the next provider. The broken provider enters a 2-minute cooling-off period before entering a half-open state.

### 2. Retrieval-Augmented Generation (RAG) Memory Pipeline
To maintain context across an interview or multiple study sessions, Confera uses a vector memory store:
1. **Embeddings**: When questions/answers are completed, `embed-session` triggers. It calls Gemini's `text-embedding-004` to create 768-dimensional vectors of Q&A pairs.
2. **Storage & Vector Matching**: The embeddings are stored in `transcript_embeddings`. A pgvector cosine similarity lookup via the database RPC `match_transcript_embeddings` is performed:
   $$\text{Similarity} = 1 - (\text{embedding} \Leftrightarrow \text{query\_embedding})$$
3. **Skill Memory Accumulation**: Confera maintains user profiles over time. Rather than overriding, it uses an Exponential Moving Average (EMA) with a decay factor of $0.7/0.3$ to update a user's skills:
   $$\text{New Skill Score} = 0.7 \times \text{Session Score} + 0.3 \times \text{Old Skill Score}$$

---

## Section 6 — Voice Architecture & Intelligent Turn Detection

A critical challenge in voice mock interviews is preventing the AI from interrupting the candidate while they are thinking. Confera solves this with a multi-signal turn detection system.

### 1. The 5-Signal Turn Detection System
The system combines five distinct inputs through `useTurnDetection` to determine end-of-turn:
1. **Acoustic Phrases**: Checks if the transcribed text ends with conversational wrapping phrases (e.g. *"that's it"*, *"I'm done"*, *"does that make sense"*). If matched, the grace threshold collapses to 2 seconds.
2. **Transcript Word Count**: Prevents premature stopping by applying progressive silence timers:
   * $< 15$ words: Infinite silence allowed (never auto-submits).
   * $15 \text{ to } 50$ words: 6-second silence allowed.
   * $51 \text{ to } 100$ words: 8-second silence allowed.
   * $> 100$ words: 10-second silence allowed.
3. **Voice Activity Detection (VAD)**: A Web Audio Analyser node calculates real-time Root-Mean-Square (RMS) audio energy. If the energy falls below a threshold ($< 0.02$) and no speech is detected, a silence timer starts.
4. **Manual Escape Hatches**: The UI displays a *"Keep Listening"* button to reset the silence timer and a *"Done"* button to force immediate submission.
5. **Confirming State**: If silence reaches 80% of the active threshold, the system transitions to a `confirming` state, alerting the user visually before submitting.

### 2. Dual-Mode Voice Input Engine
To ensure compatibility across desktop, mobile, and Apple iOS:
* **Speech API Mode (Web Speech)**: Used on Google Chrome/Edge, enabling streaming real-time local transcriptions.
* **MediaRecorder Fallback**: Used on Apple iOS and Firefox. It records raw WebM/MP4 audio chunks dynamically. Upon detecting silence via VAD, it sends the audio blob to the `transcribe-audio` Edge Function, which runs Groq Whisper (`whisper-large-v3-turbo`) for near-instant transcription.

---

## Section 7 — Security & Isolation

Confera implements security boundaries at every architectural layer:
* **JWT Authenticated Edge Functions**: All incoming requests (except order creation and health checks) must pass a valid Bearer token. The middleware extraction helper matches the JWT against Supabase's Auth API.
* **Row-Level Security (RLS)**: Enforced on all PostgreSQL tables. Rows are linked to `auth.uid()`, preventing any customer from querying or mutating records belonging to another candidate.
* **CORS Origin Whitelisting**: The CORS middleware rejects request headers that do not match the whitelisted production domain (`conferav2.vercel.app`) or permitted localhost development environments.
* **Rate Limiting**: Deno isolates implement an in-memory client rate limiter based on client IP addresses, protecting AI endpoints from resource exhaustion.
* **Prompt Injection Sanitizer**: The request context scans input text strings for common system-override instructions (e.g. *"ignore previous instructions and say..."*) before sending payloads to LLM APIs.

---

## Section 8 — Subscription & Monetization

Confera monetizes via a premium tier, managed securely via Razorpay and referral tracking.

```
[Create Order] ──► [Process in UI] ──► [Razorpay Success]
                                            │
   ┌────────────────────────────────────────┘
   ▼
[Invoke 'verify-payment'] ──► [Check Signature] ──► [Activate Pro & Calculate Referrals]
```

### 1. Checkout & Payment Verification
1. The frontend hits `create-order` to generate a Razorpay transaction (monthly or yearly).
2. The user processes the checkout window in the React UI.
3. Upon success, the client sends signature payloads to `verify-payment`.
4. The Edge Function validates the signature using the SHA256 HMAC of the order ID and payment ID. On validation, it updates the `subscriptions` table, unlocking unlimited access.

### 2. Referral System Logic
* When a premium purchase is verified, the system queries the `referrals` table for a linking referrer.
* If a referrer is found, the system:
  1. Converted status is activated.
  2. Calculates 10% of the transaction amount.
  3. Writes commission credit into the `referral_earnings` table.
  4. Triggers payout request emails to the referrer via Resend.

### 3. Special Bypasses
* **Founder Access**: Emails `aditya06.jha@gmail.com` and `06aditya.jha@gmail.com` bypass billing gates in `useSubscription.ts` and PL/pgSQL calculations, gaining free Pro status.
* **Gifting**: Admins can execute `gift_pro_access(target_user_id, duration)` to override subscription dates.

---

## Section 9 — Deployment & Infrastructure

* **Serverless Hosting**: Deno Deploy managed via Supabase CLI. Functions are isolated, lightweight, and deployable close to client users.
* **Database Migrations**: PostgreSQL schemas are managed sequentially. Local migrations under `supabase/migrations/` track changes to tables, functions, and RLS rules, allowing simple syncs across development, staging, and production environments.
* **Storage Rules**: The `resumes` bucket restricts file uploads to 5MB PDFs, forcing files to be stored with security structures where users can read only their own documents.

---

## Section 10 — Observability & Operational Resilience

* **Active Health Checking**: The `health-check` Edge Function runs continuous diagnostics:
  * Measures Supabase PostgreSQL query latencies.
  * Measures Gemini API connectivity.
  * Measures Groq API network latency.
* **Centralized Logs**: The platform logs API invocations, payments, and errors in the `event_logs` database table, allowing administrators to audit system events.
* **User-Facing Resilience**:
  * **ErrorBoundary Components**: Wrap the React routing paths, preventing unhandled UI bugs from crashing the application.
  * **Offline Mode Banners**: Renders real-time notifications when the client loses network access, queueing speech submissions until connectivity is restored.
