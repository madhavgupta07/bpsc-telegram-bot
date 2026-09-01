# Bihar STET AI Quiz Platform

A production-ready, full-stack application that runs an **automated Bihar STET Computer Science daily quiz on Telegram every day at 8:00 PM IST**.

The system uses **OpenRouter AI** to generate high-quality, validated multiple-choice questions, **MongoDB** to persist questions/quizzes/student progress, **Node.js + Express + TypeScript** for the backend, **React + TypeScript** for the admin dashboard, and the **Telegram Bot API** for quiz delivery and answer collection.

---

## 1. Project Overview

Every evening the system prepares the **next day's** quiz (not at delivery time), validates the AI output, stores it in MongoDB, and then — at **8:00 PM Asia/Kolkata** — the Telegram bot delivers the quiz to subscribed users as interactive inline-keyboard messages. Users tap an answer, get instant feedback with an explanation, and receive a final score, topic-wise performance breakdown, and streak update.

The Telegram bot and scheduler run **independently** of the admin dashboard. The React dashboard is purely an administration/analytics interface.

**Production flow:**

```
MongoDB
  ↓
Daily Quiz Generator (7:00 PM IST)
  ↓
Validated Quiz → stored in MongoDB
  ↓
8:00 PM IST Scheduler → Telegram → Student
```

---

## 2. Features

- **AI question generation** via OpenRouter with strict quality validation (exactly 4 options, 1 objectively-verifiable correct answer, no duplicates, explanation match, topic relevance).
- **Automatic next-day quiz generation** at 7:00 PM + **fallback** to previously validated questions if AI fails (the daily quiz never breaks due to an AI outage).
- **Telegram bot** with `/start`, `/quiz`, `/score`, `/streak`, `/help` and inline answer buttons + explanations + next-question flow.
- **Idempotent answering** — duplicate Telegram callbacks never double-count a score.
- **Balanced question selection** with configurable topic distribution and difficulty distribution (Easy 30% / Medium 50% / Hard 20%).
- **Adaptive learning** — weaker topics are weighted higher in future quizzes.
- **Daily streak system** (current + longest) using `Asia/Kolkata` dates.
- **Leaderboard** ranked by configurable criteria (score / accuracy / streak / quizzes).
- **Admin dashboard** (React): Dashboard, Questions CRUD, Topics/subtopics, Daily Quizzes (generate/publish/preview/replace), Users, Analytics with charts.
- **JWT admin authentication** with HTTP-only cookies, password hashing, protected routes.
- **Centralized error handling, structured logging (no secrets), rate limiting, Helmet, CORS, MongoDB query sanitization.**

---

## 3. Architecture

```
bihar-stet-ai-quiz/
├── client/                 # React + TypeScript admin dashboard (Vite)
│   └── src/
│       ├── components/     # UI primitives (toast, modal, badges, spinner)
│       ├── pages/          # Login, Dashboard, Questions, Topics, Quizzes, Users, Analytics
│       ├── layouts/        # AdminLayout (sidebar + topbar)
│       ├── hooks/          # useAuth, useToast
│       ├── services/       # api client
│       ├── types/
│       └── styles.css
├── server/                 # Node.js + Express + TypeScript (MERN backend)
│   └── src/
│       ├── config/         # env, database, constants
│       ├── controllers/    # route handlers (thin)
│       ├── jobs/           # cron scheduler (7PM generate, 8PM deliver)
│       ├── middleware/     # auth, errorHandler, rateLimiter, validate
│       ├── models/         # Mongoose models
│       ├── routes/         # Express routers
│       ├── services/       # business logic (openrouter, telegram, quiz, session, delivery, generation)
│       ├── validators/     # zod schemas
│       ├── utils/          # logger, date helpers, errors, csv seed
│       └── server.ts       # entry point
├── .env.example
├── .gitignore
├── package.json            # npm workspaces (server + client)
└── README.md
```

**Key module responsibilities:**
- `services/openrouter.service.ts` — AI gateway (generation, JSON parsing, retry, validation).
- `services/questionValidation.service.ts` — hard validation layer before saving AI questions.
- `services/generation.service.ts` — orchestrates AI + validation + DB fallback to build a `DailyQuiz`.
- `services/quiz.service.ts` — balanced question selection, difficulty weighting, daily quiz creation.
- `services/session.service.ts` — quiz sessions, idempotent answer submission, scoring, statistics & streaks.
- `services/telegram.service.ts` / `telegramBot.service.ts` — Telegram API client + bot UX handler.
- `services/delivery.service.ts` — sends today's quiz to all subscribed users.
- `jobs/scheduler.ts` — cron jobs at 7:00 PM and 8:00 PM IST.

