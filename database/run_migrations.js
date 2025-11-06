/**
 * Script pour exécuter toutes les migrations
 * Usage: node database/run_migrations.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

const migrationsDir = path.join(__dirname, 'migrations');

async function runMigrations() {
  try {
    console.log('🔄 Démarrage des migrations...\n');

    // Lire tous les fichiers de migration dans l'ordre
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort(); // Trier par nom pour garantir l'ordre

    console.log(`📋 ${migrationFiles.length} migration(s) trouvée(s)\n`);

    for (const file of migrationFiles) {
      const filePath = path.join(migrationsDir, file);
      const sql = fs.readFileSync(filePath, 'utf8');

      console.log(`▶️  Exécution de ${file}...`);

      // Exécuter chaque requête SQL (séparées par des points-virgules)
      const statements = sql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0 && !s.startsWith('--'));

      for (const statement of statements) {
        try {
          await pool.execute(statement);
        } catch (error) {
          // Ignorer les erreurs communes qui indiquent que la migration a déjà été appliquée
          const ignorableErrors = [
            'ER_DUP_FIELDNAME',      // Colonne existe déjà
            'ER_TABLE_EXISTS_ERROR', // Table existe déjà
            'ER_DUP_KEYNAME',        // Index existe déjà
            'ER_KEY_COLUMN_DOES_NOT_EXITS' // Index sur colonne qui n'existe pas encore
          ];
          
          // Pour ER_BAD_FIELD_ERROR, ignorer seulement pour UPDATE (pas pour ALTER TABLE)
          if (error.code === 'ER_BAD_FIELD_ERROR' && statement.toUpperCase().includes('UPDATE')) {
            console.log(`   ⚠️  UPDATE ignoré: ${error.sqlMessage?.substring(0, 50)}...`);
            continue;
          }
          
          if (ignorableErrors.includes(error.code)) {
            console.log(`   ⚠️  ${error.code}: ${error.sqlMessage?.substring(0, 60)}... (ignoré)`);
            continue;
          }
          
          throw error;
        }
      }

      console.log(`   ✅ ${file} exécutée avec succès\n`);
    }

    console.log('✅ Toutes les migrations ont été exécutées avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution des migrations:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter les migrations
runMigrations();

