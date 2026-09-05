# 🚀 Loop GPT - LIVE DEPLOYMENT STATUS

## ✅ DEPLOYMENT COMPLETE - ALL SYSTEMS OPERATIONAL

**Deployment Date**: 2026-08-20 (initial) · **Updated**: 2026-09-04 (Railway + branded-domain cutover)
**Status**: LIVE
**Domain**: loop-gpt.cyou

---

## 🌐 Domain Architecture (as of 2026-09-04)

Both services run on **Railway** (project `loop-gpt`, `Seentiourcio47/loop-gpt`, tracked on `main`):

| Hostname | Path | Status | Purpose |
|-----------|------|--------|---------|
| `loop-gpt.cyou` | Cloudflare (proxied) → Railway frontend | ✅ LIVE | Frontend UI (apex) |
| `api.loop-gpt.cyou` | Cloudflare Tunnel bridge → Railway backend | ✅ LIVE | Backend API |
| `app.loop-gpt.cyou` | Cloudflare Tunnel bridge → Railway frontend | ✅ LIVE | Frontend (legacy alias) |

### How `api.loop-gpt.cyou` works

DNS keeps the historical Aug-20 tunnel CNAMEs (`...cfargotunnel.com`), but the tunnel
now **bridges to Railway** instead of localhost. Config lives at
`C:\Users\chris\.cloudflared\loop-gpt-railway.yml`:

```yaml
ingress:
  - hostname: api.loop-gpt.cyou  -> https://backend-production-4d0d6.up.railway.app
  - hostname: app.loop-gpt.cyou  -> https://frontend-production-868b.up.railway.app
```

**Durability**: the connector auto-starts at logon via
`%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup\start-loopgpt-tunnel.cmd`.
An always-on alternative (no dependence on this PC): change the Cloudflare CNAME
`api` → `6nzrbghb.up.railway.app` with **proxy OFF** and re-run
`deploy\switch-to-branded-domain.ps1`.

### Env vars flipped with the branded cutover (Railway)

- backend: `OAUTH_CALLBACK_BASE=https://api.loop-gpt.cyou`,
  `PUBLIC_API_URL=https://api.loop-gpt.cyou`,
  `FRONTEND_URL=https://loop-gpt.cyou`
- frontend: `NEXT_PUBLIC_API_URL=https://api.loop-gpt.cyou`
  (baked at build time — the live bundle already serves this)

**OAuth callback registrations** (Google & GitHub consoles):
```
https://api.loop-gpt.cyou/api/auth/oauth/google/callback
https://api.loop-gpt.cyou/api/auth/oauth/github/callback
```

### Verified live 2026-09-04 (through the branded domain)

- `GET /health` → 200
- `GET /api/models/catalog` → standard + large tiers
- CORS preflight from `https://loop-gpt.cyou` → allow-origin OK
- Full E2E user journey: register → JWT → create conversation → SSE chat
  stream (standard tier) → `"BRAND-E2E-OK"` reply in 2.8s
- OAuth start → 302 to Google with `redirect_uri=https://api.loop-gpt.cyou/...`

---

## Historical: original local-tunnel architecture (2026-08-20)

Superseded — kept for reference. Backend/frontend ran on this PC and the tunnel
ingressed to `localhost:3001` / `localhost:3000`. See git history for the full text.

### HuggingFace Endpoints Configured
| Service | Endpoint URL | Status |
|---------|-------------|--------|
| Chat (Standard — Qwen3.8-27B-Uncensored-Cyber, 256K ctx) | https://y54ycbowmtsfq58i.us-east-1.aws.endpoints.huggingface.cloud | ✅ |
| Chat (Large — GLM-5.3-Flash FP8, 256K ctx) | https://vu3pi203abtenqrc.us-east-2.aws.endpoints.huggingface.cloud | ✅ |
| Image | https://it1i1rf992g05u29.us-east-1.aws.endpoints.huggingface.cloud | ✅ |
| Video | https://s4u9zdezthdwes8o.us-east-1.aws.endpoints.huggingface.cloud | ✅ |

The Large tier surfaces as `loop-chat-large` in the UI model picker,
`GET /api/models/catalog`, and the public `/v1` API. It is enabled purely by
the `HF_LARGE_*` variables below — unset them to hide the tier.

