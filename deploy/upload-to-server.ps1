# Loop GPT Backend - SCP Upload Script for Windows
# Run this in PowerShell after confirming SSH connectivity

$SERVER_IP = "194.15.36.172"
$SERVER_USER = "root"
$SERVER_PASS = "l52AJKKP7r1lJ7bTnpL4"
$LOCAL_BACKEND = "C:\Users\chris\projects\development\Loop_GPT_original\backend"
$REMOTE_DIR = "/opt/loop-gpt/backend"

Write-Host "=========================================="
Write-Host "  Loop GPT Backend - File Upload Script"
Write-Host "=========================================="
Write-Host ""

# Test connection first
Write-Host "Testing SSH connection..."
$testResult = plink.exe -ssh $SERVER_USER@$SERVER_IP -pw $SERVER_PASS "echo 'Connection successful'" 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Cannot connect to server. Please check:"
    Write-Host "  1. Server IP address is correct"
    Write-Host "  2. SSH is running on port 22"
    Write-Host "  3. Firewall allows connections from your IP"
    Write-Host "  4. Credentials are correct"
    exit 1
}
Write-Host "SSH connection successful!"
Write-Host ""

# Create remote directory
Write-Host "Creating remote directory..."
plink.exe -ssh $SERVER_USER@$SERVER_IP -pw $SERVER_PASS "mkdir -p $REMOTE_DIR"

# Upload backend files using PSCP
Write-Host "Uploading backend files..."
$pscpPath = "C:\Users\chris\AppData\Local\Temp\deploy\pscp.exe"
if (!(Test-Path $pscpPath)) {
    Write-Host "Downloading PSCP..."
    Invoke-WebRequest -Uri "https://the.earth.li/~sgtatham/putty/latest/w64/pscp.exe" -OutFile $pscpPath -UseBasicParsing
}

# Upload files
& $pscpPath -r -pw $SERVER_PASS "$LOCAL_BACKEND\*" "$SERVER_USER@$SERVER_IP`:$REMOTE_DIR"

Write-Host ""
Write-Host "Files uploaded successfully!"
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. SSH into the server: plink.exe -ssh root@$SERVER_IP -pw $SERVER_PASS"
Write-Host "  2. Run the deployment script: cd $REMOTE_DIR && bash deploy.sh"
Write-Host ""