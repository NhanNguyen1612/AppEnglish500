$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $currentDir

Get-Process -Id (Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue).OwningProcess -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.MessageBox]::Show("Đã tắt máy chủ TOEIC Moon (localhost:3000) thành công!", "TOEIC Moon Pro", [System.Windows.Forms.MessageBoxButtons]::OK, [System.Windows.Forms.MessageBoxIcon]::Information) | Out-Null