### Environment Variables (Production)
```env
DATABASE_URL=postgresql://loopgpt:LoopGpt_Secure_2026!@localhost:5432/loopgpt
JWT_SECRET=loop-gpt-jwt-secret-CHANGE-IN-PRODUCTION
HF_ENDPOINT_URL=https://y54ycbowmtsfq58i.us-east-1.aws.endpoints.huggingface.cloud
HF_MODEL=Qwen3.8-27B-Uncensored-Cyber
HF_TOKEN=<HF_TOKEN>
HF_LARGE_ENDPOINT_URL=https://vu3pi203abtenqrc.us-east-2.aws.endpoints.huggingface.cloud
HF_LARGE_MODEL=/repository
HF_LARGE_CONTEXT_TOKENS=262144
IMAGE_API_URL=https://it1i1rf992g05u29.us-east-1.aws.endpoints.huggingface.cloud
VIDEO_API_URL=https://s4u9zdezthdwes8o.us-east-1.aws.endpoints.huggingface.cloud
PORT=3001
NODE_ENV=production
FRONTEND_URL=https://app.loop-gpt.cyou
```

---

## 🎨 Frontend Server

**Location**: Local (can be deployed to Railway)  
**Port**: 3000  
**Status**: ✅ RUNNING  
**Framework**: Next.js 14

### Environment Variables
```env
NEXT_PUBLIC_API_URL=https://api.loop-gpt.cyou
```

---

## 📊 API Endpoints Available

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | Health check |
| POST | `/api/auth/register` | User registration |
| POST | `/api/auth/login` | User login |
| GET | `/api/conversations` | List conversations |
| POST | `/api/conversations` | Create conversation |
| POST | `/api/conversations/:id/stream` | Stream chat (SSE) |
| GET | `/api/conversations/:id/messages` | Get message history |
| POST | `/api/conversations/:id/upload-image` | Upload image |

---

## 🔐 Cloudflare API Configuration

**Account ID**: <CF_ACCOUNT_ID>  
**Zone ID**: <CF_ZONE_ID>  
**Token Status**: ✅ Active (Edit Zone DNS permissions)

---

## 📋 Current Running Processes

| Process | PID | Status | Port |
|---------|-----|--------|------|
| cloudflared | 21012 | ✅ Running | - |
| Node.js (Backend) | Running | ✅ Running | 3001 |
| Node.js (Frontend) | Running | ✅ Running | 3000 |

---

## 🧪 Test Commands

### Test Backend API
```bash
# Health check
curl https://api.loop-gpt.cyou/health

# Create conversation
curl -X POST https://api.loop-gpt.cyou/api/conversations \
  -H "Content-Type: application/json" \
  -d '{}'

# Test chat (requires auth token in production)
curl -X POST https://api.loop-gpt.cyou/api/conversations/CONV_ID/stream \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"content": "Hello!", "mode": "chat"}'
```

### Test Frontend
```bash
# Load frontend
curl https://app.loop-gpt.cyou

# Should return HTML (~25KB)
```

---

## ⚠️ Next Steps for Full Production

### 1. Deploy Backend to VPS (194.15.36.172)
```bash
# Upload files via SCP/WinSCP
scp -r backend/* root@194.15.36.172:/opt/loop-gpt/backend/

# SSH and run deployment script
ssh root@194.15.36.172
cd /opt/loop-gpt/backend
bash deploy-backend.sh
```

### 2. Update Cloudflare Tunnel
After backend is on VPS, update tunnel config:
```yaml
# On VPS, run cloudflared pointing to local backend
cloudflared tunnel run loop-gpt-backend
```

### 3. Deploy Frontend to Railway (Optional)
```bash
cd frontend
.\deploy-railway.ps1 -BackendUrl "https://api.loop-gpt.cyou"
```

### 4. Enable SSL/TLS
Cloudflare automatically provides SSL for tunnel routes.

---

## 📞 Support & Monitoring

### Check Tunnel Status
```bash
C:\Users\chris\cloudflared.exe tunnel list
C:\Users\chris\cloudflared.exe tunnel info loop-gpt-backend
```

### Check Backend Logs
```bash
# Local
Get-Content C:\Users\chris\AppData\Local\Temp\loop-gpt-backend.log -Tail 50

# VPS (after deployment)
pm2 logs loop-gpt-backend
```

### DNS Verification
```bash
nslookup api.loop-gpt.cyou
nslookup app.loop-gpt.cyou
```

---

## ✅ VERIFICATION CHECKLIST

