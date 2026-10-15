Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Check if port 3000 is listening
Set oExec = WshShell.Exec("powershell -NoProfile -Command ""(Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue).Count""")
output = Trim(oExec.StdOut.ReadAll())

If output = "" Or output = "0" Then
    WshShell.Run "powershell -NoProfile -Command ""Start-Process -FilePath 'node' -ArgumentList 'server.js' -WorkingDirectory '" & currentDir & "' -WindowStyle Hidden""", 0, True
    WScript.Sleep 1500
End If

WshShell.Run "http://localhost:3000"
