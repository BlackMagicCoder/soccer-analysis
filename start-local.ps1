param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8010,
    [switch]$SkipBuild
)

$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot

if (-not (Test-Path -LiteralPath '.venv/Scripts/python.exe')) {
    & uv sync --frozen
    if ($LASTEXITCODE -ne 0) { throw 'Python-Abhängigkeiten konnten nicht installiert werden.' }
}
if (-not (Test-Path -LiteralPath 'web/node_modules')) {
    Push-Location web
    try {
        & npm ci
        if ($LASTEXITCODE -ne 0) { throw 'Web-Abhängigkeiten konnten nicht installiert werden.' }
    } finally { Pop-Location }
}
if (-not $SkipBuild) {
    Push-Location web
    try {
        & npm run build
        if ($LASTEXITCODE -ne 0) { throw 'Web-Build fehlgeschlagen.' }
    } finally { Pop-Location }
} elseif (-not (Test-Path -LiteralPath 'web/dist/index.html')) {
    throw 'Kein Web-Build vorhanden. Ohne -SkipBuild starten.'
}

Write-Host "Fussballanalyse: http://127.0.0.1:$Port - Beenden mit Strg+C"
& ./.venv/Scripts/python.exe -m uvicorn soccer_api.main:app --host 127.0.0.1 --port $Port
exit $LASTEXITCODE
