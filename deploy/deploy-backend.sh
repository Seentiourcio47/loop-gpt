# Loop GPT Backend - VPS Deployment Script
# Run this script on the VPS server as root

set -e

echo "=========================================="
echo "  Loop GPT Backend - VPS Installation"
echo "=========================================="

# Update system packages
echo "[1/8] Updating system packages..."
apt-get update && apt-get upgrade -y

# Install Node.js 20 LTS
echo "[2/8] Installing Node.js 20 LTS..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install PostgreSQL
echo "[3/8] Installing PostgreSQL..."
apt-get install -y postgresql postgresql-contrib

# Install PM2 for process management
echo "[4/8] Installing PM2..."
npm install -g pm2

# Install Git
echo "[5/8] Installing Git..."
apt-get install -y git

# Create application directory
echo "[6/8] Setting up application directory..."
mkdir -p /opt/loop-gpt/backend
cd /opt/loop-gpt/backend

# Copy backend files (to be done via SCP)
echo "[7/8] Backend files should be uploaded to /opt/loop-gpt/backend"

# Install dependencies
echo "[8/8] Installing Node.js dependencies..."
npm install --production

# Setup PostgreSQL
echo "Setting up PostgreSQL database..."
sudo -u postgres psql -c "CREATE DATABASE loopgpt;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER loopgpt WITH PASSWORD 'LoopGpt_Secure_2026!';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE loopgpt TO loopgpt;" 2>/dev/null || true

# Create .env file
cat > .env << 'EOF'
# Database
DATABASE_URL=postgresql://loopgpt:LoopGpt_Secure_2026!@localhost:5432/loopgpt

# JWT Secret (CHANGE THIS IN PRODUCTION!)
JWT_SECRET=loop-gpt-jwt-secret-CHANGE-IN-PRODUCTION-$(openssl rand -hex 32)

# HuggingFace Inference Endpoints
HF_ENDPOINT_URL=https://v29tkr3b9tnclvnb.us-east-1.aws.endpoints.huggingface.cloud
HF_TOKEN=<HF_TOKEN>
HF_MODEL=default

# Image Generation Endpoint
IMAGE_API_URL=https://it1i1rf992g05u29.us-east-1.aws.endpoints.huggingface.cloud

# Video Generation Endpoint
VIDEO_API_URL=https://s4u9zdezthdwes8o.us-east-1.aws.endpoints.huggingface.cloud

# Server
PORT=3001
NODE_ENV=production

# Frontend URL (update after Railway deployment)
FRONTEND_URL=https://your-railway-app.railway.app

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Optional: Analytics
SENTRY_DSN=
EOF

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run database migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Setup PM2
echo "Setting up PM2..."
pm2 delete loop-gpt-backend 2>/dev/null || true
pm2 start npm --name "loop-gpt-backend" -- start
pm2 save
pm2 startup

# Setup firewall (UFW)
echo "Setting up firewall..."
apt-get install -y ufw
ufw --force enable
ufw allow 22/tcp    # SSH
ufw allow 3001/tcp  # Backend API
ufw status

echo ""
echo "=========================================="
echo "  Installation Complete!"
echo "=========================================="
echo ""
echo "Backend API running at: http://$(hostname -I | awk '{print $1}'):3001"
echo "Health check: http://$(hostname -I | awk '{print $1}'):3001/health"
echo ""
echo "PM2 Commands:"
echo "  pm2 status              - Check status"
echo "  pm2 logs loop-gpt-backend - View logs"
echo "  pm2 restart loop-gpt-backend - Restart"
echo ""