- [x] Cloudflare tunnel created and running
- [x] DNS records configured via API
- [x] Backend server running on port 3001
- [x] Frontend server running on port 3000
- [x] HuggingFace endpoints configured
- [x] Backend .env updated with production URLs
- [ ] Backend deployed to VPS (pending SSH connectivity)
- [ ] Frontend deployed to Railway (optional)
- [ ] Full end-to-end chat test via domain

---

## Addendum 2026-09-04 — LibreChat phase
- LibreChat deployed on Railway (svc `librechat` :3080, mongo volume, rag svc pgvector). Demo domain librechat-production-6215.up.railway.app.
- Custom endpoints `LoopGPTStd`/`LoopGPTLarge` speak to backend `/v1` (metering proven, $1.00→$0.999806 on probe keys).
- `/v1/embeddings` shipped (`loop-embed`, HF TEI MiniLM-384, metered); librechat-rag boots `EMBEDDINGS_PROVIDER=openai` against backend `/v1`.
- Agent runs fixed: LC container cannot reach `backend.railway.internal:3001` (private-network anomaly; RAG internal works) → yaml baseURL = backend public Railway URL (`https://backend-production-4d0d6.up.railway.app/v1`). Verified agents stream text with + without MCP tools (bare & tooled runs both return verbatim test tokens).
- Backend Dockerfile: CMD hardened (`sh ./docker-entrypoint.sh`) + entrypoint LF-normalized (CRLF killed exec).
- Known quirk: `railway up` backend build context must be wrapped as `<tmp>/backend/` (rootDirectory=/backend meta).
- **BYOK live (2026-09-05)**: both custom endpoints now `apiKey: "user_provided"` — each LibreChat user pastes their own `sk-loop-…` key (from `/developers` portal) via Settings→Endpoints (stored as JSON `{apiKey}`). Acceptance: fresh user, fresh key, agent streams `AGENT-OK-BYOK`, user balance drains $1.00→$0.999974 (`/api/developer/overview` proof). Stored value must be JSON (`{apiKey}`), raw strings fail `invalid_user_key`.
- **Netprobe verdict**: `backend.railway.internal` resolves (10.x + fd12::) but :3001 answers ECONNREFUSED — backend service has no private-network port entry for 3001 (Railway networking setting). Until added, LC↔backend and RAG↔backend stay on public Railway URLs (working, fast). LC↔RAG private :8000 works (registered).
- **Aurora UI (2026-09-05, commit d72978b)**: full premium reskin shipped. New design system in `frontend/app/globals.css` (deep-ink base, iris `#8b7cf8`→cyan gradients, glass/spotlight/aurora/border-gradient utilities, reduced-motion guards; every legacy class name preserved). Landing rebuilt (hero + mock Agent Computer panel, stats band, platforms tri-card, bento features, glow pricing, syntax-colored API quickstart, CTA band, 4-column footer). Entire app surface (chat shell, auth, developers, legal, video studio, settings, composer/sidebar/model-picker) mechanically retinted to the iris palette. New `/og.png` social card wired into metadata. Frontend build green (20 routes, landing 135 kB first-load). Live-verified: funnel 8/8 routes 200, `og.png` 200, all 8 skin markers present in prod HTML.
- **GitHub→Railway webhook unreliability**: pushes to `main` did NOT trigger backend/frontend builds today; manual `railway up` (flat context, wrapped as `<ctx>/<service>/` per each service's `rootDirectory`) is the reliable channel until webhook healed.

---

## Branded-domain remediation (2026-09-05)

**Root cause of the "domain not pointed" issue:** `api.`/`app.` CNAMEs pointed at `*.cfargotunnel.com` UNPROXIED (grey). `cfargotunnel.com` resolves globally to a private `fd10::` ULA by design — grey tunnel records are broken for the entire internet. Apex worked only because it is proxied (orange). Additionally the tunnel connector ran on the home PC (site-down-if-laptop-off).

**Done autonomously:**
- `cf-tunnel` Railway service deployed (deploy/cloudflared/, distroless shell-less image, creds baked — private repo; tunnel creds only permit RUNNING the tunnel; rotate via `cloudflared tunnel token` anytime). Connector linux_amd64 registered 4× (region sin). Home connector killed + Startup task deleted; `cloudflared tunnel info` shows only linux connector. Tunnel ingress now arms `api`, `app`, apex, `www`, AND `chat.loop-gpt.cyou` (LibreChat) — all verified against the live connector.
- Railway custom domains: `chat.loop-gpt.cyou` → librechat :3080 (claim ACTIVE); `api.loop-gpt.cyou` → backend (verified YES, certificate VALID since Aug, target CNAME `6nzrbghb.up.railway.app`); `app.loop-gpt.cyou` → frontend (new claim, target CNAME `qe9xizva.up.railway.app`). Apex untouched (working).

**Remaining (user, ~2 min in Cloudflare dashboard):**
| Record | Change to |
|---|---|
| `api` | CNAME `6nzrbghb.up.railway.app` (grey ok — cert already VALID) |
| `app` | CNAME `qe9xizva.up.railway.app` (grey) |
| `chat` | CNAME `x46wia9t.up.railway.app` (grey) |

Apex stays as-is. Stray record `chat.loop-gpt.cyou.sendrise.online` (wrong-zone artifact of the expired sendrise cert) may be deleted for tidiness. Verify afterwards: `deploy\verify-brand-dns.ps1` (DoH + routing + connector census). Tunnel remains as dead-man switch: if records later prefer the tunnel instead, orange-proxy them (records MUST be proxied for tunnel hostnames).

---

## DNS CUTOVER EXECUTED (2026-09-05) — brand fully live via direct Railway

Cloudflare API (account-scoped token stored at `~/.cloudflared/cf-api-token.txt`, OUTSIDE the repo) performed the surgery on zone `loop-gpt.cyou`:

| Host | Final record | Railway target | Status |
|---|---|---|---|
| `loop-gpt.cyou` | CNAME proxied (unchanged) | `z8n20ytb.up.railway.app` | serving since before |
| `api.loop-gpt.cyou` | CNAME grey | `6nzrbghb.up.railway.app` | Verified + cert **VALID** |
| `app.loop-gpt.cyou` | CNAME grey | `qe9xizva.up.railway.app` | Verified + cert **VALID** |
| `chat.loop-gpt.cyou` | CNAME grey | `x46wia9t.up.railway.app` | Verified + cert **VALID** |

Old `api`/`app` → `cfargotunnel.com` grey records REPLACED (they were globally broken: cfargotunnel resolves to private fd10:: when unproxied). All four `_railway-verify` TXTs in place; mail cluster (MX/SPF/DKIM/DMARC) untouched. `www` intentionally absent (no-www policy; frontend is at hobby-plan 2-domain cap — add a Cloudflare Redirect Rule www→apex for free if wanted).

**Live proofs**: apex+`/chat`+`/developers` 200 · `app` 200 · `chat /api/config` 200 `appTitle:"Loop GPT"` · branded `/v1/models` 6 models · **BYOK regression gate DOUBLE-PASS through branded domains** (register→mint→attach→`AGENT-OK-BYOK`→$0.999974 drain).

**cf-tunnel service** is now fully redundant (no DNS references the tunnel) — kept as hot spare; delete via Railway dashboard (svc `cf-tunnel`) or `railway delete` when comfortable.

---

## BYOK rollback → zero-friction pool-key (2026-09-05, commit 0a7c21c)

User-facing symptoms: "OpenAI models" shown in picker; "No key found. Please provide the key again." on send.
Causes: (a) strict BYOK (`apiKey: user_provided`) demanded a per-user key paste for every visitor; (b) leftover `OPENAI_API_KEY`/`OPENAI_BASE_URL` envs rendered a phantom native-openAI endpoint.

Resolution:
- yaml: both LoopGPT endpoints back to the shared pool `sk-loop-…` key → chat works with ZERO setup.
- Removed the two phantom env vars from the librechat service.
- Proof: fresh-user harness (no key attach) — bare + MCP-tooled agents both stream `AGENT-OK`; `/api/endpoints` lists ONLY agents/LoopGPTStd/LoopGPTLarge with keyRequired=false.
- Strict per-user metering remains available in one line (`apiKey: "user_provided"`) if/when consumer-onboarding (guided key paste) is built; `/developers` portal + per-user keys unaffected on the backend side.
- Railpack snapshot-cache re-corruption seen again on deploy — cured by Dockerfile comment-bump rebuild (now a known workaround). Home-PC connector + autostart: already removed.

---

**Last Updated**: 2026-08-20 03:31 UTC  
**Deployment Engineer**: Automated Deployment System