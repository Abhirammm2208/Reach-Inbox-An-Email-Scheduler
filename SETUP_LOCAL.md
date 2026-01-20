# 🚀 Local Setup Guide (No Docker)

## Prerequisites Needed

### 1. **Local PostgreSQL**
- PostgreSQL server running locally
- Default: `localhost:5432`
- Provide: Database name, username, password

### 2. **Online Redis** (e.g., Redis Cloud)
You'll need to sign up and get connection details:
- **Host**: (Redis Cloud provides this)
- **Port**: (Usually 6379 or custom)
- **Password**: (If authentication required)
- **Connection String**: `redis://[user]:[password]@[host]:[port]`

### 3. **Node.js** 
- v16 or higher
- npm or yarn

### 4. **Ethereal Email Account** (for testing)
- Go to https://ethereal.email
- Create account
- Get credentials

---

## 📋 Configuration Details Needed

### A. PostgreSQL Configuration
**Please provide:**
```
DATABASE_HOST: (default: localhost)
DATABASE_PORT: (default: 5432)
DATABASE_NAME: (the database to use, e.g., "reachinbox")
DATABASE_USER: (your postgres username)
DATABASE_PASSWORD: (your postgres password)
```

**Format for .env file:**
```
DATABASE_URL=postgresql://[USER]:[PASSWORD]@[HOST]:[PORT]/[DATABASE_NAME]
```

---

### B. Redis Configuration (Online Service)

**Option 1: Redis Cloud (Recommended)**
1. Sign up at https://redis.com/try-free/
2. Create a free database
3. Get connection details from console

