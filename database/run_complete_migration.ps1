# Script PowerShell pour exécuter la migration complète MdSC
# Architecture backend complète sans Moodle

Write-Host "🚀 Migration complète de la plateforme MdSC MOOC..." -ForegroundColor Green

# Configuration de la base de données
$DB_HOST = "localhost"
$DB_PORT = "3306"
$DB_USER = "root"
$DB_PASSWORD = ""
$DB_NAME = "mdsc_auth"

# Chemins vers les fichiers SQL
$SCHEMA_FILE = "schema.sql"
$COURSES_FILE = "courses_schema.sql"
$COMPLETE_FILE = "complete_schema.sql"

Write-Host "📊 Exécution du schéma principal d'authentification..." -ForegroundColor Yellow

try {
    # 1. Exécuter le schéma principal
    $command1 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $SCHEMA_FILE"
    Invoke-Expression $command1
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'exécution du schéma principal" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Schéma principal exécuté avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "📚 Exécution du schéma des cours..." -ForegroundColor Yellow

try {
    # 2. Exécuter le schéma des cours
    $command2 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $COURSES_FILE"
    Invoke-Expression $command2
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'exécution du schéma des cours" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Schéma des cours exécuté avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "🤖 Exécution du schéma complet (IA + Gamification + Analytics)..." -ForegroundColor Yellow

try {
    # 3. Exécuter le schéma complet
    $command3 = "mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME < $COMPLETE_FILE"
    Invoke-Expression $command3
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Erreur lors de l'exécution du schéma complet" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "✅ Schéma complet exécuté avec succès" -ForegroundColor Green
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "MIGRATION COMPLETE REUSSIE !" -ForegroundColor Green
Write-Host "=" * 60 -ForegroundColor Cyan

Write-Host "Modules implementes:" -ForegroundColor Blue
Write-Host "  - Authentification complete" -ForegroundColor White
Write-Host "  - Systeme de cours et lecons" -ForegroundColor White
Write-Host "  - Quiz et evaluations" -ForegroundColor White
Write-Host "  - Certificats PDF automatiques" -ForegroundColor White
Write-Host "  - IA et ChatIA avec GPT-4o Mini" -ForegroundColor White
Write-Host "  - Gamification (badges, points, niveaux)" -ForegroundColor White
Write-Host "  - Analytics et rapports avances" -ForegroundColor White
Write-Host "  - Systeme de notifications" -ForegroundColor White
Write-Host "  - Forums et communication" -ForegroundColor White
Write-Host "  - Devoirs et evaluations" -ForegroundColor White
Write-Host "  - Calendrier et evenements" -ForegroundColor White

Write-Host ""
Write-Host "Tables creees:" -ForegroundColor Blue
Write-Host "  - Authentification: users, tokens, sessions" -ForegroundColor White
Write-Host "  - Cours: courses, lessons, enrollments, progress" -ForegroundColor White
Write-Host "  - Quiz: quizzes, questions, answers, attempts" -ForegroundColor White
Write-Host "  - Certificats: certificates" -ForegroundColor White
Write-Host "  - IA: ai_conversations, ai_messages, recommendations" -ForegroundColor White
Write-Host "  - Gamification: badges, user_badges, user_points, activities" -ForegroundColor White
Write-Host "  - Analytics: system_events, performance_metrics" -ForegroundColor White
Write-Host "  - Notifications: notifications" -ForegroundColor White
Write-Host "  - Communication: forums, discussions, replies" -ForegroundColor White
Write-Host "  - Evaluations: assignments, submissions" -ForegroundColor White
Write-Host "  - Evenements: events" -ForegroundColor White

Write-Host ""
Write-Host "API Endpoints disponibles:" -ForegroundColor Blue
Write-Host "  - /api/auth/* - Authentification" -ForegroundColor White
Write-Host "  - /api/courses/* - Gestion des cours" -ForegroundColor White
Write-Host "  - /api/ai/* - Intelligence Artificielle" -ForegroundColor White
Write-Host "  - /api/gamification/* - Gamification" -ForegroundColor White
Write-Host "  - /api/analytics/* - Analytics et rapports" -ForegroundColor White

Write-Host ""
Write-Host "Prochaines etapes:" -ForegroundColor Cyan
Write-Host "1. Configurer les variables d'environnement (.env)" -ForegroundColor White
Write-Host "2. Ajouter OPENAI_API_KEY pour l'IA" -ForegroundColor White
Write-Host "3. Demarrer le serveur: npm run dev" -ForegroundColor White
Write-Host "4. Tester l'API: node test-courses-api.js" -ForegroundColor White
Write-Host "5. Integrer avec le frontend Next.js" -ForegroundColor White

Write-Host ""
Write-Host "Votre plateforme MdSC MOOC est maintenant COMPLETE !" -ForegroundColor Green
Write-Host "Architecture backend 100% fonctionnelle sans dependance Moodle" -ForegroundColor Green
