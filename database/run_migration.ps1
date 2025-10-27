# Script PowerShell pour exécuter la migration
$mysqlPath = "C:\xampp\mysql\bin\mysql.exe"

# Vérifier si MySQL est accessible
try {
    $testConnection = & $mysqlPath -u root -P 3306 -h localhost -e "SELECT 1;" 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ MySQL n'est pas accessible. Vérifiez que XAMPP est démarré."
        exit 1
    }
    Write-Host "✅ MySQL est accessible."
} catch {
    Write-Host "❌ Erreur lors de la connexion à MySQL: $($_.Exception.Message)"
    exit 1
}

# Exécuter la migration
Write-Host "🔄 Exécution de la migration..."
& $mysqlPath -u root -P 3306 -h localhost < "migration_add_user_fields.sql"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migration exécutée avec succès !"
} else {
    Write-Host "❌ Erreur lors de l'exécution de la migration."
    exit 1
}
