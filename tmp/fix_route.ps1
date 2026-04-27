$path = 'c:\Users\eesa\OneDrive\Desktop\car dealer software\src\app\api\vehicles\route.ts'
$content = [System.IO.File]::ReadAllText($path)
$fixed = $content.Replace("real images```;\\n                    }", "real images```;`r`n                    }")
[System.IO.File]::WriteAllText($path, $fixed)
Write-Host "Done. Length: $($fixed.Length)"
