# BacPrep — AI-Powered Bac II Exam Prep via Telegram

**Date:** 2026-04-20
**Status:** Design approved, pending implementation plan
**Author:** Soley + Claude

---

## 1. Problem

Every year, 100,000+ Cambodian Grade 12 students take the Bac II national exam. Students study 8-12 hours daily. Families pay for private tutoring. The pass rate is ~73%, meaning ~27,000 students fail every year.

The existing tools are broken:
- **Khmer Bac II app** (500K+ downloads) — content stopped updating in 2019. Static past papers with answer keys. No explanations.
- **E-School Cambodia** (500K+ downloads) — video lessons that don't load. 82 students upvoted a complaint about buffering.

No tool exists that explains *why* an answer is correct, generates practice variations, or meets students where they already are — Telegram.

## 2. Product

**BacPrep** is a Telegram Mini App + Bot for Bac II exam practice. Students take timed quizzes inside Telegram, get instant explanations, share results in group chats, and track their progress.

### What BacPrep IS
- Bac II exam practice tool (quizzes with explanations)
- Telegram-native (Mini App + Bot, no separate download)
- AI-assisted content pipeline (not AI-assisted tutoring — that's Phase 2)
- Focused on the 3 most AI-friendly subjects first (Physics, Math, English)

### What BacPrep is NOT
- Not a course platform (no lessons, no curriculum, no modules)
- Not an LMS (no enrollment, no instructor roles, no admin panels)
- Not a general AI chatbot
- Not a web app (Telegram is the product)

### Target user
Grade 11-12 Cambodian students preparing for Bac II. Starting with science-track students (Physics + Math).

### Core value proposition
Existing apps give you static past papers. BacPrep gives you quizzes with explanations — and it lives inside the Telegram groups where you already study with friends.

## 3. User Experience

### Discovery
A student sees a result card shared in their class Telegram group:

> BacPrep — Physics 2023
> Sokha scored 8/10
> Strong: Kinetic Theory | Weak: Optics
> Try it yourself [link]

### First use
They tap the link. Mini App opens inside Telegram. No signup — Telegram identity is the account. They see:

- Pick a subject (Physics, Math, English)
- Pick a mode: Quick Practice (10 questions) or Full Mock
- Start quiz

### Taking a quiz
- 10 questions per quick practice, timed
- Questions from past papers (2011-2024) or AI-generated variations (Phase 2+)
- Question types (MVP): MCQ, True/False, Fill in the Blank
- After each answer: show if correct/wrong + explanation

### After the quiz
- Score card: 8/10, breakdown by topic
- "Share your result" button — generates visual card posted to chat
- Wrong answers saved for review

### The bot layer
- `/practice` — opens the Mini App
- `/stats` — your progress summary
- Daily reminder: "Bac II is X days away. Practice today?"
- Weekly summary: "You practiced 4/7 days. Strongest: Algebra. Weakest: Optics."

### Future (not MVP)
- Photo of a problem → AI explains it
- "Explain this differently" → RAG-powered follow-up
- AI-generated practice variations
- Leaderboards per school/group

## 4. Monetization

Families already pay for Bac II tutoring ($30-100+/month). BacPrep is a fraction of that cost.

### Free tier
- 5 practice questions per day
- 1 subject (Physics)
- See score after quiz
- Basic explanations

### Paid tier ($2-3/month via Telegram Stars)
- Unlimited practice questions
- All 3 subjects (Physics, Math, English)
- Detailed explanations
- Full mock exams
- Progress tracking and weak-topic analysis

### Payment method
Telegram Stars — built into Telegram, no external payment integration needed for MVP. ABA Bank / KHQR can be added later for users who prefer direct payment.

## 5. Technical Architecture

### Stack

| Layer | Choice | Reason |
|-------|--------|--------|
| Telegram Bot | Node.js + Grammy | Lightweight, great TypeScript support |
| Telegram Mini App | Next.js (App Router) | Known stack, Vercel deploys instantly |
| Database | Supabase (PostgreSQL) | Already used, proven |
| AI (Phase 2+) | Claude API | Already have Anthropic SDK experience |
| Hosting | Vercel | Already used, Fluid Compute for webhook |
| Payments | Telegram Stars | Built-in, no external integration |

### System diagram

```
Student in Telegram
    |
    +-- Bot (Grammy on Vercel)
    |   +-- /practice -> sends Mini App link
    |   +-- /stats -> progress summary
    |   +-- Daily reminders (cron)
    |   +-- Weekly summary (cron)
    |
    +-- Mini App (Next.js on Vercel)
        +-- Pick subject -> Pick quiz type
        +-- Take timed quiz
        +-- See results + explanations
        +-- Share result card
        +-- Upgrade to paid (Telegram Stars)
            |
            v
        Supabase
            +-- subjects
            +-- topics
            +-- questions
            +-- quiz_attempts
            +-- user_progress
            +-- users
```

### Database schema

```sql
-- 6 tables. No more.

CREATE TABLE subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,           -- "Physics", "Math", "English"
  name_km TEXT NOT NULL,        -- Khmer name
  slug TEXT NOT NULL UNIQUE,    -- "physics", "math", "english"
  icon TEXT,                    -- emoji or icon reference
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  name TEXT NOT NULL,           -- "Kinetic Theory of Gases"
  name_km TEXT NOT NULL,        -- Khmer name
  slug TEXT NOT NULL,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  topic_id UUID NOT NULL REFERENCES topics(id),
  type TEXT NOT NULL CHECK (type IN ('mcq', 'true_false', 'fill_blank')),
  year INT,                     -- exam year if from past paper, null if AI-generated
  difficulty INT DEFAULT 2 CHECK (difficulty BETWEEN 1 AND 3),
  question_km TEXT NOT NULL,    -- question text in Khmer
  question_en TEXT,             -- optional English translation
  options JSONB,                -- ["A. ...", "B. ...", "C. ...", "D. ..."] for MCQ
  correct_answer TEXT NOT NULL, -- "A", "true", or the fill-blank answer
  explanation_km TEXT,          -- explanation in Khmer
  explanation_en TEXT,          -- optional English explanation
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_id BIGINT NOT NULL UNIQUE,
  name TEXT,
  is_paid BOOLEAN DEFAULT false,
  paid_until TIMESTAMPTZ,
  daily_question_count INT DEFAULT 0,
  daily_reset_at DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quiz_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  score INT NOT NULL,
  total INT NOT NULL,
  answers JSONB NOT NULL,       -- [{question_id, user_answer, correct, topic_id}]
  duration_seconds INT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE user_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id),
  subject_id UUID NOT NULL REFERENCES subjects(id),
  topic_id UUID NOT NULL REFERENCES topics(id),
  correct_count INT DEFAULT 0,
  total_count INT DEFAULT 0,
  last_practiced_at TIMESTAMPTZ,
  UNIQUE(user_id, subject_id, topic_id)
);
```

### API routes (Mini App)

```
POST /api/quiz/start     — get 10 random questions for subject/topic
POST /api/quiz/submit    — grade answers, save attempt, update progress
GET  /api/progress       — user's stats by subject/topic
GET  /api/share-card     — generate result card image
POST /api/payments/verify — verify Telegram Stars payment
```

5 routes. Not 28 (Contrib) or 34 (Acadex).

## 6. Content Pipeline

### Source
Past Bac II exam papers (2011-2024), publicly available in the Khmer Bac II app and Facebook study groups. Content is in Khmer.

### Workflow

1. **You type** questions + correct answers in a Google Sheet (Khmer renders properly there)
2. **Columns:** subject | topic | year | type | question_km | option_a | option_b | option_c | option_d | correct | explanation_km
3. **Export** as CSV
4. **Import script** reads CSV, inserts into Supabase `questions` table

### MVP content target
- 50 Physics questions across 5-6 topics
- ~2.5 hours of focused typing
- Enough for students to take 5 different quizzes without seeing repeats

### Content expansion (Phase 2+)
- Add Math + English (total 300 questions)
- AI generates wrong options from correct answers (speeds up entry)
- AI generates question variations from seed questions
- AI generates explanations from correct answers

## 7. Phasing

### Phase 1 — Prove it works (2 weeks)

| Task | What | Time |
|------|------|------|
| Content | 50 Physics MCQs in Google Sheets | 3-4 evenings |
| Database | Supabase schema (6 tables) + CSV import script | 1 day |
| Bot | Grammy bot with /practice command, webhook on Vercel | 1-2 days |
| Mini App | Next.js inside Telegram WebApp SDK | 1-2 days |
| Quiz flow | Pick topic, 10 questions, timer, score, explanations | 2-3 days |
| Share card | Generate shareable result image | 1 day |
| Test | Test with real students | 1-2 days |

**Phase 1 success signal:** Students share their result cards in group chats and other students try the quiz organically.

**Phase 1 explicitly excludes:** Payments, progress tracking, AI explanations, multiple subjects, RAG, leaderboards, admin panel.

### Phase 2 — Make it real (2-3 weeks, only after Phase 1 signal)

| Task | What |
|------|------|
| Content | Expand to Math + English (300 total questions) |
| Progress | Streaks, weak topics, score history |
| Payments | Telegram Stars — free tier (5/day) vs paid (unlimited) |
| Bot nudges | Daily reminder, weekly summary |
| AI assist | Claude generates wrong options + explanations in content pipeline |

**Phase 2 success signal:** Paying users exist.

### Phase 3 — Grow (only after paying users)

| Task | What |
|------|------|
| RAG | Student asks follow-up → AI explains using question bank as context |
| AI generation | Multiply question bank with variations |
| More subjects | Chemistry, Biology, History, Geography |
| More quiz types | Matching, ordering, image-based |
| Photo explain | Student sends photo of problem → AI explains |
| Leaderboards | Top scorers per school/group |

## 8. What's Different This Time

| Past mistake | BacPrep fix |
|-------------|-------------|
| Contrib: built for groups (need 3-4 people to get value) | Single-user value from first quiz |
| Acadex: 305 files, 132 components before any users | Phase 1 is ~15 files |
| Both: web apps requiring signup and onboarding | Zero friction — opens inside Telegram, no signup |
| Both: built features for months before testing with users | Phase 1 ships in 2 weeks, tested immediately |
| Both: no viral mechanic | Share card → friends try it → built-in growth loop |
| Both: no monetization path | Telegram Stars + families already pay for tutoring |
| Content: Acadex failed because no content | Content is public (past papers) + small seed (50 questions) |

## 9. Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Khmer content entry is slow and tedious | Start with only 50 questions. Google Sheets workflow. AI assists in Phase 2. |
| Students don't share results | Test share card design with real students. Make results feel like an achievement, not a score. |
| Telegram Mini App has technical limitations | Build a minimal prototype first to validate the SDK works for quiz UIs. |
| Competition copies the idea | Your moat is Khmer content that requires manual work. Generic AI tools can't replicate it. |
| Students only use it right before exam (seasonal) | That's fine. Bac II is every August. Grade 11 students start prepping months early. Seasonal is a feature, not a bug. |
| 50 questions isn't enough | It's enough for Phase 1 validation. If students want more, that's your signal to invest in content. |

## 10. Open Questions

1. **Exam format by subject:** Do all Bac II subjects have a standard format, or does it vary by year? This affects how questions are structured.
2. **Science vs Social track:** Should Phase 1 focus on science track only, or include social track subjects?
3. **Khmer-only or bilingual?** Should explanations be in Khmer only, or Khmer + English? (English might help students studying for the English exam too.)
4. **Telegram Stars availability in Cambodia:** Need to verify Telegram Stars payments work for Cambodian users. If not, ABA/KHQR is the fallback.
5. **Mini App size limits:** Telegram Mini Apps have some constraints on bundle size and capabilities. Need to verify the quiz UI works smoothly within those limits.

---

*End of spec. Version 1.0 — 2026-04-20.*