**Option 2: Other Redis Providers**
- Upstash Redis (https://upstash.com/)
- Amazon ElastiCache
- Azure Cache for Redis

**Provide:**
```
REDIS_URL=redis://:[PASSWORD]@[HOST]:[PORT]
```

**Example:**
```
REDIS_URL=redis://:mypassword@redis-12345.c123.us-east-1-2.ec2.cloud.redis.io:6379
```

---

### C. Ethereal Email (Free Testing)
1. Go to https://ethereal.email
2. Click "Create Ethereal Account"
3. You'll get:
   - **Email**: (e.g., john.doe@ethereal.email)
   - **Password**: (provided immediately)

**Add to .env:**
```
ETHEREAL_USER=your-email@ethereal.email
ETHEREAL_PASS=your-password
```

---

## 🔧 Step-by-Step Setup

### Step 1: Create PostgreSQL Database

```sql
-- Connect to PostgreSQL locally
createdb reachinbox
-- Or use your preferred database name
```

**Test connection:**
```bash
psql -U postgres -h localhost -d reachinbox
```

---

### Step 2: Create .env Files

**Backend: `backend/.env`**
```env
# Database
DATABASE_URL=postgresql://[USER]:[PASSWORD]@localhost:5432/reachinbox

# Redis (from online service)
REDIS_URL=redis://:[PASSWORD]@[REDIS_HOST]:[REDIS_PORT]

# Server
NODE_ENV=development
PORT=5005
CORS_ORIGIN=http://localhost:3005

# Ethereal Email
ETHEREAL_USER=your-email@ethereal.email
ETHEREAL_PASS=your-password

# Rate limiting
MAX_EMAILS_PER_HOUR_PER_SENDER=100
MAX_EMAILS_PER_HOUR=500

# Worker
WORKER_CONCURRENCY=2
DELAY_BETWEEN_SENDS_MS=2000
```

**Frontend: `frontend/.env.local`**
```env
NEXT_PUBLIC_API_URL=http://localhost:5005
NEXT_PUBLIC_GOOGLE_CLIENT_ID=demo
```

---

### Step 3: Install Dependencies

**Backend:**
```bash
cd backend
npm install
```

**Frontend:**
```bash
cd frontend
npm install
```

---

### Step 4: Run Backend

```bash
cd backend
npm run dev
```

**Expected output:**
```
✅ Database connected
✅ Redis connected
🚀 Server running on http://localhost:5005
```

---

### Step 5: Run Frontend (New Terminal)

```bash
cd frontend
npm run dev
```

**Expected output:**
```
✅ Ready on http://localhost:3005
```

---

## 🔗 URLs After Setup

| Service | URL | Purpose |
|---------|-----|---------|
| **Frontend** | http://localhost:3005 | Dashboard UI |
| **Backend API** | http://localhost:5005 | API endpoints |
| **Health Check** | http://localhost:5005/health | Server status |
| **Postman** | Import `API_COLLECTION.postman_collection.json` | API testing |

---

## 📞 Redis Configuration Examples

### Redis Cloud Example
```
Host: redis-12345.c123.us-east-1-2.ec2.cloud.redis.io
Port: 6379
Password: abcdef123456xyz
Database: 0

REDIS_URL=redis://:abcdef123456xyz@redis-12345.c123.us-east-1-2.ec2.cloud.redis.io:6379
```

### Upstash Redis Example
```
Host: us1-neat-skunk-12345.upstash.io
Port: 6379
Password: your-auth-token

REDIS_URL=redis://:your-auth-token@us1-neat-skunk-12345.upstash.io:6379
```

---

## ⚠️ What Redis Is Used For

Your online Redis instance will store:

1. **Job Queue** - Email sending jobs with delays
2. **Rate Limit Counters** - Track emails per hour per sender
3. **Job State** - Pending, processing, completed states
4. **Scheduled Data** - Temporary scheduling information

**Storage needed:** ~100MB (for 10,000+ queued emails)

---

## 🐛 Troubleshooting

### Issue: "Cannot connect to Redis"
- ✅ Verify REDIS_URL format is correct
- ✅ Ensure port is not blocked by firewall
- ✅ Check if online Redis service is running
- ✅ Test with: `redis-cli -u "your-redis-url"`

### Issue: "Cannot connect to PostgreSQL"
- ✅ Verify PostgreSQL is running: `psql -U postgres`
- ✅ Check DATABASE_URL format
- ✅ Verify database exists: `\l` in psql
- ✅ Check username/password are correct

### Issue: "Port 5005 already in use"
```bash
# Find process using port 5005
netstat -ano | findstr :5005
# Kill it:
taskkill /PID [PID] /F
```

### Issue: "Port 3005 already in use"
```bash
# Same as above but for 3005
```

---

## ✅ Quick Checklist

- [ ] PostgreSQL running locally
- [ ] Database created (`reachinbox`)
- [ ] Redis online service signed up
- [ ] Redis REDIS_URL obtained
- [ ] Ethereal account created
- [ ] Backend `.env` configured
- [ ] Frontend `.env.local` configured
- [ ] `npm install` completed in both folders
- [ ] Backend running on 5005
- [ ] Frontend running on 3005
- [ ] Can access http://localhost:3005

---

## 📊 Architecture Without Docker

```
┌─────────────────────────────────────────────────────────┐
│ Your Computer                                           │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Frontend: http://localhost:3005 (React/Next.js)       │
│       ↓                                                 │
│  Backend: http://localhost:5005 (Express/Node.js)      │
│       ↓                                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Local PostgreSQL (localhost:5432)               │  │
│  │  - Stores: Emails, ScheduledEmails, SentEmails  │  │
│  └──────────────────────────────────────────────────┘  │
│       ↓                                                 │
├─────────────────────────────────────────────────────────┤
│  Internet (Online Services)                             │
├─────────────────────────────────────────────────────────┤
│       ↓                                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Redis Cloud / Upstash                          │  │
│  │  - Stores: Job queue, rate limit counters       │  │
│  └──────────────────────────────────────────────────┘  │
│       ↓                                                 │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Ethereal SMTP (for sending emails)             │  │
│  └──────────────────────────────────────────────────┘  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 🎯 Next Steps

1. **Provide your PostgreSQL details** (host, port, username, password)
2. **Sign up for online Redis** and get the REDIS_URL
3. **Create Ethereal account** and get credentials
4. **Create .env files** using examples above
5. **Run both servers** as shown in Step 4-5
6. **Access http://localhost:3005** in browser

**Once you provide these details, I'll help you test everything!**
