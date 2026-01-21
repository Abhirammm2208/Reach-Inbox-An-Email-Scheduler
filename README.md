# ReachInbox Email Scheduler

A production-ready email scheduling system with BullMQ job queue, Redis-backed rate limiting, and real-time tracking. Built with Next.js 16, React 19, Express, TypeORM, PostgreSQL, and Redis.

---

## ✨ Features

- ✅ **BullMQ Scheduling** - No cron, persistent delayed jobs
- ✅ **Rate Limiting** - Per-sender and global limits with Redis counters
- ✅ **Worker Concurrency** - Configurable parallel job processing
- ✅ **Persistent State** - Survives server restarts, no job loss
- ✅ **Rich Text Editor** - HTML formatting with toolbar
- ✅ **File Attachments** - 5MB limit with base64 encoding
- ✅ **CSV Upload** - Bulk email import
- ✅ **Google OAuth** - NextAuth authentication
- ✅ **Real-time Updates** - Auto-refresh every 5 seconds

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- PostgreSQL (local installation)
- Redis (local installation)
- Ethereal Email account (https://ethereal.email)

### Installation

**Backend:**
```powershell
cd backend
npm install
copy .env.example .env
# Edit .env with your credentials
npm run dev
```

**Frontend:**
```powershell
cd frontend
npm install
copy .env.local.example .env.local
npm run dev
```

**Access:**
- Frontend: http://localhost:3000
- API: http://localhost:3001

---

## 🔧 Configuration

### Backend `.env`
```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/reachinbox
REDIS_URL=redis://localhost:6379
PORT=3001
CORS_ORIGIN=http://localhost:3000

# Ethereal Email SMTP (get from https://ethereal.email)
ETHEREAL_USER=your-user@ethereal.email
ETHEREAL_PASS=your-password

# Rate Limits (configurable)
MAX_EMAILS_PER_HOUR_PER_SENDER=100
MAX_EMAILS_PER_HOUR=500

# Worker Configuration (configurable)
WORKER_CONCURRENCY=2
DELAY_BETWEEN_SENDS_MS=2000
```

### Frontend `.env.local`
```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-change-in-production

# Google OAuth (optional)
NEXT_PUBLIC_GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

---

## 🏗 Architecture

```
Frontend (Next.js) → Express API → PostgreSQL
                         ↓
              Scheduler Service (1 min check)
                         ↓
              BullMQ Queue (Redis) → Worker → SMTP (Ethereal)
```

### Email Flow

1. **Schedule:** User submits via frontend → API saves to PostgreSQL (status: pending)
2. **Queue:** Scheduler checks DB every 1 minute → Queues jobs to BullMQ when time arrives
3. **Process:** Worker pulls jobs → Checks rate limits → Sends via SMTP → Updates DB (status: sent)
4. **Persist:** All jobs stored in Redis, survives restarts, BullMQ auto-recovers

---

## 📊 API Endpoints

**Base URL:** `http://localhost:3001/api`

### `POST /schedule`
Schedule emails for future delivery

**Request:**
```json
{
  "subject": "Welcome",
  "body": "Hi {{email}}",
  "emails": ["user1@example.com", "user2@example.com"],
  "senderEmail": "noreply@reachinbox.com",
  "startTime": "2026-01-22T10:00:00Z",
  "delayBetweenSends": 2000,
  "hourlyLimit": 100,
  "attachments": [
    {
      "filename": "image.png",
      "content": "base64-encoded-content",
      "contentType": "image/png",
      "size": 12345
    }
  ]
}
```

### `POST /send`
Send emails immediately (no scheduling)

**Request:** Same as `/schedule` but without `startTime`

### `GET /scheduled?limit=20&offset=0`
List scheduled email batches

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "senderEmail": "noreply@reachinbox.com",
      "subject": "Welcome",
      "recipientEmails": ["user1@example.com"],
      "scheduledAt": "2026-01-22T10:00:00Z",
      "status": "pending|processing|completed",
      "sentCount": 0,
      "failedCount": 0
    }
  ],
  "total": 1
}
```

### `GET /sent?limit=20&offset=0`
List sent emails

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "recipientEmail": "user1@example.com",
      "subject": "Welcome",
      "status": "sent|failed",
      "etherealUrl": "https://ethereal.email/message/...",
      "sentAt": "2026-01-22T10:01:00Z"
    }
  ],
  "total": 1
}
```

