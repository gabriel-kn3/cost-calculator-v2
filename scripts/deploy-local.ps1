<#
  Deploys this repo to the installed copy that the desktop shortcut runs.

    npm run build
    powershell -ExecutionPolicy Bypass -File scripts\deploy-local.ps1

  The installed copy holds the operator's real data. This script never
  modifies anything under data\, and refuses to run unless it can first:
    1. confirm the app is stopped (a live database cannot be backed up safely)
    2. back up app.db + app.db-wal + app.db-shm TOGETHER to two locations and
       verify every byte -- most recent work can live only in the -wal file,
       so copying app.db alone silently loses it
  Code folders are swapped with the previous versions kept beside them, so a
  rollback is a rename. Migrations apply on the next launch.
#>
param(
  [string]$Install = "C:\ProgramData\HMBB Cost Calculator",
  [int]$Port = 5180
)
$ErrorActionPreference = 'Stop'
$repo  = Split-Path -Parent $PSScriptRoot
$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$data  = Join-Path $Install "data"

function Step($m) { Write-Host "`n== $m" -ForegroundColor Cyan }
function Hashes($dir) {
  Get-ChildItem $dir -File | Sort-Object Name | ForEach-Object {
    "$($_.Name) $((Get-FileHash $_.FullName -Algorithm SHA256).Hash)"
  }
}

Step "Preflight"
if (-not (Test-Path (Join-Path $data "app.db"))) { throw "No database at $data -- wrong install path?" }
if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
  throw "The app is running on port $Port. Close it (or stop its node process) first."
}
if (-not (Test-Path (Join-Path $repo "dist\index.html"))) { throw "No build found. Run 'npm run build' first." }
"app stopped, build present"

Step "Back up the database (all three files together) to two places"
$targets = @(
  (Join-Path (Split-Path $Install -Parent) "HMBB Cost Calculator Backups\$stamp-pre-deploy"),
  (Join-Path ([Environment]::GetFolderPath("MyDocuments")) "HMBB Cost Calculator Backups\$stamp-pre-deploy")
)
$source = Hashes $data
foreach ($t in $targets) {
  New-Item -ItemType Directory -Force -Path $t | Out-Null
  Get-ChildItem $data -File | Copy-Item -Destination $t
  Copy-Item (Join-Path $data "seed") (Join-Path $t "seed") -Recurse -ErrorAction SilentlyContinue
  if (Compare-Object $source (Hashes $t)) { throw "Backup verification FAILED for $t -- nothing deployed." }
  "verified: $t"
}

Step "Swap code (data\ is never touched)"
foreach ($dir in "dist", "server", "shared", "drizzle") {
  $dest = Join-Path $Install $dir
  if (Test-Path $dest) { Rename-Item $dest "$dir.prev-$stamp" }
  Copy-Item (Join-Path $repo $dir) $dest -Recurse
  "replaced $dir  (previous kept as $dir.prev-$stamp)"
}
Copy-Item (Join-Path $Install "package.json") (Join-Path $Install "package.json.prev-$stamp")
Copy-Item (Join-Path $repo "package.json") (Join-Path $Install "package.json") -Force

Step "Confirm the swap did not touch the data"
if (Compare-Object $source (Hashes $data)) { throw "DATA FILES CHANGED DURING DEPLOY -- restore from $($targets[0])" }
"data files byte-identical"

Write-Host "`nDeployed. Launch from the desktop shortcut; pending migrations apply on start." -ForegroundColor Green
Write-Host "Backups: $($targets -join '  |  ')"
Write-Host "Rollback: stop the app, then rename each *.prev-$stamp folder back over its replacement."
