param(
    [string]$EnvFile = "backend/.env.prodlike.local",
    [switch]$RunSmokeChecks
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$envPath = Resolve-PathFromRepo $EnvFile

Write-Step "Load local production-like env"
Import-EnvFile -Path $envPath

$python = Get-BackendPython

Write-Step "Apply migrations"
Invoke-RepoCommand -Command "& $python backend/manage.py migrate" -WorkingDirectory $repoRoot

Write-Step "Seed references"
Invoke-RepoCommand -Command "& $python backend/manage.py seed_references" -WorkingDirectory $repoRoot

Write-Step "Seed technologies"
Invoke-RepoCommand -Command "& $python backend/manage.py seed_technologies" -WorkingDirectory $repoRoot

Write-Step "Seed users"
Invoke-RepoCommand -Command "& $python backend/manage.py seed_users" -WorkingDirectory $repoRoot

if ($RunSmokeChecks) {
    Write-Step "Run PostgreSQL smoke"
    Invoke-RepoCommand -Command "python scripts/postgres-smoke-check.py" -WorkingDirectory $repoRoot
}

Write-Host ""
Write-Host "PostgreSQL init completed." -ForegroundColor Green
