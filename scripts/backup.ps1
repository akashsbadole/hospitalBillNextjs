param(
  [string]$OutputDir = (Join-Path (Get-Location) "backups"),
  [string]$DbUrl = $env:DATABASE_URL,
  [int]$RetentionDays = 7
)

$ErrorActionPreference = "Stop"

if (-not $DbUrl) {
  Write-Error "DATABASE_URL is not set. Set the environment variable or pass -DbUrl."
  exit 1
}

# Ensure output directory exists
if (-not (Test-Path -LiteralPath $OutputDir)) {
  New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$backupFile = Join-Path $OutputDir "medibill-backup-$timestamp.sql"
$backupGz = "$backupFile.gz"

Write-Host "[BACKUP] Starting backup to $backupFile" -ForegroundColor Cyan

# Build pg_dump args from DATABASE_URL
$pgDumpArgs = @("--no-owner", "--verbose", "--file=$backupFile", "$DbUrl")

try {
  & pg_dump @pgDumpArgs 2>&1
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }
} catch {
  Write-Error "[BACKUP] pg_dump failed: $_"
  Write-Warning "[BACKUP] Ensure PostgreSQL client tools (pg_dump) are installed and in PATH."
  exit 1
}

# Compress
Write-Host "[BACKUP] Compressing..." -ForegroundColor Cyan
& gzip -f $backupFile

# Remove old backups
$oldFiles = Get-ChildItem -Path $OutputDir -Filter "medibill-backup-*.sql.gz" |
  Where-Object { $_.CreationTime -lt (Get-Date).AddDays(-$RetentionDays) }

foreach ($f in $oldFiles) {
  Write-Host "[BACKUP] Removing old backup: $($f.Name)" -ForegroundColor Yellow
  Remove-Item -LiteralPath $f.FullName -Force
}

Write-Host "[BACKUP] Completed successfully: $backupGz" -ForegroundColor Green
Write-Host "[BACKUP] Retention: $RetentionDays days, Backups kept: $(@(Get-ChildItem -Path $OutputDir -Filter 'medibill-backup-*.sql.gz').Count)"
