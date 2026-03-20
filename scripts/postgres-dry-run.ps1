param(
    [string]$PostgresHost = "localhost",
    [string]$PostgresPort = "5432",
    [string]$PostgresDb = "rtp3",
    [string]$PostgresUser = "rtp3",
    [string]$PostgresPassword = "rtp3",
    [string]$SqliteDbName = "db.sqlite3",
    [string]$ExportFile = "backend/data-migration.json",
    [switch]$SkipPostgresFlush,
    [switch]$RunSmokeChecks,
    [switch]$RunBackendTests
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
# Force UTF-8 default text encoding for Python file IO on Windows.
$env:PYTHONUTF8 = "1"

function Invoke-Step([string]$Name, [scriptblock]$Action) {
    Write-Host "==> $Name" -ForegroundColor Cyan
    & $Action
    Write-Host "OK: $Name" -ForegroundColor Green
}

function Set-SqliteEnv {
    param([string]$DbName)
    $env:DB_ENGINE = "sqlite3"
    $env:DB_NAME = $DbName
    Remove-Item Env:DB_USER -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PASSWORD -ErrorAction SilentlyContinue
    Remove-Item Env:DB_HOST -ErrorAction SilentlyContinue
    Remove-Item Env:DB_PORT -ErrorAction SilentlyContinue
}

function Set-PostgresEnv {
    param(
        [string]$DbHost,
        [string]$Port,
        [string]$Db,
        [string]$User,
        [string]$Password
    )
    $env:DB_ENGINE = "postgresql"
    $env:DB_NAME = $Db
    $env:DB_USER = $User
    $env:DB_PASSWORD = $Password
    $env:DB_HOST = $DbHost
    $env:DB_PORT = $Port
}

function Invoke-ManagePy {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    & python backend/manage.py @Arguments
    if ($LASTEXITCODE -ne 0) {
        $joined = $Arguments -join " "
        throw "manage.py command failed: $joined"
    }
}

Write-Host "PostgreSQL dry-run migration (SQLite -> PostgreSQL)" -ForegroundColor Yellow
Write-Host "Target PostgreSQL: $PostgresUser@$PostgresHost`:$PostgresPort/$PostgresDb"

if (-not (Test-Path -Path "backend/manage.py")) {
    throw "Run script from repository root where backend/manage.py exists."
}

if (-not (Test-Path -Path ("backend/" + $SqliteDbName))) {
    throw "SQLite database not found: backend/$SqliteDbName"
}

Invoke-Step "Export data from SQLite to JSON" {
    Set-SqliteEnv -DbName $SqliteDbName
    Invoke-ManagePy -- dumpdata --natural-foreign --natural-primary -e contenttypes -e auth.permission --indent 2 --output $ExportFile
}

Invoke-Step "Validate fixture encoding (UTF-8)" {
    $bytes = [System.IO.File]::ReadAllBytes($ExportFile)
    $strictUtf8 = New-Object System.Text.UTF8Encoding($false, $true)
    try {
        [void]$strictUtf8.GetString($bytes)
    } catch {
        throw "Fixture file is not UTF-8 encoded: $ExportFile"
    }
}

Invoke-Step "Check PostgreSQL connection" {
    Set-PostgresEnv -DbHost $PostgresHost -Port $PostgresPort -Db $PostgresDb -User $PostgresUser -Password $PostgresPassword
    Invoke-ManagePy -- check --database default
}

Invoke-Step "Apply migrations to PostgreSQL" {
    Invoke-ManagePy -- migrate
}

if (-not $SkipPostgresFlush) {
    Invoke-Step "Flush PostgreSQL data (keep schema)" {
        Invoke-ManagePy -- flush --no-input
    }
}

Invoke-Step "Load JSON data into PostgreSQL" {
    Invoke-ManagePy -- loaddata $ExportFile
}

Invoke-Step "Reset PostgreSQL sequences" {
    $sequenceResetCode = @'
from django.apps import apps
from django.core.management.color import no_style
from django.db import connection

app_labels = ["auth", "auth_custom", "technologies", "references", "admin_panel"]
models = []
for label in app_labels:
    models.extend(list(apps.get_app_config(label).get_models()))

statements = connection.ops.sequence_reset_sql(no_style(), models)
with connection.cursor() as cursor:
    for statement in statements:
        _ = cursor.execute(statement)

print(f"Applied {len(statements)} sequence reset statements")
'@
    $sequenceResetCode | python backend/manage.py shell
    if ($LASTEXITCODE -ne 0) {
        throw "Failed to reset PostgreSQL sequences"
    }
}

if ($RunBackendTests) {
    Invoke-Step "Run backend tests on PostgreSQL" {
        Invoke-ManagePy -- test auth_custom references technologies admin_panel config
    }
}

if ($RunSmokeChecks) {
    Invoke-Step "Run PostgreSQL smoke checks (auth + CRUD + sequence sanity)" {
        & python scripts/postgres-smoke-check.py
        if ($LASTEXITCODE -ne 0) {
            throw "Failed to run PostgreSQL smoke checks"
        }
    }
}

Write-Host ""
Write-Host "Dry-run completed successfully." -ForegroundColor Green
Write-Host "Export file: $ExportFile"
Write-Host "PostgreSQL flush step: $(if ($SkipPostgresFlush) { 'SKIPPED' } else { 'APPLIED' })"
Write-Host "PostgreSQL smoke checks: $(if ($RunSmokeChecks) { 'PASSED' } else { 'SKIPPED' })"
Write-Host "If this was a rehearsal, keep SQLite unchanged in backend/.env until cutover."
