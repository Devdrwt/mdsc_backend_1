# Script d'initialisation de la base de données MdSC Auth
# Usage: .\init-db.ps1

Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host "  Initialisation de la base de données MdSC Auth" -ForegroundColor Cyan
Write-Host "===========================================================" -ForegroundColor Cyan
Write-Host ""

# Chemin vers MySQL
$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"
$schemaPath = Join-Path $PSScriptRoot "schema.sql"

# Vérifier si MySQL existe
if (!(Test-Path $mysqlPath)) {
    Write-Host "❌ MySQL introuvable à : $mysqlPath" -ForegroundColor Red
    Write-Host "Veuillez ajuster le chemin dans le script." -ForegroundColor Yellow
    exit 1
}

# Vérifier si le fichier schema.sql existe
if (!(Test-Path $schemaPath)) {
    Write-Host "❌ Fichier schema.sql introuvable à : $schemaPath" -ForegroundColor Red
    exit 1
}

Write-Host "📁 Fichier schema.sql trouvé" -ForegroundColor Green
Write-Host ""

# Demander les informations de connexion
$dbHost = Read-Host "Host MariaDB (défaut: localhost)"
if ([string]::IsNullOrWhiteSpace($dbHost)) { $dbHost = "localhost" }

$dbPort = Read-Host "Port MariaDB (défaut: 3307)"
if ([string]::IsNullOrWhiteSpace($dbPort)) { $dbPort = "3307" }

$dbUser = Read-Host "Utilisateur MariaDB (défaut: moodle_user)"
if ([string]::IsNullOrWhiteSpace($dbUser)) { $dbUser = "moodle_user" }

$dbPassword = Read-Host "Mot de passe MariaDB" -AsSecureString
$dbPasswordPlain = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($dbPassword))

Write-Host ""
Write-Host "🔄 Création de la base de données..." -ForegroundColor Yellow

# Exécuter le script SQL
$process = Start-Process -FilePath $mysqlPath `
    -ArgumentList "-h", $dbHost, "-P", $dbPort, "-u", $dbUser, "-p$dbPasswordPlain", "-e", "source $schemaPath" `
    -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "✅ Base de données créée avec succès !" -ForegroundColor Green
    Write-Host ""
    Write-Host "📊 Tables créées :" -ForegroundColor Cyan
    Write-Host "  - users" -ForegroundColor White
    Write-Host "  - email_verification_tokens" -ForegroundColor White
    Write-Host "  - password_reset_tokens" -ForegroundColor White
    Write-Host "  - refresh_tokens" -ForegroundColor White
    Write-Host "  - user_sessions" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Vous pouvez maintenant démarrer le serveur avec: npm run dev" -ForegroundColor Green
} else {
    Write-Host ""
    Write-Host "❌ Erreur lors de la création de la base de données" -ForegroundColor Red
    Write-Host "Vérifiez vos identifiants et réessayez." -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "===========================================================" -ForegroundColor Cyan

