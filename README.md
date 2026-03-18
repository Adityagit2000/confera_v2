# Confera — AI-Powered Interview Preparation Platform

<div align="center">


**Transform your interview preparation with AI-driven mock interviews, ATS resume analysis, and personalized feedback reports.**

[Live Demo](#) • [Features](#features) • [Tech Stack](#tech-stack) • [Getting Started](#getting-started)

</div>

---

## 🎯 What is Confera?

Confera is a full-stack AI-powered interview preparation SaaS platform built for students and professionals targeting top-tier companies. It combines:

- 🤖 **AI Mock Interviews** — Voice and text-based interviews powered by Gemini 2.0 Flash and Groq LLaMA 3.3
- 📄 **ATS Resume Analysis** — Upload your resume and get an ATS compatibility score with detailed feedback
- 🎙️ **Voice Interview Experience** — Speak your answers using Web Speech API, AI responds with voice
- 📊 **Detailed Feedback Reports** — Scores across technical, communication, behavioral dimensions
- 💳 **Subscription System** — Free and Pro plans with Razorpay payment integration (UPI, Cards, Netbanking)

---

## ✨ Features

### 🎤 AI Mock Interviews
- 6 interview types: DSA, System Design, HR & Behavioral, Decision Analytics (ZS Associates), Consulting (McKinsey/BCG/Bain), Business Analyst
- Specialized **McKinsey Data Engineer** interview track covering SQL, Python, PySpark, LLMs, Vector DB, and Agentic AI
- Dynamic question generation based on your resume and experience level
- Progressive difficulty — questions adapt based on your answers
- Voice-first experience using Web Speech API

### 📄 Resume ATS Analysis
- Upload PDF resume and get instant ATS compatibility score (0-100)
- Identifies missing keywords with importance scores
- Extracts skills, experience, education automatically
- Powered by Google Gemini 2.0 Flash with native PDF understanding
- Groq LLaMA 3.3 fallback for high availability

### 📊 Performance Reports
- Detailed scoring across Technical, Communication, Behavioral dimensions
- McKinsey Readiness Assessment for DE track
- Personalized study plan based on gaps identified
- Strengths and improvement areas with actionable next steps

### 💳 Subscription & Payments
- **Free Plan**: 2 interviews/month, 1 resume analysis/month
- **Pro Plan**: Unlimited interviews and analyses, detailed reports
- Razorpay integration with UPI, QR code, Cards, Netbanking, EMI
- Automated usage tracking and limit enforcement

---

## 🛠 Tech Stack

### Frontend
| Technology | Purpose |
|-----------|---------|
| React 18 + TypeScript | UI framework |
| Vite | Build tool and dev server |
| Tailwind CSS | Styling |
| Shadcn UI + Radix UI | Component library |
| React Router v6 | Client-side routing |
| Web Speech API | Voice recognition and synthesis |

### Backend
| Technology | Purpose |
|-----------|---------|
| Supabase | Database, Auth, Storage, Edge Functions |
| PostgreSQL | Primary database with RLS |
| Supabase Storage | Resume PDF storage |
| Deno (Edge Functions) | Serverless backend logic |

### AI & Payments
| Technology | Purpose |
|-----------|---------|
| Google Gemini 2.0 Flash | Primary AI — resume analysis and interviews |
| Groq LLaMA 3.3 70B | Fallback AI — high availability |
| Razorpay | Payment processing (UPI, Cards, Netbanking) |

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ and npm
- Supabase account
- Google Gemini API key (free at aistudio.google.com)
- Groq API key (free at console.groq.com)
- Razorpay account (for payments)

### Installation
```bash
# Clone the repository
git clone https://github.com/yourusername/confera.git

# Navigate to project directory
cd confera

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
```

### Environment Variables

Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
VITE_RAZORPAY_KEY_ID=rzp_test_your_key_id
```

### Supabase Setup
```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project
supabase link --project-ref your_project_ref

# Set required secrets
npx supabase secrets set GEMINI_API_KEY=your_gemini_key
npx supabase secrets set GROQ_API_KEY=your_groq_key
npx supabase secrets set RAZORPAY_KEY_ID=your_razorpay_key_id
npx supabase secrets set RAZORPAY_KEY_SECRET=your_razorpay_secret

# Deploy edge functions
npx supabase functions deploy analyze-resume --no-verify-jwt
npx supabase functions deploy ai-interview-chat --no-verify-jwt
npx supabase functions deploy generate-feedback --no-verify-jwt
npx supabase functions deploy create-order --no-verify-jwt
npx supabase functions deploy verify-payment --no-verify-jwt
```

### Run Locally
```bash
npm run dev
```

Open http://localhost:8080 in your browser.

---

## 📁 Project Structure
```
confera/
├── src/
│   ├── components/          # Reusable UI components
│   │   ├── ui/             # Shadcn UI components
│   │   ├── Header.tsx      # Navigation header
│   │   ├── ResumeUpload.tsx # Resume upload and analysis
│   │   └── ...
│   ├── pages/              # Page components
│   │   ├── Index.tsx       # Landing page
│   │   ├── Dashboard.tsx   # User dashboard
│   │   ├── InterviewSession.tsx  # AI interview interface
│   │   ├── Report.tsx      # Feedback report
│   │   └── Pricing.tsx     # Subscription plans
│   ├── hooks/              # Custom React hooks
│   │   ├── useAuth.tsx     # Authentication hook
│   │   └── useSubscription.ts  # Subscription management
│   └── integrations/
│       └── supabase/       # Supabase client and types
├── supabase/
│   ├── functions/          # Edge functions
│   │   ├── analyze-resume/ # PDF analysis with Gemini
│   │   ├── ai-interview-chat/  # Interview AI logic
│   │   ├── generate-feedback/  # Report generation
│   │   ├── create-order/   # Razorpay order creation
│   │   └── verify-payment/ # Payment verification
│   └── migrations/         # Database migrations
└── public/                 # Static assets
```

---

## 🎯 Interview Types

| Type | Target Role | Key Topics |
|------|-------------|------------|
| DSA | Software Engineer | Algorithms, Data Structures, Complexity |
| System Design | Senior Engineer | Architecture, Scalability, Trade-offs |
| HR & Behavioral | All Roles | STAR method, Cultural fit |
| Decision Analytics | ZS Associates DAA | Analytics, Pharma cases, SQL |
| Consulting | McKinsey/BCG/Bain | Case studies, Market sizing, MECE |
| Business Analyst | Product Companies | Requirements, Stakeholders, Data |
| McKinsey DE | Data Engineer | SQL, PySpark, LLMs, Vector DB, Agents |

---

## 💰 Pricing

| Feature | Free | Pro (₹499/month) |
|---------|------|-----------------|
| Mock Interviews | 2/month | Unlimited |
| Resume Analysis | 1/month | Unlimited |
| Interview Types | All 7 types | All 7 types |
| Feedback Reports | Basic | Detailed + McKinsey Readiness |
| Voice Interview | ✅ | ✅ |
| PDF Report Download | ❌ | ✅ |

---

## 🔒 Security

- Row Level Security (RLS) on all Supabase tables
- JWT authentication for all API calls
- Razorpay payment signature verification
- API keys stored only in Supabase secrets — never in frontend code
- Storage bucket policies restricting access to own files only

---

## 🤝 Contributing

This project was built as part of a startup initiative. Contributions, issues and feature requests are welcome.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 👨‍💻 Built By

**Aditya Jha**
- Building Confera to help students crack their dream interviews
- Targeting McKinsey Data Engineer and ZS Associates DAA roles

---


<div align="center">
Made with ❤️ for students who refuse to settle
</div>