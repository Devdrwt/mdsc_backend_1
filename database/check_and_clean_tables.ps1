# Script pour vérifier et nettoyer les tables de la base de données

$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"
$dbUser = "root"
$dbPassword = ""
$dbName = "mdsc_auth"
$dbPort = "3306"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Vérification des tables de la base de données" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Lister toutes les tables
Write-Host "📋 Tables existantes dans la base de données:" -ForegroundColor Yellow
Write-Host ""

$tablesQuery = "SHOW TABLES;"
$tablesOutput = & $mysqlPath -u $dbUser -h localhost -P $dbPort $dbName -e $tablesQuery 2>$null

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erreur lors de la connexion à la base de données" -ForegroundColor Red
    exit 1
}

$tables = $tablesOutput | Select-Object -Skip 1 | ForEach-Object { $_.Trim() }

Write-Host "Tables trouvées:" -ForegroundColor Cyan
$tables | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
Write-Host ""

# Tables nécessaires selon l'architecture
$requiredTables = @(
    # Authentification
    "users",
    "refresh_tokens",
    "email_verification_tokens",
    "password_reset_tokens",
    
    # Cours
    "courses",
    "categories",
    "modules",
    "lessons",
    "enrollments",
    "progress",
    
    # Quiz
    "quizzes",
    "quiz_questions",
    "quiz_answers",
    "quiz_attempts",
    "user_quiz_answers",
    
    # Médias
    "media_files",
    
    # Badges
    "badges",
    "user_badges",
    
    # Certificats
    "certificates",
    
    # Favoris
    "favorites",
    
    # Avis
    "course_reviews",
    
    # Gamification
    "user_points",
    "user_levels",
    "achievements",
    
    # Analytics
    "user_analytics",
    "course_analytics",
    
    # Messages
    "messages",
    
    # Évaluations
    "evaluations",
    
    # Professionnels
    "professional_profiles",
    "professional_services"
)

Write-Host "📊 Analyse des tables:" -ForegroundColor Yellow
Write-Host ""

$tablesToKeep = @()
$tablesToCheck = @()
$tablesToRemove = @()

foreach ($table in $tables) {
    if ($requiredTables -contains $table) {
        $tablesToKeep += $table
        Write-Host "✅ $table - Table nécessaire (à garder)" -ForegroundColor Green
    } else {
        $tablesToCheck += $table
        Write-Host "⚠️  $table - À vérifier" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "📝 Résumé:" -ForegroundColor Cyan
Write-Host "  Tables nécessaires: $($tablesToKeep.Count)" -ForegroundColor Green
Write-Host "  Tables à vérifier: $($tablesToCheck.Count)" -ForegroundColor Yellow
Write-Host ""

# Afficher les tables à vérifier
if ($tablesToCheck.Count -gt 0) {
    Write-Host "Tables à vérifier manuellement:" -ForegroundColor Yellow
    $tablesToCheck | ForEach-Object { Write-Host "  - $_" -ForegroundColor White }
    Write-Host ""
    Write-Host "Voulez-vous voir les détails de ces tables? (O/N)" -ForegroundColor Cyan
    $response = Read-Host
    if ($response -eq "O" -or $response -eq "o") {
        foreach ($table in $tablesToCheck) {
            Write-Host ""
            Write-Host "Table: $table" -ForegroundColor Cyan
            $describeQuery = "DESCRIBE `$table`;"
            $describeOutput = & $mysqlPath -u $dbUser -h localhost -P $dbPort $dbName -e $describeQuery 2>$null
            Write-Host $describeOutput
            Write-Host ""
            Write-Host "Compter les lignes: " -NoNewline
            $countQuery = "SELECT COUNT(*) as count FROM `$table`;"
            $countOutput = & $mysqlPath -u $dbUser -h localhost -P $dbPort $dbName -e $countQuery 2>$null
            Write-Host $countOutput
        }
    }
}

Write-Host ""
Write-Host "✅ Vérification terminée!" -ForegroundColor Green

