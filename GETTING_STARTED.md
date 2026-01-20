# Getting Started with ReachInbox Email Scheduler

Welcome! This guide will get you up and running in **5-10 minutes**.

## 📋 Prerequisites Checklist

Before starting, make sure you have:

- [ ] **Node.js 18+** - Check with: `node --version`
- [ ] **Docker** - Check with: `docker --version`
- [ ] **Docker Compose** - Check with: `docker-compose --version`
- [ ] **Git** (optional, for version control)

Don't have these? Install them:
- Node.js: https://nodejs.org/ (LTS version)
- Docker Desktop: https://www.docker.com/products/docker-desktop

## 🚀 Installation (Choose One)

### Option A: Automated Setup (Recommended)

**Windows:**
```batch
quick-start.bat
```

**macOS/Linux:**
```bash
chmod +x quick-start.sh
./quick-start.sh
```

Then skip to **Step 4: Add Ethereal Credentials**

### Option B: Manual Setup (Recommended for Learning)

Follow steps 1-4 below.

## 📚 Manual Setup Steps

### Step 1: Start Docker Services

```bash
docker-compose up -d
```

This starts:
- **PostgreSQL** database on `localhost:5432`
- **Redis** cache/queue on `localhost:6379`

**Verify:**
```bash
docker ps
# You should see 2 running containers
```

### Step 2: Setup Backend

```bash
cd backend

# Copy environment template
cp .env.example .env

# Install dependencies
npm install
```

### Step 3: Setup Frontend

```bash
cd ../frontend

# Copy environment template
cp .env.local.example .env.local

# Install dependencies
npm install

cd ..
```

### Step 4: Add Ethereal Credentials

**This is required for emails to send!**

