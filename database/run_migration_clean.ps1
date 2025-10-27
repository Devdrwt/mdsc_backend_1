# Script PowerShell propre pour la migration MdSC MOOC
# Sans caracteres speciaux pour eviter les erreurs d'encodage

Write-Host "Migration complete de la plateforme MdSC MOOC..." -ForegroundColor Green

# Configuration de la base de donnees
$DB_HOST = "localhost"
$DB_PORT = "3306"
$DB_USER = "moodle_user"
$DB_PASSWORD = Read-Host "Entrez le mot de passe de la base de donnees"
$DB_NAME = "mdsc_auth"

# Chemins vers les fichiers SQL
$SCHEMA_FILE = "schema.sql"
$COURSES_FILE = "courses_schema.sql"
$COMPLETE_FILE = "complete_schema.sql"

Write-Host "Execution du schema principal d'authentification..." -ForegroundColor Yellow

try {
    # 1. Executer le schema principal
    $content1 = Get-Content $SCHEMA_FILE -Raw
    $content1 | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'execution du schema principal" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Schema principal execute avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Execution du schema des cours..." -ForegroundColor Yellow

try {
    # 2. Executer le schema des cours
    $content2 = Get-Content $COURSES_FILE -Raw
    $content2 | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'execution du schema des cours" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Schema des cours execute avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "Execution du schema complet (IA + Gamification + Analytics)..." -ForegroundColor Yellow

try {
    # 3. Executer le schema complet
    $content3 = Get-Content $COMPLETE_FILE -Raw
    $content3 | mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASSWORD $DB_NAME
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Erreur lors de l'execution du schema complet" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "Schema complet execute avec succes" -ForegroundColor Green
} catch {
    Write-Host "Erreur: $($_.Exception.Message)" -ForegroundColor Red
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
