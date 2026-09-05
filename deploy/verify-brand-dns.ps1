#!/usr/bin/env pwsh
<#
  verify-brand-dns.ps1 — run AFTER updating Cloudflare DNS records.
  Verifies global resolution (DoH ground truth) and live routing for the
  loop-gpt.cyou branded surfaces. Exit 0 = all green.

  Expected Cloudflare DNS end-state (all DNS-only / grey unless noted):

    loop-gpt.cyou        A/AAAA  -> unchanged (already working, proxied)
    api.loop-gpt.cyou    CNAME   6nzrbghb.up.railway.app      (verified + cert VALID)
    app.loop-gpt.cyou    CNAME   qe9xizva.up.railway.app      (NEW claim; verifies via CNAME)
    chat.loop-gpt.cyou   CNAME   x46wia9t.up.railway.app      (NEW claim; verifies via CNAME)

  Redundant fallback (if you prefer keeping the tunnel): CNAME all three to
  bc0a90c0-e120-44ba-99ea-15a6d138619b.cfargotunnel.com AND enable the
  orange-cloud proxy — records MUST be proxied for tunnel hostnames to work.
#>

$ErrorActionPreference = 'SilentlyContinue'
$script:fails = 0

function Test-Brand($label, $url) {
  $code = curl.exe -4 -s -o NUL -w "%{http_code}" $url
  $ok = $code -eq '200'
  "{0,-26} {1}  {2}" -f $label, $code, $(if ($ok) { 'OK' } else { 'FAIL' })
  if (-not $ok) { $script:fails++ }
}

function Test-Resolve($h) {
  $r = Invoke-RestMethod -Uri "https://cloudflare-dns.com/dns-query?name=$h&type=CNAME" -Headers @{ accept = 'application/dns-json' } -TimeoutSec 15
  $cn = ($r.Answer | Where-Object { $_.type -eq 5 } | ForEach-Object { $_.data }) -join ','
  "{0,-26} CNAME={1}" -f $h, $(if ($cn) { $cn -replace '\.$', '' } else { '(none/NXDOMAIN)' })
}

Write-Host '== Global DNS (Cloudflare DoH, unbiased by local VPN) ==' -ForegroundColor Cyan
Test-Resolve 'api.loop-gpt.cyou'
Test-Resolve 'app.loop-gpt.cyou'
Test-Resolve 'chat.loop-gpt.cyou'

Write-Host ''
Write-Host '== Live routing ==' -ForegroundColor Cyan
Test-Brand 'apex /'           'https://loop-gpt.cyou/'
Test-Brand 'apex /chat'       'https://loop-gpt.cyou/chat'
Test-Brand 'api /api/health'  'https://api.loop-gpt.cyou/api/health'
Test-Brand 'api /v1/models'   'https://api.loop-gpt.cyou/v1/models'
Test-Brand 'app /'            'https://app.loop-gpt.cyou/'
Test-Brand 'chat /api/config' 'https://chat.loop-gpt.cyou/api/config'

Write-Host ''
Write-Host '== Tunnel connector census (want: linux_amd64 only) ==' -ForegroundColor Cyan
& 'C:\Program Files (x86)\cloudflared\cloudflared.exe' tunnel info loop-gpt-backend 2>&1 |
  Select-String 'CONNECTOR ID|linux_amd64|windows_amd64'

Write-Host ''
$status = if ($script:fails -eq 0) { 'ALL GREEN' } else { "$($script:fails) failing" }
Write-Host "RESULT: $status" -ForegroundColor $(if ($script:fails -eq 0) { 'Green' } else { 'Yellow' })
