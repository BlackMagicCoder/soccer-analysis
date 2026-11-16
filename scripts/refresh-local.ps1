param(
    [ValidatePattern('^[1-5](,[1-5])*$')]
    [string]$Leagues = '1,2,3,4,5',
    [ValidatePattern('^20(1[4-9]|2[0-5])(,20(1[4-9]|2[0-5]))*$')]
    [string]$Seasons = '2025',
    [ValidateRange(0, 10000)]
    [int]$WeatherLimit = 50,
    [switch]$WeatherOnly,
    [switch]$Watch
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $projectRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Zuerst uv sync --frozen ausführen.' }
$localData = if ($env:SOCCER_DATA_DIR) { $env:SOCCER_DATA_DIR } else { Join-Path $projectRoot 'data' }
$logDirectory = Join-Path $localData 'logs'
New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
$env:PYTHONIOENCODING = 'utf-8'

do {
    $logPath = Join-Path $logDirectory ('refresh-' + (Get-Date -Format 'yyyyMMdd-HHmmss-fff') + '.log')
    $arguments = @('-m', 'soccer_api.refresh', '--leagues', $Leagues, '--seasons', $Seasons,
                   '--weather-limit', $WeatherLimit)
    if ($WeatherOnly) { $arguments += '--weather-only' }
    "Start: $((Get-Date).ToString('o')); Analyse bis 2026-05-31; Saisons: $Seasons" |
        Out-File -LiteralPath $logPath -Encoding utf8
    # Capture stderr without terminating Windows PowerShell on native diagnostic output.
    $ErrorActionPreference = 'Continue'
    & $python @arguments 2>&1 | ForEach-Object {
        $line = $_.ToString()
        Write-Host $line
        $line | Out-File -LiteralPath $logPath -Encoding utf8 -Append
    }
    $refreshExitCode = $LASTEXITCODE
    $ErrorActionPreference = 'Stop'
    "Ende: $((Get-Date).ToString('o')); Exitcode: $refreshExitCode" |
        Out-File -LiteralPath $logPath -Encoding utf8 -Append
    Write-Host "Protokoll: $logPath"
    if (-not $Watch) { exit $refreshExitCode }
    Write-Host 'Nächster Versuch in 24 Stunden. Strg+C beendet den lokalen Prozess.'
    Start-Sleep -Seconds 86400
} while ($Watch)
