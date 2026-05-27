# Confera — End-to-End System Flow Diagram

This document contains a comprehensive, single-page architecture and process flow diagram for the Confera platform. It visualizes the interaction between the React Frontend, Supabase Backend (Auth, DB, Storage, Edge Functions), AI Providers (Gemini, Groq), and Payment Gateways (Razorpay).

---

## Complete System Flow

```mermaid
flowchart TB
    %% Styling and Themes
    classDef frontend fill:#f5f3ff,stroke:#7c3aed,stroke-width:2px,color:#1e1b4b;
    classDef edge fill:#f0fdfa,stroke:#0d9488,stroke-width:2px,color:#115e59;
    classDef db fill:#eff6ff,stroke:#2563eb,stroke-width:2px,color:#1e3a8a;
    classDef ai fill:#fffbeb,stroke:#d97706,stroke-width:2px,color:#78350f;
    classDef payment fill:#fef2f2,stroke:#dc2626,stroke-width:2px,color:#7f1d1d;
    classDef thirdparty fill:#f9fafb,stroke:#4b5563,stroke-width:2px,color:#111827;

    %% ------------------ STAGE 1: AUTHENTICATION ------------------
    subgraph AuthStage ["1. Authentication & Onboarding"]
        A_UI["/auth Page (Email Input)"]:::frontend
        A_OAuth["Google OAuth Portal"]:::thirdparty
        A_OTP["Passwordless OTP (Resend Email)"]:::thirdparty
        A_Auth["Supabase Auth Engine"]:::edge
        A_JWT["JWT Session Token (Local Storage)"]:::frontend
        A_Profiles["profiles Table<br>(Name, Plan = 'free', Referral Code)"]:::db
    end

    A_UI -->|Option A| A_OAuth
    A_UI -->|Option B| A_OTP
    A_OAuth --> A_Auth
    A_OTP --> A_Auth
    A_Auth -->|Generate Claims| A_JWT
    A_Auth -->|Trigger Row Creation| A_Profiles

    %% ------------------ STAGE 2: RESUME SCAN & ATS ------------------
    subgraph ResumeStage ["2. Resume Parsing & ATS Analysis"]
        R_UI["/ats UI (Upload PDF)"]:::frontend
        R_PDFJS["pdfjs-dist (Client-side Text Extraction)"]:::frontend
        R_Bucket["Supabase Storage<br>('resumes' Bucket)"]:::db
        R_Edge["analyze-resume / ats-analyzer<br>(Edge Function)"]:::edge
        R_LLM["Gemini 2.0 Flash<br>(Groq LLaMA 3.3 Fallback)"]:::ai
        R_Table["resumes Table<br>(ATS Score, Parsed JSON, Roadmap)"]:::db
        R_Dash["/dashboard (Study Plan Unlocked)"]:::frontend
    end

    A_JWT -->|Attach Bearer Token| R_UI
    R_UI -->|1. Parse Text| R_PDFJS
    R_UI -->|2. Store File| R_Bucket
    R_PDFJS -->|3. Extracted Text payload| R_Edge
    R_Edge -->|4. Analyze prompt| R_LLM
    R_LLM -->|5. Structured JSON output| R_Edge
    R_Edge -->|6. Save record| R_Table
    R_Table -->|7. Auto-refresh| R_Dash

    %% ------------------ STAGE 3: INTERVIEW INITIALIZATION ------------------
    subgraph InterviewInitStage ["3. Interview Room & Diagnostics"]
        I_Check["Pre-Flight Diagnostics<br>(Mic, Latency & TTS Check)"]:::frontend
        I_UI["/interview/:sessionId UI<br>(Select Role & Session Type)"]:::frontend
        I_StartEdge["start-interview (Edge Function)"]:::edge
        I_SessionsTable["interview_sessions Table<br>(Status = 'active')"]:::db
        I_RAG["RAG Search (match_transcript_embeddings)"]:::db
    end

    R_Dash --> I_Check
    I_Check -->|Pass| I_UI
    I_UI -->|Init Call| I_StartEdge
    I_StartEdge -->|1. Validate Quota & Create Session| I_SessionsTable
    I_StartEdge -->|2. Query past skill memory| I_RAG

    %% ------------------ STAGE 4: STATEFUL INTERVIEW LOOP ------------------
    subgraph InterviewLoopStage ["4. Real-time Turn-based Voice Loop"]
        L_SpeechSynthesis["HTML5 SpeechSynthesis<br>(Speak AI Question)"]:::frontend
        L_VAD["useVoiceInput (VAD / RMS Web Audio)"]:::frontend
        
        L_WebSpeech["Web Speech API Mode<br>(Chrome/Edge Streaming)"]:::frontend
        L_MediaRec["MediaRecorder Fallback<br>(iOS/Safari Blobs)"]:::frontend
        L_Transcribe["transcribe-audio (Edge Function)"]:::edge
        L_Whisper["Groq Whisper API"]:::ai
        
        L_Turn["useTurnDetection State Machine<br>(Acoustic, Words & Silence Timer)"]:::frontend
        L_AnsEdge["analyze-answer / ai-interview-chat<br>(Edge Function)"]:::edge
        L_Evaluator["Gemini 2.0 Evaluator"]:::ai
        L_AnswersTable["interview_answers Table<br>(Q&A, Score, Filler Words)"]:::db
    end

    I_SessionsTable --> L_SpeechSynthesis
    L_SpeechSynthesis --> L_VAD
    
    L_VAD -->|Web Speech API supported| L_WebSpeech
    L_VAD -->|Web Speech unsupported| L_MediaRec
    
    L_WebSpeech --> L_Turn
    L_MediaRec -->|Send WebM Blob| L_Transcribe
    L_Transcribe --> L_Whisper
    L_Whisper -->|Transcribed Text| L_Turn
    
    L_Turn -->|Turn Completed (Silence/Done)| L_AnsEdge
    L_AnsEdge -->|Evaluate answer| L_Evaluator
    L_Evaluator -->|Coaching metrics| L_AnsEdge
    L_AnsEdge -->|Save turn details| L_AnswersTable
    L_AnswersTable -->|Loop Next Question| L_SpeechSynthesis

    %% ------------------ STAGE 5: FEEDBACK & REPORTS ------------------
    subgraph FeedbackStage ["5. Ending the Interview & Feedback"]
        F_FeedEdge["generate-feedback (Edge Function)"]:::edge
        F_FeedbackTable["feedback_reports Table<br>(Overall, Tech, Comm, Behavior Scores)"]:::db
        F_Resend["Resend Email API"]:::thirdparty
        F_ReportUI["/report/:sessionId (Scorecard UI)"]:::frontend
    end

    L_Turn -->|Session Question Limit Met| F_FeedEdge
    F_FeedEdge -->|Save Final Metrics| F_FeedbackTable
    F_FeedEdge -->|Send Report Link| F_Resend
    F_FeedbackTable -->|Render visual details| F_ReportUI

    %% ------------------ STAGE 6: STUDY PLANNER FLYWHEEL ------------------
    subgraph FlywheelStage ["6. Agentic Self-Improvement Flywheel"]
        FW_EmbedEdge["embed-session (Edge Function)"]:::edge
        FW_GeminiEmbed["Gemini text-embedding-004"]:::ai
        FW_VectorsTable["transcript_embeddings Table<br>(768d vectors)"]:::db
        FW_EMA["Exponential Moving Average (EMA)<br>Skill Score Updates"]:::db
        FW_PlanEdge["generate-prep-plan (Edge Function)"]:::edge
        FW_PrepTable["prep_plans Table<br>(Dynamic 7-Day Plan)"]:::db
    end

    F_FeedbackTable --> FW_EmbedEdge
    FW_EmbedEdge -->|Vectorize transcript| FW_GeminiEmbed
    FW_GeminiEmbed -->|Store vector| FW_VectorsTable
    FW_EmbedEdge -->|Update profile skill matrix| FW_EMA
    FW_EMA --> FW_PlanEdge
    FW_PlanEdge -->|Store new focus roadmap| FW_PrepTable
    FW_PrepTable -->|Updates dashboard content| R_Dash

    %% ------------------ STAGE 7: BILLING & PAYMENTS ------------------
    subgraph BillingStage ["7. Monetization, Subscriptions & Referrals"]
        B_UI["/pricing UI (Select Plan)"]:::frontend
        B_OrderEdge["create-order (Edge Function)"]:::edge
        B_RazorpayAPI["Razorpay Payment APIs"]:::thirdparty
        B_VerifyEdge["verify-payment (Edge Function)"]:::edge
        B_SubTable["subscriptions Table<br>(Status = 'active')"]:::db
        B_Ref["referral_earnings Table<br>(10% Referrer Commission)"]:::db
    end

    R_Dash -->|Quota warning / Upgrade request| B_UI
    B_UI --> B_OrderEdge
    B_OrderEdge -->|Create Order ID| B_RazorpayAPI
    B_RazorpayAPI -->|User completes payment| B_VerifyEdge
    B_VerifyEdge -->|Signature verified (HMAC-SHA256)| B_SubTable
    B_VerifyEdge -->|Check referral code| B_Ref
    B_SubTable -->|Upgrade User| A_Profiles
    B_Ref -->|Send Commission Email| F_Resend
```

