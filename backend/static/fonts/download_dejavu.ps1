# Скрипт PowerShell для загрузки DejaVu Sans TTF в папку fonts
# Источник: официальный GitHub releases DejaVu (или Font Squirrel mirror)
# Запустите из корня проекта: powershell -ExecutionPolicy Bypass -File .\fonts\download_dejavu.ps1

$targetDir = Join-Path -Path (Get-Location) -ChildPath 'fonts'
if (-not (Test-Path $targetDir)) {
    New-Item -ItemType Directory -Path $targetDir | Out-Null
}

$urls = @(
    'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans.ttf',
    'https://github.com/dejavu-fonts/dejavu-fonts/raw/master/ttf/DejaVuSans-Oblique.ttf'
)

foreach ($u in $urls) {
    try {
        $fileName = Split-Path $u -Leaf
        $outPath = Join-Path $targetDir $fileName
        Write-Host "Загружаю $u -> $outPath"
        Invoke-WebRequest -Uri $u -OutFile $outPath -UseBasicParsing -ErrorAction Stop
        Write-Host "Сохранено: $outPath"
    } catch {
        Write-Warning "Не удалось загрузить $u: $_"
    }
}

Write-Host "Готово. Проверьте папку 'fonts' и при необходимости переименуйте файл в DejaVuSans.ttf (если скачано с другим именем)."
