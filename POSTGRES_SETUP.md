# 🐘 PostgreSQL Local Setup Guide

## Prerequisites

### Check if PostgreSQL is Installed

**Windows - PowerShell:**
```powershell
psql --version
```

**Mac:**
```bash
psql --version
```

**If not installed:**
- Download: https://www.postgresql.org/download/
- Latest stable: PostgreSQL 15 or 16
- Choose platform and follow installer

---

## Setup Steps

### Step 1: Start PostgreSQL Service

**Windows:**
```powershell
# Check if service is running
Get-Service "postgresql*"

# If not running, start it
Start-Service -Name "postgresql-x64-15"  # or your version
```

**Mac:**
```bash
brew services start postgresql
# or
pg_ctl -D /usr/local/var/postgres start
```

**Linux:**
```bash
sudo systemctl start postgresql
```

---

### Step 2: Connect to PostgreSQL

**Windows & Mac:**
```bash
# Connect as default user (postgres)
psql -U postgres -h localhost
```

**When prompted, enter password** (set during installation)

---

### Step 3: Create Database

In psql terminal:
```sql
-- Create database
CREATE DATABASE reachinbox;

-- List databases to verify
\l

-- Connect to new database
\c reachinbox

-- Verify you're connected
SELECT current_database();

-- Exit
\q
```

---

### Step 4: Get Connection Details

You'll need these for `.env` file:

**Standard Setup:**
```
Host: localhost
Port: 5432
Database: reachinbox
User: postgres
Password: [your-postgres-password]
```

**Connection String Format:**
```
postgresql://postgres:[PASSWORD]@localhost:5432/reachinbox
```

**Example:**
```
postgresql://postgres:myPassword123@localhost:5432/reachinbox
```

---

## PostgreSQL Connection String Formats

### Basic (no password):
```
postgresql://postgres@localhost:5432/reachinbox
```

### With password:
```
postgresql://postgres:password@localhost:5432/reachinbox
```

### Special characters in password (URL encoded):
```
# If password is: my@Pass#123
# Use: postgresql://postgres:my%40Pass%23123@localhost:5432/reachinbox
```

---

## Testing Connection

### Method 1: Command Line
```bash
# Test connection
psql -U postgres -h localhost -d reachinbox -c "SELECT NOW();"

# If successful, shows current timestamp
```

### Method 2: From Backend (after setup)
```bash
cd backend
npm run dev
# Check logs for: ✅ Database connected
```

---

## Creating Additional User (Optional)

**For better security, create dedicated user:**

```sql
-- In psql as postgres user
CREATE USER reachinbox_user WITH PASSWORD 'secure_password_here';

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE reachinbox TO reachinbox_user;

-- Connect with new user
psql -U reachinbox_user -h localhost -d reachinbox
```

**Updated connection string:**
```
postgresql://reachinbox_user:secure_password_here@localhost:5432/reachinbox
```

---

## Database Configuration

### Verify PostgreSQL is Configured for TCP/IP

**Check postgresql.conf:**

**Windows:**
```
Location: C:\Program Files\PostgreSQL\15\data\postgresql.conf
or
C:\Program Files\PostgreSQL\16\data\postgresql.conf
```

**Mac:**
```
Location: /usr/local/var/postgres/postgresql.conf
```

**Look for:**
```
listen_addresses = 'localhost'
# or
listen_addresses = '*'
```

If `listen_addresses = 'localhost'` → TCP/IP is enabled ✅

---

## PostgreSQL Data Folder

**Default locations:**

**Windows:**
```
C:\Program Files\PostgreSQL\15\data
or
C:\Program Files\PostgreSQL\16\data
```

**Mac:**
```
/usr/local/var/postgres
```

**Linux:**
```
/var/lib/postgresql/15/main
```

---

## .env Configuration

**For backend/.env:**
```env
# PostgreSQL Connection
DATABASE_URL=postgresql://postgres:your-password@localhost:5432/reachinbox

# Other settings
NODE_ENV=development
PORT=5005
CORS_ORIGIN=http://localhost:3005

# Redis (will provide separately)
REDIS_URL=redis://...

# Email
ETHEREAL_USER=your-email@ethereal.email
ETHEREAL_PASS=your-password

# Rate limits
MAX_EMAILS_PER_HOUR_PER_SENDER=100
MAX_EMAILS_PER_HOUR=500

# Worker
WORKER_CONCURRENCY=2
DELAY_BETWEEN_SENDS_MS=2000
```

---

## Database Tables (Created Automatically)

When backend starts, these tables are created automatically via TypeORM:

1. **Email** - Individual emails with metadata
2. **ScheduledEmail** - Batch metadata and statistics
3. **SentEmail** - Audit log of sent emails

No manual migrations needed! ✅

---

## Troubleshooting

### Error: "FATAL: role 'postgres' does not exist"
```
Solution:
1. Reinstall PostgreSQL
2. Or create the role:
   createuser -s postgres
```

### Error: "could not connect to server: Connection refused"
```
Solutions:
1. Check if PostgreSQL service is running
2. Windows: Services.msc → postgresql-x64-15
3. Mac: brew services list
4. Try restarting service
```

### Error: "database 'reachinbox' does not exist"
```
Solution:
1. Create database (see Step 3)
2. Or modify DATABASE_URL to different name
```

### Error: "password authentication failed"
```
Solution:
1. Verify password is correct (check during setup)
2. Reset password:
   ALTER USER postgres WITH PASSWORD 'new-password';
3. Update .env with new password
```

### Error: "sorry, too many clients already"
```
Solution:
1. Increase max_connections in postgresql.conf
2. Restart PostgreSQL service
3. Default is usually sufficient for development
```

---

## Verify Installation

**Quick test:**
```bash
# 1. Connect to postgres
psql -U postgres -h localhost

# 2. Create test database
CREATE DATABASE test_db;

# 3. List databases
\l

# 4. Connect to test database
\c test_db

# 5. Create test table
CREATE TABLE test (id SERIAL PRIMARY KEY, name VARCHAR(100));

# 6. Insert test data
INSERT INTO test (name) VALUES ('hello');

# 7. Verify
SELECT * FROM test;

# Expected output:
# id |  name
# ---+-------
#  1 | hello

# 8. Cleanup
DROP DATABASE test_db;

# 9. Exit
\q
```

---

## Performance Tips

### For Development (Good Enough):
```sql
-- Default settings are fine for development
-- No configuration needed
```

### Connection Pooling (Optional):
```
Backend uses connection pooling by default
No configuration needed in .env
```

---

## Backup/Restore (Optional)

**Backup database:**
```bash
pg_dump -U postgres -h localhost reachinbox > backup.sql
```

**Restore database:**
```bash
psql -U postgres -h localhost reachinbox < backup.sql
```

---

## Quick Checklist

- [ ] PostgreSQL installed
- [ ] PostgreSQL service running
- [ ] Database `reachinbox` created
- [ ] Can connect: `psql -U postgres -h localhost -d reachinbox`
- [ ] Got connection string for .env
- [ ] Added to backend/.env as DATABASE_URL
- [ ] Backend can start (check logs for "✅ Database connected")

---

## Next Steps

1. **Install PostgreSQL** if needed
2. **Start PostgreSQL service**
3. **Create `reachinbox` database**
4. **Test connection**
5. **Add DATABASE_URL to backend/.env**
6. **Update `.env` file with your details**
7. **Run backend** - TypeORM will create tables automatically

**Once done, provide the connection details and I'll help you start both servers!**
