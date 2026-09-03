# Loop GPT - Complete Deployment Guide

## Overview
This guide covers deployment of the Loop GPT application with:
- **Backend**: Deployed on your VPS (194.15.36.172)
- **Frontend**: Deployed on Railway (or Vercel)

---

## Part 1: Backend Deployment (VPS)

### Option A: Manual SSH Deployment

```bash
# 1. Connect to your VPS
ssh root@194.15.36.172
# Password: l52AJKKP7r1lJ7bTnpL4

# 2. Update system
apt-get update && apt-get upgrade -y

# 3. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 4. Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# 5. Install PM2
npm install -g pm2

# 6. Create app directory
mkdir -p /opt/loop-gpt/backend
cd /opt/loop-gpt/backend

# 7. Upload your backend files via SCP from your local machine:
# scp -r C:\Users\chris\projects\development\Loop_GPT_original\backend\* root@194.15.36.172:/opt/loop-gpt/backend/

# 8. Install dependencies
npm install --production

# 9. Setup PostgreSQL
sudo -u postgres psql -c "CREATE DATABASE loopgpt;"
sudo -u postgres psql -c "CREATE USER loopgpt WITH PASSWORD 'LoopGpt_Secure_2026!';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE loopgpt TO loopgpt;"

# 10. Create .env file
cat > .env << 'EOF'
DATABASE_URL=postgresql://loopgpt:LoopGpt_Secure_2026!@localhost:5432/loopgpt
JWT_SECRET=loop-gpt-jwt-secret-CHANGE-IN-PRODUCTION-$(openssl rand -hex 32)
HF_ENDPOINT_URL=https://v29tkr3b9tnclvnb.us-east-1.aws.endpoints.huggingface.cloud
HF_TOKEN=<HF_TOKEN>
HF_MODEL=default
IMAGE_API_URL=https://it1i1rf992g05u29.us-east-1.aws.endpoints.huggingface.cloud
VIDEO_API_URL=https://s4u9zdezthdwes8o.us-east-1.aws.endpoints.huggingface.cloud
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://your-railway-app.railway.app
EOF

# 11. Generate Prisma client and run migrations
npx prisma generate
npx prisma migrate deploy

# 12. Start with PM2
pm2 start npm --name "loop-gpt-backend" -- start
pm2 save
pm2 startup

# 13. Setup firewall
apt-get install -y ufw
ufw --force enable
ufw allow 22/tcp
ufw allow 3001/tcp
ufw status
```

### Option B: Docker Compose Deployment

```bash
# 1. Connect to VPS
ssh root@194.15.36.172

# 2. Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# 3. Install Docker Compose
curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 4. Create app directory
mkdir -p /opt/loop-gpt
cd /opt/loop-gpt

# 5. Upload docker-compose.yml and backend files

# 6. Start services
docker-compose up -d

# 7. View logs
docker-compose logs -f
```

---

## Part 2: Frontend Deployment (Railway)

### Step 1: Prepare Repository
```bash
cd C:\Users\chris\projects\development\Loop_GPT_original\frontend

# Initialize git if not already done
git init
git add .
git commit -m "Initial frontend commit"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/loop-gpt-frontend.git
git push -u origin main
```

### Step 2: Deploy to Railway

1. Go to https://railway.app
2. Click "New Project" → "Deploy from GitHub repo"
3. Select your `loop-gpt-frontend` repository
4. Configure environment variables:
   ```
   NEXT_PUBLIC_API_URL=https://your-vps-ip:3001
   NEXT_PUBLIC_POSTHOG_KEY=(optional)
   NEXT_PUBLIC_SENTRY_DSN=(optional)
   ```
5. Click "Deploy"

### Step 3: Update Backend CORS
After Railway gives you a domain (e.g., `https://loop-gpt-xyz.railway.app`), update your backend's `.env`:
```
FRONTEND_URL=https://loop-gpt-xyz.railway.app
```
Then restart the backend: `pm2 restart loop-gpt-backend`

---

## Part 3: Verify Deployment

### Backend Health Check
```bash
curl http://194.15.36.172:3001/health
# Expected: {"status":"ok","timestamp":"..."}
```

### Frontend Check
```bash
curl https://your-railway-app.railway.app
# Should return HTML
```

### Test Chat API
```bash
curl -X POST http://194.15.36.172:3001/api/conversations \
  -H "Content-Type: application/json" \
  -d '{}'
```

---

## Environment Variables Reference

### Backend (.env)
| Variable | Value | Required |
|----------|-------|----------|
| DATABASE_URL | postgresql://loopgpt:LoopGpt_Secure_2026!@localhost:5432/loopgpt | Yes (or use in-memory) |
| JWT_SECRET | Any secure random string | Yes |
| HF_ENDPOINT_URL | https://v29tkr3b9tnclvnb.us-east-1.aws.endpoints.huggingface.cloud | Yes |
| HF_TOKEN | <HF_TOKEN> | Yes |
| IMAGE_API_URL | https://it1i1rf992g05u29.us-east-1.aws.endpoints.huggingface.cloud | Optional |
| VIDEO_API_URL | https://s4u9zdezthdwes8o.us-east-1.aws.endpoints.huggingface.cloud | Optional |
| PORT | 3001 | Yes |
| FRONTEND_URL | Your Railway URL | Yes |

### Frontend (Railway Variables)
| Variable | Value | Required |
|----------|-------|----------|
| NEXT_PUBLIC_API_URL | https://194.15.36.172:3001 | Yes |
| NEXT_PUBLIC_POSTHOG_KEY | (optional) | No |
| NEXT_PUBLIC_SENTRY_DSN | (optional) | No |

---

## Troubleshooting

### SSH Connection Issues
```bash
# Clear old host keys
ssh-keygen -R 194.15.36.172

# Try connecting with verbose output
ssh -v root@194.15.36.172
```

### Backend Not Starting
```bash
# Check PM2 logs
pm2 logs loop-gpt-backend

# Check if port is in use
netstat -tlnp | grep 3001

# Check Node.js version
node --version  # Should be 18+
```

### Database Connection Issues
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
sudo -u postgres psql -d loopgpt -c "SELECT 1;"
```

### CORS Errors
Ensure `FRONTEND_URL` in backend `.env` matches your Railway domain exactly.

---

## Security Checklist

- [ ] Change `JWT_SECRET` to a secure random value
- [ ] Change database password from default
- [ ] Enable firewall (UFW) with only necessary ports
- [ ] Set up SSL/TLS for production (use Caddy or Nginx)
- [ ] Enable automatic security updates
- [ ] Set up monitoring (PM2, Sentry, etc.)
- [ ] Configure backup strategy for database

---

## Support

For issues, check:
- Backend logs: `pm2 logs loop-gpt-backend`
- Database logs: `journalctl -u postgresql`
- Railway logs: Dashboard → Logs tab