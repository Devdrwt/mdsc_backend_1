# Script PowerShell pour exécuter la migration des modules et médias
# À exécuter après courses_schema.sql

param(
    [string]$DatabaseName = "mdsc_auth",
    [string]$DatabaseUser = "root",
    [string]$DatabasePassword = "",
    [int]$DatabasePort = 3306,
    [string]$DatabaseHost = "localhost"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Migration Modules et Media Structure" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$ErrorActionPreference = "Stop"

try {
    # Chercher mysql.exe dans les emplacements communs (XAMPP)
    $mysqlPaths = @(
        "C:\xampp\mysql\bin\mysql.exe",
        "C:\xampp\mariadb\bin\mysql.exe",
        "C:\Program Files\MariaDB\*\bin\mysql.exe",
        "C:\Program Files\MySQL\*\bin\mysql.exe"
    )
    
    $mysqlCommand = $null
    foreach ($path in $mysqlPaths) {
        $resolvedPath = Resolve-Path $path -ErrorAction SilentlyContinue
        if ($resolvedPath) {
            $mysqlCommand = $resolvedPath[0].Path
            break
        }
    }
    
    # Si toujours pas trouvé, essayer juste "mysql" (peut-être dans PATH)
    if (-not $mysqlCommand) {
        $mysqlCommand = "mysql"
    }
    
    Write-Host "Utilisation de: $mysqlCommand" -ForegroundColor Cyan
    
    Write-Host "Exécution de la migration..." -ForegroundColor Yellow
    
    # Exécuter le script SQL
    $sqlFile = Join-Path $PSScriptRoot "add_modules_and_media_structure.sql"
    $sqlContent = Get-Content $sqlFile -Raw -Encoding UTF8
    
    # Construire la commande complète
    if ($DatabasePassword) {
        $env:MYSQL_PWD = $DatabasePassword
        $command = "$mysqlCommand -h$DatabaseHost -P$DatabasePort -u$DatabaseUser $DatabaseName"
    } else {
        $command = "$mysqlCommand -h$DatabaseHost -P$DatabasePort -u$DatabaseUser $DatabaseName"
    }
    
    # Exécuter via cmd pour éviter le prompt de mot de passe
    $sqlContent | cmd /c "$command"
    
    # Nettoyer la variable d'environnement
    if ($DatabasePassword) {
        Remove-Item env:MYSQL_PWD -ErrorAction SilentlyContinue
    }

    if ($LASTEXITCODE -eq 0) {
        Write-Host ""
        Write-Host "✅ Migration réussie !" -ForegroundColor Green
        Write-Host ""
        Write-Host "Tables ajoutées/modifiées :" -ForegroundColor Cyan
        Write-Host "  - modules" -ForegroundColor White
        Write-Host "  - media_files" -ForegroundColor White
        Write-Host "  - progress" -ForegroundColor White
        Write-Host "  - badges" -ForegroundColor White
        Write-Host "  - user_badges" -ForegroundColor White
        Write-Host ""
        Write-Host "Modifications :" -ForegroundColor Cyan
        Write-Host "  - courses : ajout de slug et prerequisite_course_id" -ForegroundColor White
        Write-Host "  - enrollments : ajout de status et started_at" -ForegroundColor White
        Write-Host "  - lessons : ajout de module_id, content_type, media_file_id" -ForegroundColor White
        Write-Host "  - certificates : ajout de certificate_code, qr_code_url" -ForegroundColor White
        Write-Host "  - quizzes : ajout de is_final" -ForegroundColor White
        Write-Host ""
    } else {
        throw "Erreur lors de l'exécution de la migration"
    }

} catch {
    Write-Host ""
    Write-Host "❌ Erreur lors de la migration :" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Vérifiez :" -ForegroundColor Yellow
    Write-Host "  1. Que MariaDB est démarré" -ForegroundColor White
    Write-Host "  2. Que la base de données $DatabaseName existe" -ForegroundColor White
    Write-Host "  3. Que courses_schema.sql a été exécuté avant" -ForegroundColor White
    Write-Host "  4. Les credentials de connexion" -ForegroundColor White
    Write-Host ""
    exit 1
}

