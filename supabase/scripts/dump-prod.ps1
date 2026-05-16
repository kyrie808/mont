# Dump completo da producao Supabase via CLI -- schema + dados em arquivos separados
# Uso: .\supabase\scripts\dump-prod.ps1
# Saida: supabase/backups/dumps/dump-{schema,data}-YYYYMMDD-HHMMSS.sql

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = "supabase/backups/dumps"
$schemaFile = "$outputDir/dump-schema-$timestamp.sql"
$dataFile = "$outputDir/dump-data-$timestamp.sql"

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "Iniciando dump da producao (linked project)..." -ForegroundColor Cyan
Write-Host "Timestamp: $timestamp" -ForegroundColor Cyan
Write-Host ""

# 1/2 -- Schema (DDL)
Write-Host "[1/2] Dump de schema -> $schemaFile" -ForegroundColor Yellow
npx supabase db dump --linked --file $schemaFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FALHOU] Dump de schema falhou (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# 2/2 -- Data (INSERTs)
Write-Host ""
Write-Host "[2/2] Dump de dados -> $dataFile" -ForegroundColor Yellow
npx supabase db dump --linked --data-only --file $dataFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "[FALHOU] Dump de dados falhou (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

# Resumo
Write-Host ""
Write-Host "[OK] Dump completo concluido" -ForegroundColor Green

$schemaSize = (Get-Item $schemaFile).Length / 1KB
$schemaLines = (Get-Content $schemaFile | Measure-Object -Line).Lines
$dataSize = (Get-Item $dataFile).Length / 1KB
$dataLines = (Get-Content $dataFile | Measure-Object -Line).Lines

Write-Host "  Schema: $schemaFile"
Write-Host "    Tamanho: $([math]::Round($schemaSize, 2)) KB"
Write-Host "    Linhas:  $schemaLines"
Write-Host "  Data:   $dataFile"
Write-Host "    Tamanho: $([math]::Round($dataSize, 2)) KB"
Write-Host "    Linhas:  $dataLines"