---

## Stage-by-Stage Breakdown & Backend Mechanics

### 1. Authentication & Onboarding
* **Client Pages**: `/auth`
* **Backend Functions**: Supabase Auth
* **Data Flow**:
  1. The user logs in via Passwordless Email OTP or Google OAuth.
  2. Supabase Auth processes the login request and saves/updates metadata.
  3. A custom PostgreSQL trigger inserts a corresponding row into the `public.profiles` table with default variables (`plan = 'free'`, `interviews_used_this_month = 0`).
  4. The client stores the returned JSON Web Token (JWT) in local storage, which secures future calls using the standard `Authorization: Bearer <JWT>` header.

### 2. Resume Scan & ATS Scoring
* **Client Pages**: `/ats` & `/dashboard`
* **Backend Functions**: Deno Edge Function (`analyze-resume` / `ats-analyzer`), Supabase Storage (`resumes` bucket)
* **Data Flow**:
  1. The candidate uploads their PDF resume on `/ats`.
  2. The frontend uses `pdfjs-dist` to extract plain text locally, minimizing JSON payload costs.
  3. The raw PDF is saved to the Supabase Storage bucket `resumes` using a strict policy where users can only read/write their own directory.
  4. The frontend calls the `analyze-resume` Edge Function with the parsed text payload.
  5. The function queries Gemini 2.0 Flash (with Groq LLaMA 3.3 fallback) to calculate the candidate's ATS match score, missing keywords, and formatting recommendations.
  6. The analysis is recorded in `public.resumes` (or `public.resume_analysis`), automatically refreshing the dashboard state.

