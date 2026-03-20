param(
    [string]$EnvTarget = "backend/.env.prodlike.local",
    [string]$LocalHost = "rtp3.localhost",
    [string]$PostgresHost = "localhost",
    [string]$PostgresPort = "5432",
    [string]$PostgresDb = "rtp3",
    [string]$PostgresUser = "rtp3",
    [string]$PostgresPassword = "rtp3",
    [switch]$Force
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$examplePath = Resolve-PathFromRepo "backend/.env.prodlike.example"
$targetPath = Resolve-PathFromRepo $EnvTarget
$apiConfigPath = Resolve-PathFromRepo "src/js/config/api-config.local.js"

if ((Test-Path -LiteralPath $targetPath) -and -not $Force) {
    throw "Env file already exists: $targetPath . Use -Force to overwrite."
}

$python = Get-BackendPython
$secretKey = New-SecretKey -PythonCommand $python

Write-Step "Create local production-like env file"
$template = Get-Content -LiteralPath $examplePath -Raw -Encoding UTF8
$rendered = $template.Replace("replace-with-generated-secret", $secretKey)
$rendered = $rendered.Replace("rtp3.localhost", $LocalHost)
$rendered = $rendered.Replace("DB_NAME=rtp3", "DB_NAME=$PostgresDb")
$rendered = $rendered.Replace("DB_USER=rtp3", "DB_USER=$PostgresUser")
$rendered = $rendered.Replace("DB_PASSWORD=rtp3", "DB_PASSWORD=$PostgresPassword")
$rendered = $rendered.Replace("DB_HOST=localhost", "DB_HOST=$PostgresHost")
$rendered = $rendered.Replace("DB_PORT=5432", "DB_PORT=$PostgresPort")
[System.IO.File]::WriteAllText($targetPath, $rendered, [System.Text.UTF8Encoding]::new($false))

Write-Step "Create same-origin frontend API config"
$apiConfig = @'
if (typeof window !== 'undefined') {
  window.USE_API = true;
  window.USE_REFRESH_COOKIE_AUTH = true;
}

export {};
'@
[System.IO.File]::WriteAllText($apiConfigPath, $apiConfig, [System.Text.UTF8Encoding]::new($false))

Write-Host ""
Write-Host "Local production-like files created:" -ForegroundColor Green
Write-Host "  $targetPath"
Write-Host "  $apiConfigPath"
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Install PostgreSQL and create database/user matching the env file."
Write-Host "  2. Install Caddy and make sure `caddy` is available in PATH."
Write-Host "  3. Run: powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-postgres.ps1"
Write-Host "  4. Run: powershell -ExecutionPolicy Bypass -File scripts/local-prodlike-start.ps1"
