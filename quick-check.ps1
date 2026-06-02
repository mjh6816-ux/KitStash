$env:PATH = "C:\Program Files\nodejs;" + $env:PATH
& "C:\Program Files\nodejs\npm.cmd" run build 2>&1 | Out-File "build-check.txt" -Encoding UTF8
"EXIT=" + $LASTEXITCODE
Get-Content "build-check.txt" -TotalCount 40
