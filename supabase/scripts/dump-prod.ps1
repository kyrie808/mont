# Dump completo da produção Supabase via CLI
# Uso: .\supabase\scripts\dump-prod.ps1
# Saída: supabase/backups/dumps/dump-YYYYMMDD-HHMMSS.sql

$ErrorActionPreference = "Stop"

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$outputDir = "supabase/backups/dumps"
$outputFile = "$outputDir/dump-$timestamp.sql"

if (!(Test-Path $outputDir)) {
    New-Item -ItemType Directory -Path $outputDir -Force | Out-Null
}

Write-Host "→ Iniciando dump da produção (linked project)..." -ForegroundColor Cyan
Write-Host "→ Saída: $outputFile" -ForegroundColor Cyan

supabase db dump --linked --file $outputFile

if ($LASTEXITCODE -ne 0) {
    Write-Host "✗ Dump falhou (exit code $LASTEXITCODE)" -ForegroundColor Red
    exit $LASTEXITCODE
}

$size = (Get-Item $outputFile).Length / 1KB
$lines = (Get-Content $outputFile | Measure-Object -Line).Lines

Write-Host "✓ Dump concluído" -ForegroundColor Green
Write-Host "  Arquivo: $outputFile"
Write-Host "  Tamanho: $([math]::Round($size, 2)) KB"
Write-Host "  Linhas:  $lines"
