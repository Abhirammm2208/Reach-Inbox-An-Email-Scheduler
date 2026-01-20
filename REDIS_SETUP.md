# 🔴 Redis Configuration Reference

## What Redis Is Used For (In This Project)

### 1. **Job Queue Storage** 
- All email sending jobs are stored here
- Jobs have delays attached (schedule time - now)
- BullMQ automatically processes delayed jobs

### 2. **Rate Limiting Counters**
- Per-sender rate limit: `rate_limit:{sender}:{hour}`
- Global rate limit: `rate_limit:global:{hour}`
- Counts emails sent in current hour

### 3. **Job State Management**
- Tracks job status: pending, processing, completed, failed
- Allows job recovery on server restart

---

## Redis Configuration Options

### **Option 1: Redis Cloud (FREE TIER - Recommended)**

**Sign up:**
- Visit: https://redis.com/try-free/
- Create free account
- Create new database (free tier: 30MB)

**Get connection details:**
1. In Redis Cloud console, go to your database
2. Click "Connect"
3. Look for "Private endpoint" or "Public endpoint"
4. Format: `redis-12345.c123.us-east-1-2.ec2.cloud.redis.io:6379`
5. Get password from "Default user" or "ACL"

**Connection String Example:**
```
redis://:your-password@redis-12345.c123.us-east-1-2.ec2.cloud.redis.io:6379
```

**Expected Performance:** 
- Free tier: Perfect for development (up to 10K commands/sec)
- ~100MB storage
- Suitable for testing with 1000+ emails

---

### **Option 2: Upstash Redis (Alternative)**

**Sign up:**
- Visit: https://upstash.com/
- Create free account
- Create new Redis database

**Get connection details:**
1. Go to "Databases" → Your database
2. Get "Endpoint" (looks like: `us1-neat-skunk-12345.upstash.io`)
3. Get "Password" (auth token)
4. Default port: 6379

**Connection String Example:**
```
redis://:auth-token@us1-neat-skunk-12345.upstash.io:6379
```

---

### **Option 3: Self-Hosted Locally (If You Have Redis)**

If you install Redis locally:
```
redis://localhost:6379
```

**Installation:**
- Windows: https://github.com/microsoftarchive/redis/releases
- Mac: `brew install redis`
- Linux: `sudo apt-get install redis-server`

---

## Testing Redis Connection

### Method 1: Using redis-cli (if installed)
```bash
redis-cli -u "redis://:your-password@redis-host:6379"
ping
# Should return: PONG
```

### Method 2: Using Node.js
```bash
# Create test-redis.js
const redis = require('redis');
const client = redis.createClient({
  url: 'redis://:password@host:6379'
});

client.on('connect', () => console.log('✅ Connected to Redis'));
client.on('error', (err) => console.log('❌ Error:', err));
client.connect();
```

---

## Redis Data Structure (What Gets Stored)

### Job Queue Example:
```
Queue Key: "bull:email:jobs:1"
Value: {
  id: "1",
  name: "send-email",
  data: {
    recipients: ["user@example.com"],
    subject: "Hello",
    body: "Content"
  },
  delay: 3600000,  // 1 hour
  attempts: 3
}
```

### Rate Limit Counter Example:
```
Key: "rate_limit:sender@example.com:2024-01-20-14"
Value: 45  // 45 emails sent in this hour
TTL: 3600  // Expires after 1 hour
```

---

## Expected Redis Usage

| Scenario | Jobs in Redis | Storage |
|----------|---|---|
| 10 emails | 10 jobs | ~10 KB |
| 100 emails | 100 jobs | ~100 KB |
| 1,000 emails | 1,000 jobs | ~1 MB |
| 10,000 emails | 10,000 jobs | ~10 MB |

**Free tier (30 MB) is sufficient for:**
- Development/testing
- Up to 30,000 scheduled emails
- Multiple rate limit windows

---

## Environment Variable Format

```env
# For .env file in backend folder
REDIS_URL=redis://[:password]@[host]:[port]

# Examples:
# Redis Cloud
REDIS_URL=redis://:myPassword123@redis-12345.c123.us-east-1-2.ec2.cloud.redis.io:6379

# Upstash
REDIS_URL=redis://:myAuthToken@us1-neat-skunk-12345.upstash.io:6379

# Local (if installed)
REDIS_URL=redis://localhost:6379

# With username (uncommon)
REDIS_URL=redis://username:password@host:6379
```

---

## Quick Checklist

- [ ] Chose Redis provider (Cloud, Upstash, or Local)
- [ ] Created account/database
- [ ] Got connection string (REDIS_URL)
- [ ] Tested connection with redis-cli or Node.js
- [ ] Added REDIS_URL to backend/.env
- [ ] Backend can connect (check logs)

---

## Troubleshooting

### Error: "Redis connection failed"
```
Solutions:
1. Check REDIS_URL format is correct
2. Test connection: redis-cli -u "REDIS_URL"
3. Verify password is correct
4. Check firewall allows connection
5. Ensure Redis service is running
```

### Error: "READONLY You can't write against a read only replica"
```
This means you're connected to a read-only Redis instance.
Solution: Use write-capable endpoint from Redis provider
```

### Error: "NOSCRIPT No matching script. Please use EVAL"
```
This is normal - BullMQ scripts will be loaded automatically
Solution: This error resolves itself after first job processing
```

---

## Free Redis Provider Comparison

| Provider | Free Tier | Limit | Location |
|----------|-----------|-------|----------|
| **Redis Cloud** | Yes | 30 MB | Global |
| **Upstash** | Yes | 10,000 commands/day | Global |
| **Valkey.cloud** | Yes | 30 MB | Global |

**Recommended: Redis Cloud** (most reliable for this use case)

