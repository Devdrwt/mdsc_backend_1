# Script PowerShell pour ajouter la table badges
# Exécute le fichier SQL pour créer la table badges et insérer les données par défaut

Write-Host "🔄 Mise à jour de la table badges..." -ForegroundColor Yellow

try {
    # Chemin vers le fichier SQL
    $sqlFile = ".\database\update_badges_table.sql"
    
    # Vérifier que le fichier existe
    if (-not (Test-Path $sqlFile)) {
        Write-Host "❌ Fichier SQL non trouvé: $sqlFile" -ForegroundColor Red
        exit 1
    }
    
    # Exécuter le script SQL
    Write-Host "📄 Exécution du script SQL..." -ForegroundColor Blue
    Get-Content $sqlFile | mysql -u root -p -P 3306 mdsc_auth
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Table badges créée et données insérées avec succès!" -ForegroundColor Green
        Write-Host "🎯 Vous pouvez maintenant tester l'API /api/gamification/badges" -ForegroundColor Cyan
    } else {
        Write-Host "❌ Erreur lors de l'exécution du script SQL" -ForegroundColor Red
        exit 1
    }
    
} catch {
    Write-Host "❌ Erreur: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host "`n🚀 Migration terminée!" -ForegroundColor Green
