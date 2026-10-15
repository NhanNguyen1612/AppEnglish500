Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "powershell -NoProfile -Command ""Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }""", 0, True
WshShell.Popup "Đã tắt máy chủ TOEIC Moon (localhost:3000) thành công!", 3, "TOEIC Moon Pro", 64
