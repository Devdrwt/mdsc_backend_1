# Script PowerShell pour exécuter la migration des cours
# Exécute le schéma des cours après le schéma principal

Write-Host "🚀 Migration des cours MdSC..." -ForegroundColor Green

# Configuration de la base de données
$DB_HOST = "localhost"
$DB_PORT = "3307"
$DB_USER = "moodle_user"
$DB_PASSWORD = Read-Host "Entrez le mot de passe de la base de données"
$DB_NAME = "mdsc_auth"

# Chemin vers le fichier SQL
$SQL_FILE = "courses_schema.sql"

Write-Host "📊 Exécution du schéma des cours..." -ForegroundColor Yellow

try {
    # Exécuter le script SQL
    $command = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $SQL_FILE"
    
    Write-Host "Exécution de la commande: $command" -ForegroundColor Cyan
    
    Invoke-Expression $command
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migration des cours réussie!" -ForegroundColor Green
        Write-Host "📚 Tables créées:" -ForegroundColor Blue
        Write-Host "  - categories" -ForegroundColor White
        Write-Host "  - courses" -ForegroundColor White
        Write-Host "  - lessons" -ForegroundColor White
        Write-Host "  - enrollments" -ForegroundColor White
        Write-Host "  - lesson_progress" -ForegroundColor White
        Write-Host "  - quizzes" -ForegroundColor White
        Write-Host "  - quiz_questions" -ForegroundColor White
        Write-Host "  - quiz_answers" -ForegroundColor White
        Write-Host "  - quiz_attempts" -ForegroundColor White
        Write-Host "  - user_quiz_answers" -ForegroundColor White
        Write-Host "  - certificates" -ForegroundColor White
        Write-Host "  - course_favorites" -ForegroundColor White
        Write-Host "  - course_reviews" -ForegroundColor White
        Write-Host ""
        Write-Host "🎯 Votre API est maintenant prête pour les cours!" -ForegroundColor Green
    } else {
        Write-Host "❌ Erreur lors de la migration" -ForegroundColor Red
        Write-Host "Vérifiez vos paramètres de connexion à la base de données" -ForegroundColor Yellow
    }
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "📝 Prochaines étapes:" -ForegroundColor Cyan
Write-Host "1. Vérifiez que votre serveur API fonctionne: npm run dev" -ForegroundColor White
Write-Host "2. Testez les nouvelles routes /api/courses" -ForegroundColor White
Write-Host "3. Intégrez avec votre frontend" -ForegroundColor White
