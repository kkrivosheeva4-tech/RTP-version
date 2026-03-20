param(
    [string]$EnvFile = "backend/.env.prodlike.local",
    [switch]$RunSmokeChecks,
    [switch]$RunBackendTests
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$envPath = Resolve-PathFromRepo $EnvFile

Write-Step "Load local production-like env"
Import-EnvFile -Path $envPath

$postgresHost = Get-EnvOrDefault -Name "DB_HOST" -DefaultValue "localhost"
$postgresPort = Get-EnvOrDefault -Name "DB_PORT" -DefaultValue "5432"
$postgresDb = Get-EnvOrDefault -Name "DB_NAME" -DefaultValue "rtp3"
$postgresUser = Get-EnvOrDefault -Name "DB_USER" -DefaultValue "rtp3"
$postgresPassword = Get-EnvOrDefault -Name "DB_PASSWORD" -DefaultValue "rtp3"

$smokeFlag = if ($RunSmokeChecks) { "-RunSmokeChecks" } else { "" }
$testsFlag = if ($RunBackendTests) { "-RunBackendTests" } else { "" }

$command = @(
    "powershell -ExecutionPolicy Bypass -File scripts/postgres-dry-run.ps1",
    "-PostgresHost `"$postgresHost`"",
    "-PostgresPort `"$postgresPort`"",
    "-PostgresDb `"$postgresDb`"",
    "-PostgresUser `"$postgresUser`"",
    "-PostgresPassword `"$postgresPassword`"",
    $smokeFlag,
    $testsFlag
) -join " "

Invoke-RepoCommand -Command $command -WorkingDirectory $repoRoot
