param(
    [int[]]$Ports = @(8000)
)

. (Join-Path $PSScriptRoot "local-prodlike-common.ps1")

Write-Step "Stop local production-like contour processes"

$pids = Get-NetTCPConnection -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $Ports -contains $_.LocalPort } |
    Select-Object -ExpandProperty OwningProcess -Unique

if (-not $pids) {
    Write-Host "No listening processes found on ports: $($Ports -join ', ')" -ForegroundColor Yellow
    exit 0
}

foreach ($procId in $pids) {
    try {
        Stop-Process -Id $procId -Force -ErrorAction Stop
        Write-Host "Stopped PID $procId" -ForegroundColor Green
    }
    catch {
        $errMsg = $_.Exception.Message
        Write-Warning "Failed to stop PID $procId : $errMsg"
    }
}
