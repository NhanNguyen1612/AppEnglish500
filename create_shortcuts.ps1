$WshShell = New-Object -ComObject WScript.Shell
$DesktopPath = [System.Environment]::GetFolderPath([System.Environment+SpecialFolder]::Desktop)

# Shortcut 1: TOEIC Moon Pro (Start & Open)
$Shortcut1 = $WshShell.CreateShortcut("$DesktopPath\TOEIC Moon Pro.lnk")
$Shortcut1.TargetPath = "wscript.exe"
$Shortcut1.Arguments = '"D:\AppEnglishStudy\start_app.vbs"'
$Shortcut1.WorkingDirectory = "D:\AppEnglishStudy"
$Shortcut1.Description = "Mo ung dung luyen thi TOEIC Moon.vn 550+"
$Shortcut1.IconLocation = "$env:SystemRoot\System32\shell32.dll, 14"
$Shortcut1.Save()

# Shortcut 2: Tat Server TOEIC (Stop)
$Shortcut2 = $WshShell.CreateShortcut("$DesktopPath\Tat Server TOEIC.lnk")
$Shortcut2.TargetPath = "wscript.exe"
$Shortcut2.Arguments = '"D:\AppEnglishStudy\stop_app.vbs"'
$Shortcut2.WorkingDirectory = "D:\AppEnglishStudy"
$Shortcut2.Description = "Dung may chu TOEIC Moon (localhost:3000)"
$Shortcut2.IconLocation = "$env:SystemRoot\System32\shell32.dll, 27"
$Shortcut2.Save()

Write-Host "Created shortcuts successfully on Desktop!"
Get-ChildItem -Path $DesktopPath -Filter "*TOEIC*" | Select-Object Name, Length, LastWriteTime