1. Visit [https://ethereal.email](https://ethereal.email)
2. Click "Create Ethereal Account"
3. Enter a fake email and password
4. You'll get SMTP credentials
5. Edit `backend/.env`:
   ```env
   ETHEREAL_USER=your-ethereal-email@ethereal.email
   ETHEREAL_PASS=your-ethereal-password
   ```

**Optional:** To use real SMTP (Gmail, SendGrid, etc.):
- Change `backend/src/services/email.service.ts`
- Update transporter config
- Add credentials to `.env`

## ▶️ Running the Application

### Terminal 1: Start Backend

```bash
cd backend
npm run dev
```

You should see:
```
✅ Database connection established
✅ Email service configured with Ethereal
🚀 Server running on http://localhost:3001
```

### Terminal 2: Start Frontend

```bash
cd frontend
npm run dev
```

You should see:
```
▲ Next.js 14.1.4
  - Local:        http://localhost:3000
```

### Terminal 3: Optional - Direct API Testing

```bash
# Test the API
curl http://localhost:3001/health

# Should return:
# {"status":"ok","timestamp":"..."}
```

## 🎯 First Test (5 minutes)

1. **Open browser**: http://localhost:3000
2. **Login**: Click "Enter Demo"
3. **Create email**:
   - Click "Compose New Email" button
   - Sender: `noreply@reachinbox.com`
   - Subject: `Hello from ReachInbox`
   - Body: `This is a test email to {{email}}`
4. **Upload CSV**:
   - Copy-paste this in a text editor, save as `emails.csv`:
     ```
     alice@example.com
     bob@example.com
     carol@example.com
     ```
   - Upload via the file input
5. **Schedule**:
   - Set "Start Time" to: **Current time + 1 minute**
   - Leave other settings as default
   - Click "Schedule Emails"
6. **Watch it work**:
   - See "3 emails found" confirmation
   - Emails appear in "Scheduled Emails" tab
   - After 1 minute, check "Sent Emails" tab
   - Click preview URL to see the email!

**Success!** You've scheduled and sent your first batch of emails! 🎉

## 🔧 Next Steps

### Try Rate Limiting

```bash
# 1. Edit backend/.env
MAX_EMAILS_PER_HOUR_PER_SENDER=5

# 2. Restart backend (Ctrl+C, then npm run dev)

# 3. Schedule 15 emails for same time
# 4. Watch first 5 send immediately
# 5. Rest delayed to next hour
```

### Try Persistence (Server Restart)

1. Schedule 5 emails for 2 minutes from now
2. Stop backend: Press `Ctrl+C`
3. Wait 30 seconds
4. Start backend: `npm run dev`
5. Refresh frontend (F5)
6. **Emails still there!** ✅
7. After 2 minutes total - emails send automatically

### Try API Directly

```bash
# Get current statistics
curl http://localhost:3001/api/stats

# Get scheduled emails
curl http://localhost:3001/api/scheduled

# Get sent emails  
curl http://localhost:3001/api/sent

# Schedule via API (requires valid datetime)
curl -X POST http://localhost:3001/api/schedule \
  -H "Content-Type: application/json" \
  -d '{
    "subject": "API Test",
    "body": "Scheduled via API",
    "emails": ["test@example.com"],
    "senderEmail": "noreply@reachinbox.com",
    "startTime": "2026-01-20T16:00:00Z"
  }'
```

**Import Postman Collection:**
- File: `API_COLLECTION.postman_collection.json`
- Import in Postman for easier API testing

## 🐛 Troubleshooting

### "Database connection failed"

```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# If not, restart
docker-compose restart postgres

# Check logs
docker logs reachinbox-postgres
```

### "Redis connection failed"

```bash
# Check if Redis is running
docker ps | grep redis

# If not, restart
docker-compose restart redis

# Test Redis
redis-cli -u redis://localhost:6379 ping
# Should return: PONG
```

### "Ethereal auth failed"

```bash
# 1. Verify credentials in backend/.env
cat backend/.env | grep ETHEREAL

# 2. Test credentials at ethereal.email
# 3. Create new account if needed
# 4. Restart backend
```

### "Ports already in use"

**Port 3000 (frontend):**
```bash
# Find what's using it
lsof -i :3000
# Kill the process
kill -9 <PID>
```

**Port 3001 (backend):**
```bash
# Find what's using it
lsof -i :3001
# Kill the process
kill -9 <PID>
```

**Port 5432 (PostgreSQL):**
```bash
# Restart container
docker-compose restart postgres
```

**Port 6379 (Redis):**
```bash
# Restart container
docker-compose restart redis
```

### "npm install fails"

```bash
# Clear npm cache
npm cache clean --force

# Try again
npm install

# If still fails, try yarn
yarn install
```

### "Emails not sending"

Check this checklist:

- [ ] Backend running? (`npm run dev` in backend terminal)
- [ ] Frontend running? (`npm run dev` in frontend terminal)
- [ ] Ethereal configured? (`ETHEREAL_USER` and `ETHEREAL_PASS` in `.env`)
- [ ] Docker services running? (`docker ps` shows postgres + redis)
- [ ] Start time in future? (Set to current time + 1 minute)
- [ ] Browser console errors? (F12 → Console tab)

**Debug:**
```bash
# Check backend logs
# Check frontend browser console (F12)
# Check Docker logs
docker logs reachinbox-postgres
docker logs reachinbox-redis
```

## 📖 Documentation

- **Full README**: See `README.md` for architecture, API docs, testing guide
- **Submission Notes**: See `SUBMISSION_NOTES.md` for demo scenarios
- **API Collection**: Import `API_COLLECTION.postman_collection.json` in Postman

## 🎓 Learning Path

1. **Basic**: Run the quick test, schedule emails, see them send
2. **Intermediate**: Test persistence (restart server, emails still there)
3. **Advanced**: Test rate limiting, API directly, load testing
4. **Expert**: Read architecture in `README.md`, understand BullMQ + Redis

## 🆘 Need Help?

1. Check **Troubleshooting** section above
2. Review `README.md` for architecture details
3. Check browser console (F12) for frontend errors
4. Check backend terminal for server errors
5. Review Docker logs: `docker logs <container-name>`

## ✅ Checklist: You're Ready When...

- [ ] Node.js, Docker, Docker Compose installed
- [ ] `docker-compose up -d` shows 2 running containers
- [ ] Backend runs with `npm run dev` (no errors)
- [ ] Frontend runs with `npm run dev` (no errors)
- [ ] Browser opens http://localhost:3000
- [ ] Can click "Enter Demo" and see dashboard
- [ ] Can upload CSV and schedule emails
- [ ] See emails in "Sent Emails" tab after 1 minute

**If all checked - you're ready to go!** 🚀

## 🎯 Demo Ready Checklist

For the submission demo:

- [ ] Backend + Frontend running smoothly
- [ ] Ethereal emails configured
- [ ] Sample `SAMPLE_EMAILS.csv` in project root
- [ ] Docker services running
- [ ] Dashboard loads without errors
- [ ] Can compose and schedule emails
- [ ] Emails send and appear in tabs
- [ ] Timestamps are correct
- [ ] Rate limiting works (if configured)
- [ ] API endpoints respond (curl tests)

---

**Questions?** Check the full [README.md](README.md) for detailed documentation.

**Ready to schedule some emails?** Jump to the **First Test** section above! 🚀