### `GET /stats`
Get email statistics

**Response:**
```json
{
  "totalEmailsCreated": 100,
  "emailsSent": 95,
  "emailsFailed": 5,
  "pendingSchedules": 10
}
```

### `GET /pending?limit=20&offset=0`
List pending emails (not yet sent)

---

## 🔐 Rate Limiting Implementation

### How It Works

- **Redis Counters:** Atomic operations, safe across multiple workers
- **Sliding Windows:** 1-hour buckets (e.g., `2026-01-22-10` = 10:00-10:59)
- **Two Limits:**
  - Per-sender: `MAX_EMAILS_PER_HOUR_PER_SENDER=100`
  - Global: `MAX_EMAILS_PER_HOUR=500`
- **Overflow Handling:** Jobs delayed to next hour window (never dropped)

### Keys Structure
```
rate_limit:sender@example.com:2026-01-22-10  → 100 (expires in 3600s)
rate_limit:global:2026-01-22-10               → 500 (expires in 3600s)
```

### High Volume Scenario (1000 Emails)

**Config:** `MAX_EMAILS_PER_HOUR_PER_SENDER=100`

**Behavior:**
- Hour 1: First 100 emails sent
- Hour 2: Next 100 emails sent
- ...continues until all complete
- Order preserved within each hour window
- All jobs stored in Redis (no memory overload)

---

## ⚙️ Worker Concurrency

- **Configurable:** `WORKER_CONCURRENCY=2` (processes 2 jobs in parallel)
- **Inter-send Delay:** `DELAY_BETWEEN_SENDS_MS=2000` (2 seconds between emails)
- **Safe:** BullMQ handles job locking, prevents duplicate processing

---

## 🔄 Persistence & Restart Resilience

### How Jobs Survive Restarts

1. **PostgreSQL:** Stores all email records with status
2. **Redis:** BullMQ persists job state (with AOF enabled)
3. **On Restart:**
   - Scheduler re-scans DB for `pending` emails
   - BullMQ auto-recovers jobs from Redis
   - No jobs lost, no duplicates

### Idempotency

- Unique `jobId` per email: `${emailId}-${timestamp}`
- Status guards: Only `pending` emails queued
- Once `sent`, never re-queued

---

## 🗂 Database Schema

### Email
```
id (UUID), recipientEmail, senderEmail, subject, body,
attachments (JSON), status (pending|sent|failed),
jobId, sentAt, createdAt, updatedAt
```

### ScheduledEmail
```
id (UUID), senderEmail, subject, body,
recipientEmails (Array), scheduledAt,
status (pending|processing|completed),
delayBetweenSendMs, hourlyLimit,
sentCount, failedCount, createdAt, updatedAt
```

### SentEmail (Audit Log)
```
id (UUID), scheduledEmailId, recipientEmail,
senderEmail, subject, body, status (sent|failed),
etherealUrl, errorMessage, sentAt
```

---

## 📁 Project Structure