### 3. Interview Initialization & Diagnostics
* **Client Pages**: `/interview/:sessionId`
* **Backend Functions**: Deno Edge Function (`start-interview`), Supabase PostgreSQL
* **Data Flow**:
  1. The user completes the pre-flight checks (audio device, voice synthesis loop check).
  2. Selecting an interview type (DSA, HR, System Design, McKinsey DE) triggers `start-interview`.
  3. The Edge Function runs subscription validation. If the monthly limit is exceeded, it directs the client to `/pricing`.
  4. Upon verification, the function creates a session row in the `interview_sessions` table (`status = 'active'`).
  5. If available, past transcript snippets are queried from vector store (`transcript_embeddings` via `match_transcript_embeddings`) to augment the interviewer's prompt context (RAG).

### 4. Real-time Stateful Voice Loop
* **Client Pages**: `/interview/:sessionId` (Turn Detection Hook: `useTurnDetection`)
* **Backend Functions**: Deno Edge Function (`ai-interview-chat`, `transcribe-audio`), external AI API providers (Gemini, Groq Whisper)
* **Data Flow**:
  1. **AI Turn**: The system takes the prompt, queries the AI provider (with circuit breaker checks: Gemini -> Groq -> OpenAI), and speaks the generated question via `window.speechSynthesis`.
  2. **User Turn**: The microphone captures candidate response:
     * *Web Speech Mode*: Chrome processes local transcription and feeds streaming text to the turn detector.
     * *Whisper Fallback*: iOS/Firefox uploads a recorded WebM audio chunk to Deno `transcribe-audio`, which calls Groq Whisper (`whisper-large-v3-turbo`) to transcribe.
  3. **Silence Boundary**: `useTurnDetection` state machine analyzes Root-Mean-Square (RMS) audio energy, word count progression, and acoustic phrases (e.g. *"I'm done"*).
  4. **Turn Evaluation**: When silence is confirmed, the transcript is posted to `analyze-answer`. Gemini evaluates technical depth, STAR methodology compliance, and filler words, saving details to `interview_answers`. The loop then proceeds to the next question.