---

## 4. Tech Stack

| Layer      | Technology                                   |
|------------|----------------------------------------------|
| Frontend   | React 18, TypeScript, React Router, Recharts, Vite |
| Backend    | Node.js, Express, TypeScript                 |
| Database   | MongoDB (Mongoose ODM)                       |
| AI         | OpenRouter API (chat completions, JSON output) |
| Bot        | Telegram Bot API (webhook)                 |
| Scheduling | node-cron (`Asia/Kolkata`)                   |
| Auth       | JWT, bcryptjs, HTTP-only cookies             |
| Validation | Zod                                         |
| Tests      | Vitest + mongodb-memory-server               |

---

## 5. Installation

Requirements: **Node.js ≥ 18**, **npm ≥ 9**, a **MongoDB** instance (local or Atlas).

```bash
# 1. Clone / copy the project, then install all workspace dependencies
npm install

# 2. Configure environment (see below)
cp .env.example .env
# ... edit .env with your real values ...

# 3. Run both server and client in development
npm run dev
```

Monorepo is managed with **npm workspaces**. The `server` and `client` are installed together from the root.

---

## 6. Environment Variables

Create a `.env` in the project root (see `.env.example`):

| Variable                 | Description                                                          |
|--------------------------|----------------------------------------------------------------------|
| `NODE_ENV`               | `development` or `production`                                         |
| `PORT`                   | Backend port (default `5000`)                                         |
| `MONGODB_URI`            | MongoDB connection string                                             |
| `OPENROUTER_API_KEY`     | Your OpenRouter API key (**server only, never exposed to the client**)|
| `OPENROUTER_MODEL`       | Model id, e.g. `openai/gpt-4o-mini`                                   |
| `TELEGRAM_BOT_TOKEN`     | Token from @BotFather                                                    |
| `TELEGRAM_WEBHOOK_SECRET`| Secret used to verify incoming Telegram webhook calls                  |
| `JWT_SECRET`             | Long random secret for JWT signing                                     |
| `JWT_EXPIRES_IN`         | JWT lifetime (default `7d`)                                            |
| `ADMIN_USERNAME`         | Default admin username created on first startup (default `admin`)      |
| `ADMIN_PASSWORD`         | Default admin password (creates the admin account on first startup)    |
| `CLIENT_URL`             | e.g. `http://localhost:5173`                                           |
| `SERVER_URL`             | e.g. `http://localhost:5000`                                           |
| `CRON_TIMEZONE`          | `Asia/Kolkata`                                                         |

> `.env` is git-ignored — never commit it. All secrets (OpenRouter key, JWT secret, bot token) live only on the server.

---

## 7. MongoDB Setup

- **Local:** install MongoDB and run `mongod`, then use `mongodb://localhost:27017/bihar-stet-quiz`.
- **Atlas (recommended for production):** create a free cluster, add your IP / open access, copy the connection string into `MONGODB_URI`.

On startup the server:
1. Connects to MongoDB.
2. Seeds the default `Admin` account (from `ADMIN_USERNAME`/`ADMIN_PASSWORD` if none exists).
3. Seeds the Bihar STET topic tree (top-level subjects + subtopics like CPU Scheduling, Memory Management, etc.).

---

## 8. OpenRouter Setup

