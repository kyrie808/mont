# Dump completo da producao Supabase via CLI -- schema + dados em arquivos separados
# Uso: .\supabase\scripts\dump-prod.ps1
# Saida: supabase/backups/dumps/dump-{schema,data}-YYYYMMDD-HHMMSS.sql
#
# Robustez (jul/2026): a telemetria PostHog do CLI causava latencia + ruido no
# stderr (e as vezes timeout); e falhas transientes de conexao ao pooler geravam
# arquivos 0-byte. Correcoes: DO_NOT_TRACK desliga a telemetria; cada dump roda
# com retry + backoff e so e aceito com exit=0 E arquivo nao-vazio.

$ErrorActionPreference = "Stop"

# Desliga a telemetria do CLI (PostHog) -- remove latencia e ruido no stderr.
$env:DO_NOT_TRACK = "1"

$timestamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir  = "supabase/backups/dumps"
$schemaFile = "$outputDir/dump-schema-$timestamp.sql"
$dataFile   = "$outputDir/dump-data-$timestamp.sql"
$maxRetries = 3

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

# Roda um `supabase db dump` com retry. Valida por exit code E tamanho do arquivo
# (0-byte = falha, mesmo com exit 0). stderr do CLI (progresso) e apenas ecoado --
# rodamos com ErrorActionPreference=Continue para que nao aborte o script.
function Invoke-Dump {
    param(
        [string]   $Label,
        [string]   $File,
        [string[]] $ExtraArgs = @()
    )

    for ($attempt = 1; $attempt -le $maxRetries; $attempt++) {
        Write-Host "[$Label] tentativa $attempt/$maxRetries -> $File" -ForegroundColor Yellow

        $prev = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        npx supabase db dump --linked @ExtraArgs --file $File 2>&1 |
            ForEach-Object { Write-Host "  $_" -ForegroundColor DarkGray }
        $code = $LASTEXITCODE
        $ErrorActionPreference = $prev

        $size = if (Test-Path $File) { (Get-Item $File).Length } else { 0 }

        if ($code -eq 0 -and $size -gt 0) {
            Write-Host "  [OK] $([math]::Round($size / 1KB, 1)) KB" -ForegroundColor Green
            return
        }

        Write-Host "  [FALHA] exit=$code size=$size (tentativa $attempt)" -ForegroundColor Red
        if (Test-Path $File) { Remove-Item $File -Force }   # descarta 0-byte
        if ($attempt -lt $maxRetries) {
            Start-Sleep -Seconds ($attempt * 4)             # backoff: 4s, 8s
        }
    }

    Write-Host "[ABORTADO] $Label falhou apos $maxRetries tentativas." -ForegroundColor Red
    Write-Host "Provavel causa transiente de conexao ao pooler -- tente de novo em instantes." -ForegroundColor Red
    exit 1
}

Write-Host "Iniciando dump da producao (linked project)..." -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Cyan
Write-Host ""

Invoke-Dump -Label "1/2 schema" -File $schemaFile
Write-Host ""
Invoke-Dump -Label "2/2 data" -File $dataFile -ExtraArgs @("--data-only")

# Resumo
Write-Host ""
Write-Host "[OK] Dump completo concluido" -ForegroundColor Green

$schemaSize  = (Get-Item $schemaFile).Length / 1KB
$schemaLines = (Get-Content $schemaFile | Measure-Object -Line).Lines
$dataSize    = (Get-Item $dataFile).Length / 1KB
$dataLines   = (Get-Content $dataFile | Measure-Object -Line).Lines

Write-Host "  Schema: $schemaFile"
Write-Host "    Tamanho: $([math]::Round($schemaSize, 2)) KB"
Write-Host "    Linhas:  $schemaLines"
Write-Host "  Data:   $dataFile"
Write-Host "    Tamanho: $([math]::Round($dataSize, 2)) KB"
Write-Host "    Linhas:  $dataLines"
