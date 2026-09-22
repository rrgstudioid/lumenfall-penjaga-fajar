param([Parameter(Mandatory=$true)][string]$Destination)
$ErrorActionPreference = 'Stop'
$sourceRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$targetRoot = (Resolve-Path -LiteralPath $Destination).Path
if ($targetRoot -ne (Join-Path $sourceRoot 'sites-reconcile-v2')) { throw 'Unexpected release checkout.' }
if (!(Test-Path -LiteralPath (Join-Path $targetRoot '.git'))) { throw 'Release checkout needs its own Git history.' }
$sourceId = (Get-Content -Raw (Join-Path $sourceRoot '.openai/hosting.json') | ConvertFrom-Json).project_id
$targetId = (Get-Content -Raw (Join-Path $targetRoot '.openai/hosting.json') | ConvertFrom-Json).project_id
if ($sourceId -ne $targetId) { throw 'Site identity mismatch.' }
$directories = @('app','components','data','hooks','lib','public','docs','scripts','tests','.openai')
$copied = 0; $removed = 0
foreach ($name in $directories) {
  $src = Join-Path $sourceRoot $name
  $dst = Join-Path $targetRoot $name
  foreach ($file in @(Get-ChildItem -LiteralPath $dst -File -Recurse -Force -ErrorAction SilentlyContinue)) {
    $relative = [IO.Path]::GetRelativePath($dst, $file.FullName)
    if (!(Test-Path -LiteralPath (Join-Path $src $relative))) {
      Remove-Item -LiteralPath $file.FullName -Force
      $removed++
    }
  }
  foreach ($file in Get-ChildItem -LiteralPath $src -File -Recurse -Force) {
    $out = Join-Path $dst ([IO.Path]::GetRelativePath($src,$file.FullName))
    New-Item -ItemType Directory -Force -Path ([IO.Path]::GetDirectoryName($out)) | Out-Null
    Copy-Item -LiteralPath $file.FullName -Destination $out -Force
    if ((Get-FileHash -LiteralPath $file.FullName).Hash -ne (Get-FileHash -LiteralPath $out).Hash) { throw "Copy verification failed: $out" }
    $copied++
  }
  Get-ChildItem -LiteralPath $dst -Directory -Recurse -Force | Sort-Object { $_.FullName.Length } -Descending | ForEach-Object {
    if (!(Get-ChildItem -LiteralPath $_.FullName -Force)) { Remove-Item -LiteralPath $_.FullName }
  }
}
foreach ($name in @('.gitignore','.npmrc','.oxfmtrc.json','.oxlintrc.json','AGENTS.md','components.json','next.config.ts','package.json','pnpm-lock.yaml','pnpm-workspace.yaml','tsconfig.json','vite.config.ts','Start-Lumenfall-Light.cmd')) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $name) -Destination (Join-Path $targetRoot $name) -Force
}
[pscustomobject]@{ CopiedAndHashVerified=$copied; StaleFilesRemoved=$removed; Destination=$targetRoot } | ConvertTo-Json
