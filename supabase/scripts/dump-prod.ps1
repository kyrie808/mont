# Dump completo da producao Supabase via CLI -- schema + dados em arquivos separados
# Uso: .\supabase\scripts\dump-prod.ps1
# Saida: supabase/backups/dumps/dump-{schema,data}-YYYYMMDD-HHMMSS.sql
#
# Robustez (jul/2026): a telemetria PostHog do CLI causava latencia + ruido no
# stderr (e as vezes timeout); e falhas transientes de conexao ao pooler geravam
# arquivos 0-byte. Correcoes: DO_NOT_TRACK desliga a telemetria; cada dump roda
# com retry + backoff e so e aceito com exit=0 E arquivo nao-vazio.
#
# Correcao (ago/2026): a checagem de tamanho era instantanea e dava falso
# negativo -- o processo do CLI ja saiu, mas o tamanho na entrada de diretorio
# do NTFS ainda nao aparecia. Um dump de 258 KB valido foi reprovado nas 3
# tentativas e o arquivo bom quase foi apagado. Agora o tamanho e lido ate
# ESTABILIZAR (Get-TamanhoEstavel) e o descarte so acontece em 0-byte real.

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

# Le o tamanho do arquivo esperando ele ESTABILIZAR.
#
# Por que nao um (Get-Item).Length direto: o processo do CLI ja saiu, mas o
# tamanho na entrada de diretorio do NTFS pode demorar a aparecer. Uma leitura
# instantanea via 0 num dump valido -- em 03/08/2026 isso reprovou um dump de
# 258 KB perfeito nas 3 tentativas e ainda tentou apagar o arquivo bom.
#
# Criterio: duas leituras consecutivas iguais e maiores que zero. Sai assim que
# estabiliza (custa ~250ms no caminho feliz); so gasta o timeout inteiro quando
# o arquivo e realmente 0-byte.
function Get-TamanhoEstavel {
    param(
        [string] $File,
        [int]    $TimeoutSeconds = 15
    )

    $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
    $anterior = -1

    while ((Get-Date) -lt $deadline) {
        $atual = 0
        if (Test-Path -LiteralPath $File) {
            $atual = (Get-Item -LiteralPath $File).Length
        }

        if ($atual -gt 0 -and $atual -eq $anterior) {
            return $atual
        }

        $anterior = $atual
        Start-Sleep -Milliseconds 250
    }

    if ($anterior -gt 0) { return $anterior }
    return 0
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

        # So espera o arquivo estabilizar se o CLI saiu bem; falha real nao paga o timeout.
        $size = 0
        if ($code -eq 0) {
            $size = Get-TamanhoEstavel -File $File
        } elseif (Test-Path -LiteralPath $File) {
            $size = (Get-Item -LiteralPath $File).Length
        }

        if ($code -eq 0 -and $size -gt 0) {
            Write-Host "  [OK] $([math]::Round($size / 1KB, 1)) KB" -ForegroundColor Green
            return
        }

        Write-Host "  [FALHA] exit=$code size=$size (tentativa $attempt)" -ForegroundColor Red
        # Descarta SO o 0-byte. Nunca apagar arquivo com conteudo: se um dump valido
        # for reprovado por outro motivo, ele fica no disco para inspecao manual.
        if ($size -eq 0 -and (Test-Path -LiteralPath $File)) {
            Remove-Item -LiteralPath $File -Force
        }
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
