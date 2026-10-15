Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
currentDir = fso.GetParentFolderName(WScript.ScriptFullName)
WshShell.CurrentDirectory = currentDir

' Check if port 3000 is running
Set oExec = WshShell.Exec("cmd /c netstat -ano | findstr :3000 | findstr LISTENING")
output = oExec.StdOut.ReadAll()

If InStr(output, "LISTENING") = 0 Then
    WshShell.Run "cmd /c node server.js", 0, False
    WScript.Sleep 2000
End If

WshShell.Run "http://localhost:3000"
