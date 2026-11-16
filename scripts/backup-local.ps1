param([string]$Directory)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$python = Join-Path $projectRoot '.venv/Scripts/python.exe'
if (-not (Test-Path -LiteralPath $python)) { throw 'Zuerst uv sync --frozen ausführen.' }
$arguments = @((Join-Path $PSScriptRoot 'backup_db.py'))
if ($Directory) { $arguments += @('--directory', $Directory) }
& $python @arguments
exit $LASTEXITCODE
