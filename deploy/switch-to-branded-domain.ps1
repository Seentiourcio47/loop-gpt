<#
  switch-to-branded-domain.ps1

  Run this AFTER the Cloudflare DNS change has propagated:
      CNAME  api  ->  6nzrbghb.up.railway.app   (proxy OFF / grey cloud)

  It flips LoopGPT from the raw Railway hostname to https://api.loop-gpt.cyou,
  redeploys both services, and verifies the result. Safe to re-run.

  Usage:  powershell -File switch-to-branded-domain.ps1
#>

$ErrorActionPreference = 'Stop'

$API      = 'https://api.loop-gpt.cyou'
$PROJECT  = 'c4381399-65b9-4998-8716-b1d5b71c802f'
$ENVID    = '78eea8e7-c69e-427d-bcee-57b33cb88f9c'
$BACKEND  = '7cdb5a45-eca1-44c1-ad18-ba923ae9057a'
$FRONTEND = '8952a1f5-b4be-4677-89d5-771137647091'
$REPO     = 'C:\Users\chris\Desktop\Workspace\dev-projects\projects\development\Loop_GPT_original'

$tok = (Get-Content "$env:USERPROFILE\.railway\config.json" -Raw | ConvertFrom-Json).user.accessToken
function Gql($query, $vars) {
  $body = @{ query = $query; variables = $vars } | ConvertTo-Json -Depth 8
  Invoke-RestMethod -Uri 'https://backboard.railway.com/graphql/v2' -Method Post `
    -Headers @{ Authorization = "Bearer $tok" } -ContentType 'application/json' -Body $body
}

# ---- 1. Pre-flight: DNS must no longer point at the dead tunnel -------------
Write-Host '== Checking DNS ==' -ForegroundColor Cyan
$rec   = Resolve-DnsName -Name 'api.loop-gpt.cyou' -Server 1.1.1.1 -ErrorAction SilentlyContinue
$cname = ($rec | Where-Object Type -eq 'CNAME' | Select-Object -ExpandProperty NameHost) -join ','
if ($cname -match 'cfargotunnel') {
  Write-Host "ABORT: api.loop-gpt.cyou still points at the dead tunnel ($cname)." -ForegroundColor Red
  Write-Host 'Change the Cloudflare CNAME to 6nzrbghb.up.railway.app (proxy OFF) first.' -ForegroundColor Red
  exit 1
}
Write-Host "DNS ok (CNAME=$cname)" -ForegroundColor Green

Write-Host '== Checking origin reachability ==' -ForegroundColor Cyan
$h = Invoke-WebRequest "$API/health" -TimeoutSec 30 -SkipHttpErrorCheck
if ($h.StatusCode -ne 200) { Write-Host "ABORT: $API/health returned $($h.StatusCode)" -ForegroundColor Red; exit 1 }
Write-Host "$API/health -> 200" -ForegroundColor Green

# ---- 2. Flip the env vars ---------------------------------------------------
Write-Host '== Updating environment variables ==' -ForegroundColor Cyan
Push-Location $REPO
railway variables --service backend  --set "OAUTH_CALLBACK_BASE=$API" --set "PUBLIC_API_URL=$API" --skip-deploys | Out-Null
railway variables --service frontend --set "NEXT_PUBLIC_API_URL=$API" --skip-deploys | Out-Null
Pop-Location
Write-Host 'Set OAUTH_CALLBACK_BASE, PUBLIC_API_URL, NEXT_PUBLIC_API_URL' -ForegroundColor Green

# ---- 3. Redeploy both services, pinned to the current commit ----------------
# Railway redeploys the PREVIOUS commit unless commitSha is supplied explicitly.
Push-Location $REPO
$sha = (git rev-parse HEAD).Trim()
Pop-Location
Write-Host "== Deploying $sha ==" -ForegroundColor Cyan

$deployQ = 'mutation($si:String!,$e:String!,$c:String!){serviceInstanceDeployV2(serviceId:$si, environmentId:$e, commitSha:$c)}'
$ids = @{}
foreach ($svc in @(@{ n = 'backend'; id = $BACKEND }, @{ n = 'frontend'; id = $FRONTEND })) {
  $r = Gql $deployQ @{ si = $svc.id; e = $ENVID; c = $sha }
  $ids[$svc.n] = $r.data.serviceInstanceDeployV2
  Write-Host "  $($svc.n) -> deployment $($ids[$svc.n])"
}

$statusQ = 'query($id:String!){deployment(id:$id){status}}'
foreach ($k in $ids.Keys) {
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Seconds 20
    $s = (Gql $statusQ @{ id = $ids[$k] }).data.deployment.status
    Write-Host "  $k : $s"
    if ($s -eq 'SUCCESS') { break }
    if ($s -match 'FAIL|CRASH') { Write-Host "$k deployment $s" -ForegroundColor Red; exit 1 }
  }
}

# ---- 4. Verify --------------------------------------------------------------
Write-Host '== Verifying ==' -ForegroundColor Cyan
Start-Sleep -Seconds 15
foreach ($u in @("$API/health", "$API/v1/pricing", 'https://loop-gpt.cyou/', 'https://loop-gpt.cyou/developers')) {
  $r = Invoke-WebRequest $u -TimeoutSec 45 -SkipHttpErrorCheck
  Write-Host ('  {0,-5} {1}' -f $r.StatusCode, $u)
}

$r = Invoke-WebRequest "$API/api/auth/oauth/google" -MaximumRedirection 0 -SkipHttpErrorCheck -TimeoutSec 45 -ErrorAction SilentlyContinue
$loc = $r.Headers.Location; if ($loc -is [array]) { $loc = $loc[0] }
$ru = [System.Web.HttpUtility]::ParseQueryString(([uri]$loc).Query)['redirect_uri']
Write-Host "  google redirect_uri = $ru"

Write-Host ''
Write-Host 'DONE. Final step - register these in the provider consoles:' -ForegroundColor Yellow
Write-Host "  Google : $API/api/auth/oauth/google/callback"
Write-Host "  GitHub : $API/api/auth/oauth/github/callback"
Write-Host ''
Write-Host 'Optional: once loop-gpt.cyou is a verified domain in Resend, run:' -ForegroundColor Yellow
Write-Host '  railway variables --service backend --set "MAIL_FROM=Loop GPT <no-reply@loop-gpt.cyou>"'
