param(
    [ValidateRange(1024, 65535)]
    [int]$Port = 8010
)

$ErrorActionPreference = 'Stop'
$baseUrl = "http://127.0.0.1:$Port"
try {
    $page = Invoke-WebRequest "$baseUrl/" -UseBasicParsing -TimeoutSec 10
    if ($page.Content -notmatch '<title>[^<]*Fu.ball') {
        throw "Auf Port $Port läuft nicht die erwartete Fußballseite. Kein Dienst wurde verändert."
    }
    $meta = Invoke-RestMethod "$baseUrl/api/meta" -TimeoutSec 30
    if (-not $meta.n_matches -or $meta.data_version -lt 1) { throw 'Keine verwertbaren Spieldaten.' }
    if ([datetime]$meta.date_max -ge [datetime]'2026-06-01' -or @($meta.seasons | Where-Object { $_ -gt 2025 }).Count) {
        throw 'Die API liefert Daten nach dem freigegebenen Saisonende 31.05.2026.'
    }
    $status = Invoke-RestMethod "$baseUrl/api/status" -TimeoutSec 10
    [PSCustomObject]@{
        Webseite = $baseUrl
        Spiele = $meta.n_matches
        Datenversion = $meta.data_version
        LetztesSpiel = $meta.date_max
        Analyseende = '2026-05-31'
        Betrieb = $status
    } | ConvertTo-Json -Depth 8
} catch {
    Write-Error "Lokale Prüfung fehlgeschlagen: $($_.Exception.Message)"
    exit 1
}
