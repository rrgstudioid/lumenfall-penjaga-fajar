param([switch]$Move)
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$backup = 'C:\Users\USER\Documents\LUMENFALL_RELEASE_BACKUP_20260922'
$targets = @(Get-ChildItem -LiteralPath $root -Directory -Force | Where-Object {
  $_.Name -eq '.package-stage' -or $_.Name -like '.site-package-*' -or $_.Name -eq '.site-tmp-v2'
})
foreach ($dir in $targets) {
  $entries = @(Get-ChildItem -LiteralPath $dir.FullName -Force)
  if ($entries | Where-Object { $_.Name -ne 'dist' -and $_.Name -notlike '*.tar.gz' }) { throw "Unexpected source in $($dir.Name)" }
}
$targets += @(Get-ChildItem -LiteralPath $root -File -Filter 'lumenfall-*.tar.gz')
foreach ($relative in @('sites-reconcile','sites-source-staging','sites-reconcile-v2/dist','sites-reconcile-v2/lumenfall-sites-v1.tar.gz')) {
  $p = Join-Path $root $relative
  if (Test-Path -LiteralPath $p) { $targets += Get-Item -LiteralPath $p -Force }
}
$plan = foreach ($entry in $targets) {
  $src = (Resolve-Path -LiteralPath $entry.FullName).Path
  $rel = [IO.Path]::GetRelativePath($root,$src)
  $dst = [IO.Path]::GetFullPath((Join-Path $backup $rel))
  if (!$src.StartsWith($root+'\') -or !$dst.StartsWith($backup+'\') -or $src -eq $root) { throw 'Unsafe move target.' }
  if (Test-Path -LiteralPath $dst) { throw "Backup already exists: $dst" }
  $files = if ($entry.PSIsContainer) { @(Get-ChildItem -LiteralPath $src -File -Recurse -Force) } else { @($entry) }
  [pscustomobject]@{Source=$src;Destination=$dst;Bytes=($files|Measure-Object Length -Sum).Sum;Files=$files.Count}
}
$plan | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $root 'output/release-audit/archive-plan.json')
if ($Move) {
  foreach ($entry in $plan) {
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($entry.Destination)) -Force | Out-Null
    Move-Item -LiteralPath $entry.Source -Destination $entry.Destination
  }
}
[pscustomobject]@{Moved=[bool]$Move;Targets=$plan.Count;Bytes=($plan|Measure-Object Bytes -Sum).Sum;Backup=$backup} | ConvertTo-Json
