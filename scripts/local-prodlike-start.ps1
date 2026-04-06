param(
    [string]$EnvFile = "backend/.env.prodlike.local",
    [switch]$SkipMigrate
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$envPath = Resolve-PathFromRepo $EnvFile
$logsDir = Resolve-PathFromRepo "logs/local-prodlike"
$backendStdout = Join-Path $logsDir "backend.stdout.log"
$backendStderr = Join-Path $logsDir "backend.stderr.log"

Write-Step "Load local production-like env"
Import-EnvFile -Path $envPath

$python = Get-BackendPython
$origin = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_ORIGIN" -DefaultValue "https://127.0.0.1:8443"
$backendBind = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_BACKEND_BIND" -DefaultValue "127.0.0.1:8443"
$origin = $origin -replace '^http://', 'https://'
$bindParts = $backendBind.Split(":", 2)
$bindHost = if ($bindParts.Length -ge 1) { $bindParts[0] } else { "127.0.0.1" }
$bindPort = if ($bindParts.Length -eq 2) { $bindParts[1] } else { "8443" }
$trustedOrigins = "https://127.0.0.1:$bindPort,https://localhost:$bindPort"

Set-Item -Path Env:LOCAL_PRODLIKE_ORIGIN -Value $origin
Set-Item -Path Env:CORS_ALLOWED_ORIGINS -Value $trustedOrigins
Set-Item -Path Env:CSRF_TRUSTED_ORIGINS -Value $trustedOrigins
Set-Item -Path Env:SECURE_SSL_REDIRECT -Value "True"
Set-Item -Path Env:SESSION_COOKIE_SECURE -Value "True"
Set-Item -Path Env:CSRF_COOKIE_SECURE -Value "True"
Set-Item -Path Env:AUTH_REFRESH_COOKIE_SECURE -Value "True"

if (-not (Test-Path -LiteralPath $logsDir)) {
    New-Item -ItemType Directory -Path $logsDir | Out-Null
}

if (-not $SkipMigrate) {
    Write-Step "Apply Django migrations in the loaded env"
    Invoke-RepoCommand -Command "& $python backend/manage.py migrate" -WorkingDirectory $repoRoot
}

$backendProcess = $null
try {
    Write-Step "Start Django HTTPS backend on $backendBind"
    $backendCommand = "& $python scripts/dev_https_server.py --bind $backendBind"
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
    Write-Host "  Backend: https://$backendBind"
    Write-Host "  Logs:    $logsDir"
    Write-Host ""
    Write-Host "Keep this terminal open while Django is running." -ForegroundColor Yellow

    Wait-Process -Id $backendProcess.Id
}
finally {
    if ($backendProcess -and -not $backendProcess.HasExited) {
        Stop-Process -Id $backendProcess.Id -Force
    }
}
