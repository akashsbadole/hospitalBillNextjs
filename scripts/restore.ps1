param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [string]$DbUrl = $env:DATABASE_URL
)

$ErrorActionPreference = "Stop"

if (-not $DbUrl) {
  Write-Error "DATABASE_URL is not set. Set the environment variable or pass -DbUrl."
  exit 1
}

if (-not (Test-Path -LiteralPath $BackupFile)) {
  Write-Error "Backup file not found: $BackupFile"
  exit 1
}

Write-Host "[RESTORE] Restoring from $BackupFile" -ForegroundColor Cyan

# Decompress if gzipped
$restoreFile = $BackupFile
if ($BackupFile -match '\.gz$') {
  $restoreFile = $BackupFile -replace '\.gz$', ''
  if (-not (Test-Path -LiteralPath $restoreFile)) {
    Write-Host "[RESTORE] Decompressing..." -ForegroundColor Cyan
    & gzip -d -k -f $BackupFile
  }
}

$env:PGPASSWORD = ""

try {
  & psql --quiet --file="$restoreFile" "$DbUrl" 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql restore failed with exit code $LASTEXITCODE" }
} catch {
  Write-Error "[RESTORE] psql failed: $_"
  Write-Warning "[RESTORE] Ensure PostgreSQL client tools (psql) are installed and in PATH."
  exit 1
}

Write-Host "[RESTORE] Completed successfully." -ForegroundColor Green
