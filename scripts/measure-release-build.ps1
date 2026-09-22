param([string]$Project = (Join-Path $PSScriptRoot '..'))
$ErrorActionPreference = 'Stop'
$Project = (Resolve-Path -LiteralPath $Project).Path
$node = (Get-Command node -ErrorAction Stop).Source
$cli = Join-Path $Project 'node_modules/vinext/dist/cli.js'
if (!(Test-Path -LiteralPath $cli)) { $cli = Join-Path $Project '../node_modules/vinext/dist/cli.js' }
$out = Join-Path $Project 'output/release-audit'
New-Item -ItemType Directory -Force -Path $out | Out-Null
$clock = [Diagnostics.Stopwatch]::StartNew()
$proc = Start-Process -FilePath $node -ArgumentList @(('"' + $cli + '"'), 'build') -WorkingDirectory $Project -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $out 'build.stdout.log') -RedirectStandardError (Join-Path $out 'build.stderr.log')
$peak = 0L
while (!$proc.HasExited) {
  $proc.Refresh()
  $peak = [Math]::Max($peak,$proc.PeakWorkingSet64)
  Start-Sleep -Milliseconds 100
}
$proc.WaitForExit()
$result = [pscustomobject]@{ExitCode=$proc.ExitCode;Seconds=[math]::Round($clock.Elapsed.TotalSeconds,2);PeakNodeWorkingSetMB=[math]::Round($peak/1MB,1)}
$result | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $out 'build-metrics.json')
$result | ConvertTo-Json
Get-Content -LiteralPath (Join-Path $out 'build.stderr.log') | Select-Object -Last 20
if ($proc.ExitCode -ne 0) { throw 'Production build failed.' }