1. Create an account at [openrouter.ai](https://openrouter.ai) and generate an API key.
2. Set `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` in `.env`.
3. The key is used **only** by `server/src/services/openrouter.service.ts` — it is never bundled into the React client.

The generator requests **structured JSON output** and enforces a strict prompt so every question has exactly 4 unique options, 1 correct answer present among them, an explanation that matches, and a difficulty level. Output is parsed defensively and validated in `questionValidation.service.ts` before saving. Failed/invalid responses trigger safe retries (max 3) and, if they keep failing, the generator **falls back to already-validated questions in MongoDB**.

---

## 9. Telegram Bot Setup

1. Talk to [@BotFather](https://t.me/BotFather) on Telegram.
2. `/newbot` → name your bot → copy the **token** into `TELEGRAM_BOT_TOKEN`.
3. Choose a webhook secret and set `TELEGRAM_WEBHOOK_SECRET`.
4. Set your webhook (see next section).

**Commands implemented:** `/start`, `/quiz`, `/score`, `/streak`, `/help`.

---

## 10. Webhook Setup

In **production** the bot uses a webhook. Point Telegram to your endpoint and set the secret header:

```bash
WEBHOOK_URL=https://your-domain.com/api/telegram/webhook
SECRET=your-telegram-webhook-secret

curl -X POST "https://api.telegram.org/bot<YOUR_BOT_TOKEN>/setWebhook" \
  -H "Content-Type: application/json" \
  -d "{\"url\":\"$WEBHOOK_URL\",\"secret_token\":\"$SECRET\"}"
```

The endpoint `POST /api/telegram/webhook` verifies the `x-telegram-bot-api-secret-token` header before processing updates.

**For development** you can use `ngrok` to expose `localhost:5000` and run the same webhook command, or implement long polling by uncommenting the polling loop in `server.ts`.

---

## 11. Running Locally

```bash
# install everything from the repo root
npm install

# make sure MongoDB is running and .env is configured
cp .env.example .env   # then edit it

# run server + client together (development)
npm run dev

# or run them separately
npm run dev:server     # http://localhost:5000
npm run dev:client     # http://localhost:5173
```

Open the admin dashboard at http://localhost:5173 and sign in with `ADMIN_USERNAME` / `ADMIN_PASSWORD`.

---

## 12. Production Deployment

**Option A — separate processes** (simplest):

```bash
npm run build              # builds both server (dist) and client (dist)
NODE_ENV=production npm run start   # runs the compiled server
```

Serve the `client/dist` static files behind the Express server or a CDN / nginx, and set `CLIENT_URL` to the public origin.

**Option B — single server** (recommended): after `npm run build`, have Express serve `client/dist` (add a static handler in `server.ts` if desired) and rely on the cron scheduler.

Deployment notes:
- Use a process manager like **PM2** or a container (Docker) so the process (and therefore the cron scheduler) stays alive.
- Point `TELEGRAM_BOT_TOKEN` to the production bot and configure the webhook to `https://<your-domain>/api/telegram/webhook`.
- Set `CLIENT_URL`, `SERVER_URL`, `NODE_ENV=production`, and production secrets.

---

## 13. Scheduler Configuration

Configured in `server/src/jobs/scheduler.ts` and `server/src/config/constants.ts`, using `node-cron` with an explicit `Asia/Kolkata` timezone:

- **`0 19 * * *` (7:00 PM IST)** — generate + validate tomorrow's quiz. Creates a unique `DailyQuiz` keyed by date (e.g. `2026-09-01`); re-running never creates duplicates.
- **`0 20 * * *` (8:00 PM IST)** — deliver today's published quiz to all subscribed, active Telegram users.

The scheduler never relies on the server's local timezone — it always uses the configured `CRON_TIMEZONE` (`Asia/Kolkata`). If the process restarts mid-day, the unique-date check prevents duplicate quiz delivery daily.

To change the delivery time, edit `QUIZ_GENERATION_CRON` / `QUIZ_DELIVERY_CRON` in `constants.ts`.

---

## 14. API Documentation

All admin endpoints (except auth/login) require a valid JWT (HTTP-only cookie or `Authorization: Bearer <token>`).

### Auth
| Method | Endpoint        | Description                        |
|--------|-----------------|------------------------------------|
| POST   | `/api/auth/login`| Authenticate admin, issue JWT cookie |
| POST   | `/api/auth/logout`| Clear session cookie               |
| GET    | `/api/auth/me`  | Return current admin               |

### Questions
| Method | Endpoint            | Description                        |
|--------|---------------------|------------------------------------|
| GET    | `/api/questions`    | List with `page,limit,search,topic,difficulty,verified` |
| GET    | `/api/questions/:id`| Get one                            |
| POST   | `/api/questions`    | Create (manual)                    |
| PATCH  | `/api/questions/:id`| Update                             |
| DELETE | `/api/questions/:id`| Deactivate                         |
| PATCH  | `/api/questions/:id/verify`| Mark verified              |

### Topics
| Method | Endpoint     | Description      |
|--------|--------------|------------------|
| GET    | `/api/topics`| List topics      |
| GET    | `/api/topics/tree`| Nested topic tree |
| POST   | `/api/topics`| Create (optionally under a parent) |
| PATCH  | `/api/topics/:id`| Update        |
| DELETE | `/api/topics/:id`| Deactivate    |

### Daily Quizzes
| Method | Endpoint           | Description                          |
|--------|--------------------|--------------------------------------|
| GET    | `/api/quizzes`     | List quizzes                         |
| GET    | `/api/quizzes/today` | Today's active quiz (if any)       |
| GET    | `/api/quizzes/:date` | Quiz detail + questions             |
| GET    | `/api/quizzes/:date/preview` | Preview question set        |
| POST   | `/api/quizzes/generate` | Generate a quiz (date, counts, distributions) |
| POST   | `/api/quizzes/:date/regenerate` | Regenerate a quiz        |
| PATCH  | `/api/quizzes/:date/publish` | Publish for delivery       |
| PATCH  | `/api/quizzes/:date/unpublish` | Unpublish               |
| POST   | `/api/quizzes/:date/replace-question` | Swap a question in a quiz |

### Users / Statistics / Analytics
| Method | Endpoint                                     | Description                |
|--------|----------------------------------------------|----------------------------|
| GET    | `/api/users`                                 | List users + stats         |
| GET    | `/api/statistics/dashboard`                  | Dashboard aggregate stats  |
| GET    | `/api/statistics/leaderboard?criteria=accuracy` | Leaderboard          |
| GET    | `/api/statistics/analytics/participation?days=30` | Daily participation |
| GET    | `/api/statistics/analytics/topics`           | Per-topic accuracy          |
| GET    | `/api/statistics/analytics/questions`        | Question performance        |

### Telegram
| Method | Endpoint               | Description                  |
|--------|------------------------|------------------------------|
| POST   | `/api/telegram/webhook`| Telegram webhook (secret-verified) |

Health check: `GET /api/health`.

---

## 15. Testing

```bash
npm run test          # runs vitest in server workspace
```

Tests cover critical business logic using an in-memory MongoDB:

- **Quiz:** question selection (topic distribution, no duplicates, no deactivated, difficulty spread), daily quiz creation, duplicate-date prevention.
- **Sessions/Scoring:** start → answer → score calculation, duplicate-answer idempotency, completion.
- **Streaks:** first quiz, same-day multiple attempts, missed day.
- **AI validation:** valid response, missing/multiple options, duplicate options, absent correct answer, missing explanation, invalid difficulty, single-question DB validation.
- **OpenRouter guard:** throws a clear, safe error when the API key is unset.

---

## 16. Troubleshooting

| Problem | Likely cause / fix |
|---------|--------------------|
| `OPENROUTER_API_KEY` error on generation | Set `OPENROUTER_API_KEY` in `.env` and restart. Even without it, the system falls back to DB questions. |
| Bot doesn't reply | Check `TELEGRAM_BOT_TOKEN`, set the webhook (sec. 10), or enable long polling in development. |
| 8 PM quiz not delivered | Confirm the process keeps running (PM2/Docker) and that `CRON_TIMEZONE=Asia/Kolkata`. Check logs for delivery errors. |
| Today's quiz says "not available" | The 7 PM job generates the **next day's** quiz; a fresh install needs a quiz published for today (use the admin → "Generate Tomorrow", or the manual generate API). |
| Webhook 401 | `TELEGRAM_WEBHOOK_SECRET` in `.env` must match the `secret_token` set via `setWebhook`. |
| `MongoServerSelectionError` | MongoDB not running / URI wrong. Verify `mongod` or Atlas reachability. |
| Duplicate score | Shouldn't happen — answer submission is idempotent (verified by tests). Check your bot version is current. |

---

## Security Notes

- API keys, JWT secrets, and bot tokens live **only** in server env; never in the React bundle.
- Admin APIs are protected by JWT (HTTP-only cookie + bearer) and rate-limited.
- Inputs are validated with Zod; MongoDB operators are sanitized (`express-mongo-sanitize`); Helmet hardens headers; CORS is restricted to `CLIENT_URL`.
- Structured logging redacts sensitive fields and never logs tokens, passwords, or API keys.
