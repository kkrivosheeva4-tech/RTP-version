Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
$env:PYTHONUTF8 = "1"

function Get-RepoRoot {
    return (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
}

function Resolve-PathFromRepo {
    param([Parameter(Mandatory = $true)][string]$RelativePath)
    return Join-Path (Get-RepoRoot) $RelativePath
}

function Import-EnvFile {
    param([Parameter(Mandatory = $true)][string]$Path)

    if (-not (Test-Path -LiteralPath $Path)) {
        throw "Env file not found: $Path"
    }

    foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
        $line = $rawLine.Trim()
        if (-not $line -or $line.StartsWith("#")) {
            continue
        }

        $separatorIndex = $line.IndexOf("=")
        if ($separatorIndex -lt 1) {
            continue
        }

        $key = $line.Substring(0, $separatorIndex).Trim()
        $value = $line.Substring($separatorIndex + 1)
        [System.Environment]::SetEnvironmentVariable($key, $value)
        Set-Item -Path ("Env:{0}" -f $key) -Value $value
    }
}

function Test-CommandAvailable {
    param([Parameter(Mandatory = $true)][string]$CommandName)
    return $null -ne (Get-Command $CommandName -ErrorAction SilentlyContinue)
}

function Format-ExecutableCandidate {
    param([Parameter(Mandatory = $true)][string]$Value)

    if ($Value.Contains(" ") -and -not $Value.StartsWith('"')) {
        return ('"{0}"' -f $Value)
    }
    return $Value
}

function Get-BackendPython {
    $candidates = @()

    if ($env:RMK_BACKEND_PYTHON) {
        $candidates += (Format-ExecutableCandidate -Value $env:RMK_BACKEND_PYTHON)
    }

    if (Test-CommandAvailable -CommandName "python") {
        $candidates += "python"
    }
    if (Test-CommandAvailable -CommandName "py") {
        $candidates += "py -3"
    }

    $repoRoot = Get-RepoRoot
    $venvCandidates = @(
        (Join-Path $repoRoot "backend/.venv/Scripts/python.exe"),
        (Join-Path $repoRoot "backend/venv/Scripts/python.exe")
    )

    foreach ($candidate in $venvCandidates) {
        if (Test-Path -LiteralPath $candidate) {
            $candidates += (Format-ExecutableCandidate -Value $candidate)
        }
    }

    foreach ($candidate in $candidates) {
        try {
            Invoke-Expression "& $candidate -c ""import django, swagger_ui_bundle""" *> $null
            if ($LASTEXITCODE -eq 0) {
                return $candidate
            }
        }
        catch {
            # try next candidate
        }
    }

    throw "No Python interpreter with Django found. Set RMK_BACKEND_PYTHON or install backend dependencies."
}

function New-SecretKey {
    param([Parameter(Mandatory = $true)][string]$PythonCommand)

    try {
        $output = Invoke-Expression "& $PythonCommand -c ""from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"""
    }
    catch {
        $output = $null
    }

    if (-not $output -or $LASTEXITCODE -ne 0) {
        throw "Failed to generate SECRET_KEY"
    }
    return ($output | Select-Object -First 1).Trim()
}

function Invoke-RepoCommand {
    param(
        [Parameter(Mandatory = $true)][string]$Command,
        [string]$WorkingDirectory = $(Get-RepoRoot)
    )

    Push-Location $WorkingDirectory
    try {
        Invoke-Expression $Command
        if ($LASTEXITCODE -ne 0) {
            throw "Command failed: $Command"
        }
    } finally {
        Pop-Location
    }
}

function Get-EnvOrDefault {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$DefaultValue
    )

    $value = [System.Environment]::GetEnvironmentVariable($Name)
    if ([string]::IsNullOrWhiteSpace($value)) {
        return $DefaultValue
    }
    return $value.Trim()
}

function Write-Step {
    param([Parameter(Mandatory = $true)][string]$Message)
    Write-Host "==> $Message" -ForegroundColor Cyan
}
