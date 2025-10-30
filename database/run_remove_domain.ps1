# Script PowerShell pour retirer la table domains et la colonne courses.domain_id

param(
    [string]$DatabaseName = "mdsc_auth",
    [string]$DatabaseUser = "root",
    [string]$DatabasePassword = "",
    [int]$DatabasePort = 3306,
    [string]$DatabaseHost = "localhost"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration - Suppression domaine (domains/domain_id)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

try {
    $mysqlPaths = @(
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mariadb\bin\mysql.exe",
        "C:\Program Files\MariaDB\*\bin\mysql.exe",
        "C:\Program Files\MySQL\*\bin\mysql.exe"
    )

    $mysqlCommand = $null
    foreach ($path in $mysqlPaths) {
        $resolvedPath = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolvedPath) { $mysqlCommand = $resolvedPath[0].Path; break }
    }
    if (-not $mysqlCommand) { $mysqlCommand = "mysql" }

    Write-Host "Utilisation de: $mysqlCommand" -ForegroundColor Cyan
    Write-Host "Exécution de la migration remove_domain_table.sql..." -ForegroundColor Yellow

    $sqlFile = Join-Path $PSScriptRoot "remove_domain_table.sql"
    $sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8

    if ($DatabasePassword) {
        $env:MYSQL_PWD = $DatabasePassword
        $command = "$mysqlCommand -h$DatabaseHost -P$DatabasePort -u$DatabaseUser $DatabaseName"
    } else {
        $command = "$mysqlCommand -h$DatabaseHost -P$DatabasePort -u$DatabaseUser $DatabaseName"
    }

    $sqlContent | cmd /c "$command"

    if ($DatabasePassword) { Remove-Item env:MYSQL_PWD -ErrorAction SilentlyContinue }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""; Write-Host "✅ Suppression domaine terminée." -ForegroundColor Green
    } else {
        throw "Erreur lors de l'exécution de la migration remove_domain_table.sql"
    }
}
catch {
    Write-Host ""; Write-Host "❌ Erreur lors de la migration domaine:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}


