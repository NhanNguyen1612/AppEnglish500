$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $currentDir

$conn = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if (-not $conn) {
    Start-Process -FilePath "node" -ArgumentList "server.js" -WorkingDirectory $currentDir -WindowStyle Hidden
    Start-Sleep -Seconds 2
}

Start-Process "http://localhost:3000"