### 5. Session Ending & Feedback Reports
* **Client Pages**: `/report/:sessionId`
* **Backend Functions**: Deno Edge Function (`generate-feedback`), Resend API
* **Data Flow**:
  1. Once the question limit is hit, the frontend calls the `generate-feedback` function.
  2. The function aggregates the complete Q&A history, prompts Gemini 2.0 Flash to score capabilities across Technical, Communication, and Behavioral fields, and logs details in the `feedback_reports` table.
  3. The function triggers a Resend email dispatch containing the performance scorecard.
  4. The React client redirects the user to `/report/:sessionId`, rendering score visualizers, recommendations, and study roadmaps.

### 6. Agentic Self-Improvement Flywheel
* **Client Pages**: `/dashboard`
* **Backend Functions**: Deno Edge Functions (`embed-session`, `generate-prep-plan`)
* **Data Flow**:
  1. Upon feedback report generation, `embed-session` runs. It queries Gemini `text-embedding-004` to create 768-dimension vectors of the session transcripts.
  2. The vectors are saved in the database table `transcript_embeddings`.
  3. The candidate's persistent profile skill scores are updated using an Exponential Moving Average (EMA): $S_{new} = 0.7 \times S_{session} + 0.3 \times S_{old}$.
  4. The Deno Edge Function `generate-prep-plan` processes these skill levels and gaps to create a personalized 7-day preparation checklist in `prep_plans`.
  5. The `/dashboard` renders the updated plan, encouraging the user to select their next mock interview, completing the self-improvement loop.

### 7. Monetization, Subscriptions & Referrals
* **Client Pages**: `/pricing`
* **Backend Functions**: Deno Edge Functions (`create-order`, `verify-payment`), Razorpay APIs
* **Data Flow**:
  1. The user selects a Pro plan subscription (₹499/month) on `/pricing`.
  2. The client triggers the `create-order` Edge Function, generating a transaction inside Razorpay.
  3. The frontend displays the native Razorpay modal for payment processing.
  4. On completion, the frontend transmits signature parameters to `verify-payment`.
  5. The Edge Function runs a SHA256 HMAC signature validation. If valid, the user's `subscriptions` record is set to `active`, upgrading their status in `profiles` to `pro` (with founder checks as bypasses).
  6. The system checks if the user registered with a referral code. If so, a pending code is set to converted, recording 10% credit inside `referral_earnings` and emailing the referrer via Resend.
