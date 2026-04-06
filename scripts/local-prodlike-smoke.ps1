param(
    [string]$EnvFile = "backend/.env.prodlike.local",
    [string]$BaseUrl = ""
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

$repoRoot = Get-RepoRoot
$envPath = Resolve-PathFromRepo $EnvFile

Write-Step "Load local production-like env"
Import-EnvFile -Path $envPath

$python = Get-BackendPython
if (-not $BaseUrl) {
    $BaseUrl = Get-EnvOrDefault -Name "LOCAL_PRODLIKE_ORIGIN" -DefaultValue "https://127.0.0.1:8443"
}

$command = "& $python scripts/local_prodlike_smoke.py --base-url `"$BaseUrl`""
Invoke-RepoCommand -Command $command -WorkingDirectory $repoRoot
