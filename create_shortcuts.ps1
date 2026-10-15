$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)

# Shortcut 1: TOEIC Moon Pro (Start & Open)
$Shortcut1 = $WshShell.CreateShortcut("$DesktopPath\TOEIC Moon Pro.lnk")
$Shortcut1.TargetPath = "powershell.exe"
$Shortcut1.Arguments = '-WindowStyle Hidden -ExecutionPolicy Bypass -File "D:\AppEnglishStudy\start_app.ps1"'
$Shortcut1.WorkingDirectory = "D:\AppEnglishStudy"
$Shortcut1.Description = "Mo ung dung luyen thi TOEIC Moon.vn 550+"
$Shortcut1.IconLocation = "$env:SystemRoot\System32\shell32.dll, 14"
$Shortcut1.Save()

# Shortcut 2: Tat Server TOEIC (Stop)
$Shortcut2 = $WshShell.CreateShortcut("$DesktopPath\Tat Server TOEIC.lnk")
$Shortcut2.TargetPath = "powershell.exe"
$Shortcut2.Arguments = '-WindowStyle Hidden -ExecutionPolicy Bypass -File "D:\AppEnglishStudy\stop_app.ps1"'
$Shortcut2.WorkingDirectory = "D:\AppEnglishStudy"
$Shortcut2.Description = "Dung may chu TOEIC Moon (localhost:3000)"
$Shortcut2.IconLocation = "$env:SystemRoot\System32\shell32.dll, 27"
$Shortcut2.Save()

Write-Host "Desktop shortcuts updated successfully!"
