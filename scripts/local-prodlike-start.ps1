param(
    [string]$EnvFile = "backend/.env.prodlike.local",
    [switch]$SkipBuild,
    [switch]$SkipMigrate,
    [switch]$TrustCaddyCA
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$envPath = Resolve-PathFromRepo $EnvFile
$caddyTemplatePath = Resolve-PathFromRepo "ops/local/Caddyfile.template"
$caddyLocalPath = Resolve-PathFromRepo "ops/local/Caddyfile.local"
$logsDir = Resolve-PathFromRepo "logs/local-prodlike"
$backendStdout = Join-Path $logsDir "backend.stdout.log"
$backendStderr = Join-Path $logsDir "backend.stderr.log"

Write-Step "Load local production-like env"
Import-EnvFile -Path $envPath

$caddy = Get-CaddyCommand
$python = Get-BackendPython
$localHost = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_HOST" -DefaultValue "rtp3.localhost"
$origin = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_ORIGIN" -DefaultValue ("https://{0}" -f $localHost)
$backendBind = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_BACKEND_BIND" -DefaultValue "127.0.0.1:8000"
$backendUpstream = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_BACKEND_UPSTREAM" -DefaultValue $backendBind

if (-not (Test-Path -LiteralPath $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if (-not $SkipBuild) {
    Write-Step "Build frontend assets"
    Invoke-RepoCommand -Command "npm run build" -WorkingDirectory $repoRoot
}

if (-not $SkipMigrate) {
    Write-Step "Apply Django migrations in the loaded env"
    Invoke-RepoCommand -Command "& $python backend/manage.py migrate" -WorkingDirectory $repoRoot
}

Write-Step "Render local Caddy config"
$caddyTemplate = Get-Content -LiteralPath $caddyTemplatePath -Raw -Encoding UTF8
$caddyConfig = $caddyTemplate.Replace("__LOCAL_HOST__", $localHost).Replace("__BACKEND_UPSTREAM__", $backendUpstream)
[System.IO.File]::WriteAllText($caddyLocalPath, $caddyConfig, [System.Text.UTF8Encoding]::new($false))

if ($TrustCaddyCA) {
    Write-Step "Trust Caddy local CA"
    Invoke-RepoCommand -Command "& $caddy trust" -WorkingDirectory $repoRoot
}

$backendProcess = $null
try {
    Write-Step "Start Django backend on $backendBind"
    $backendCommand = "& $python backend/manage.py runserver $backendBind"
    $backendProcess = Start-Process -FilePath "powershell" -ArgumentList @(
        "-NoProfile",
        "-Command",
        $backendCommand
    ) -WorkingDirectory $repoRoot -PassThru -RedirectStandardOutput $backendStdout -RedirectStandardError $backendStderr

    Start-Sleep -Seconds 4
    if ($backendProcess.HasExited) {
        throw "Django backend exited early. Check $backendStdout and $backendStderr"
    }

    Write-Host ""
    Write-Host "Local production-like contour is starting." -ForegroundColor Green
    Write-Host "  Origin:  $origin"
    Write-Host "  Backend: http://$backendBind"
    Write-Host "  Logs:    $logsDir"
    Write-Host ""
    Write-Host "Keep this terminal open while Caddy is running." -ForegroundColor Yellow

    Invoke-RepoCommand -Command "& $caddy run --config `"$caddyLocalPath`"" -WorkingDirectory $repoRoot
}
finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
    }
}
