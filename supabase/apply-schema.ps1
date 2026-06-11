param(
  [string]$DatabaseUrl = $env:SUPABASE_DB_URL
)

if (-not $DatabaseUrl) {
  Write-Error "SUPABASE_DB_URL manquant. Utilise le Session Pooler Supabase si le host direct db.* ne resout pas depuis ton reseau."
  exit 1
}

$schemaPath = Join-Path $PSScriptRoot "schema.sql"
if (-not (Test-Path $schemaPath)) {
  Write-Error "schema.sql introuvable: $schemaPath"
  exit 1
}

$psqlCommand = Get-Command psql -ErrorAction SilentlyContinue
if (-not $psqlCommand) {
  Write-Error "psql introuvable. Installe PostgreSQL client ou ajoute psql au PATH."
  exit 1
}
$psql = $psqlCommand.Source

Write-Host "Application du schema Supabase..."
& $psql $DatabaseUrl -v ON_ERROR_STOP=1 -f $schemaPath

if ($LASTEXITCODE -ne 0) {
  Write-Error "Echec application schema Supabase."
  exit $LASTEXITCODE
}

Write-Host "Schema Supabase applique avec succes."
