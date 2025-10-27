# Script pour exécuter la migration d'ajout de l'authentification Google
# Nécessite XAMPP MySQL

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Migration Google Auth - MdSC Auth API" -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan
Write-Host ""

# Chemin vers MySQL de XAMPP
$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"
$migrationFile = "$PSScriptRoot\migration_add_google_auth.sql"

# Vérifier que MySQL existe
if (-not (Test-Path $mysqlPath)) {
    Write-Host "❌ MySQL introuvable à: $mysqlPath" -ForegroundColor Red
    Write-Host "Veuillez vérifier que XAMPP est installé." -ForegroundColor Yellow
    exit 1
}

# Vérifier que le fichier de migration existe
if (-not (Test-Path $migrationFile)) {
    Write-Host "❌ Fichier de migration introuvable: $migrationFile" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Fichier de migration trouvé" -ForegroundColor Green
Write-Host "🔧 Exécution de la migration..." -ForegroundColor Yellow
Write-Host ""

# Exécuter la migration
& $mysqlPath -u root -p -e "source $migrationFile"

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host "✅ Migration Google Auth terminée avec succès !" -ForegroundColor Green
    Write-Host "==================================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Les colonnes suivantes ont été ajoutées :" -ForegroundColor Cyan
    Write-Host "  - google_id (VARCHAR 255, UNIQUE)" -ForegroundColor White
    Write-Host "  - profile_picture (VARCHAR 500)" -ForegroundColor White
    Write-Host ""
} else {
    Write-Host ""
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host "❌ Erreur lors de l'exécution de la migration" -ForegroundColor Red
    Write-Host "==================================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}