```
backend/
├── src/
│   ├── api/routes.ts              # REST endpoints
│   ├── scheduler/
│   │   ├── queue.ts               # BullMQ + Redis
│   │   ├── worker.ts              # Email sending logic
│   │   ├── rateLimit.ts           # Rate limiting
│   │   └── schedulerService.ts    # DB polling service
│   ├── db/
│   │   ├── connection.ts          # TypeORM setup
│   │   └── entities/              # Email, ScheduledEmail, SentEmail
│   ├── services/email.service.ts  # Nodemailer + Ethereal
│   ├── config.ts                  # Environment config
│   └── index.ts                   # Express server

frontend/
├── app/
│   ├── page.tsx                   # Login page
│   ├── dashboard/page.tsx         # Main dashboard
│   └── api/auth/[...nextauth]/    # NextAuth config
├── components/
│   ├── ComposeEmailModal.tsx      # Compose form
│   ├── EmailTable.tsx             # Email list
│   ├── Sidebar.tsx                # Navigation
│   └── Header.tsx                 # User info
└── lib/api.ts                     # API client
```

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js 16, React 19, TypeScript, TailwindCSS |
| **State** | TanStack Query (React Query) |
| **Auth** | NextAuth (Google OAuth) |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL |
| **ORM** | TypeORM |
| **Queue** | BullMQ |
| **Cache** | Redis |
| **Email** | Nodemailer + Ethereal SMTP |

---

## 📝 Key Design Decisions

### Why BullMQ (Not Cron)?
- ✅ Persistent (survives restarts)
- ✅ Portable (works on Windows/Linux/Mac)
- ✅ Job tracking (progress, failures, retries)
- ✅ Horizontal scaling support
- ❌ Cron: OS-dependent, no persistence, no retry logic

### Why Redis for Rate Limiting?
- ✅ Atomic operations (no race conditions)
- ✅ TTL support (auto-cleanup)
- ✅ Fast (<1ms per check)
- ✅ Works across multiple workers

### Why Three Database Tables?
- **Email:** Individual tracking (pending → sent)
- **ScheduledEmail:** Batch metadata
- **SentEmail:** Immutable audit log

---

## 🔍 Usage Examples

### Schedule Emails via Dashboard
1. Login with Google OAuth (or demo mode)
2. Click "Compose" button
3. Fill subject, body (use rich text toolbar)
4. Upload CSV or enter emails manually
5. Click clock icon → Select time → "Schedule"

### Upload CSV Format
```csv
user1@example.com
user2@example.com
user3@example.com
```
Or with names:
```csv
John,john@example.com
Jane,jane@example.com
```

### View Sent Emails
1. Click "Sent" tab
2. Click any email for details
3. Click "View in Ethereal" to see actual email

---

## ⚠️ Important Notes

- **Ethereal Email:** All emails sent to fake SMTP (safe for testing)
- **Scheduler Interval:** Checks DB every 1 minute
- **Time Format:** All times in UTC (ISO 8601)
- **Attachment Limit:** 5MB per file
- **CSV Limit:** No hard limit, tested with 1000+ emails

---

## 🛠 Troubleshooting

### Backend won't start
- Check PostgreSQL is running on port 5432
- Check Redis is running on port 6379
- Verify `.env` has correct `DATABASE_URL` and `REDIS_URL`
- Check Ethereal credentials in `.env`

### Emails not sending
- Wait 1 minute (scheduler check interval)
- Check backend logs for errors
- Verify `ETHEREAL_USER` and `ETHEREAL_PASS` in `.env`
- Restart backend: `npm run dev`

### Frontend connection error
- Ensure backend is running on port 3001
- Verify `NEXT_PUBLIC_API_URL=http://localhost:3001` in `.env.local`
- Check browser console (F12) for errors

### Rate limit not working
- Ensure Redis is running
- Check `REDIS_URL` in backend `.env`
- Verify rate limit config values are numbers (not strings)

---

## 📚 Additional Documentation

- [REQUIREMENTS_ANALYSIS.md](REQUIREMENTS_ANALYSIS.md) - Requirements compliance checklist
- [DEMO_SCRIPT.md](DEMO_SCRIPT.md) - 5-minute video demo guide
- [SAMPLE_EMAILS.csv](SAMPLE_EMAILS.csv) - Test data

---

**Built for ReachInbox Assignment**  Production-Ready
