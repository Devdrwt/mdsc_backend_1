/**
 * Script pour créer la table testimonials
 * Usage: node database/run_testimonials_migration.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function runTestimonialsMigration() {
  try {
    console.log('🔄 Création de la table testimonials...\n');

    const migrationFile = path.join(__dirname, 'create_testimonials_table.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('❌ Fichier de migration non trouvé:', migrationFile);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('▶️  Exécution de create_testimonials_table.sql...');

    // Exécuter chaque requête SQL (séparées par des points-virgules)
    const sanitizedSql = sql
      .split('\n')
      .filter((line) => !line.trim().startsWith('--'))
      .join('\n');

    const statements = sanitizedSql
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 0);

    for (const statement of statements) {
      try {
        await pool.execute(statement);
      } catch (error) {
        // Ignorer les erreurs communes qui indiquent que la migration a déjà été appliquée
        const ignorableErrors = [
          'ER_DUP_FIELDNAME',      // Colonne existe déjà
          'ER_TABLE_EXISTS_ERROR', // Table existe déjà
          'ER_DUP_KEYNAME',        // Index existe déjà
          'ER_DUP_ENTRY'           // Entrée dupliquée (pour INSERT)
        ];
        
        if (ignorableErrors.includes(error.code)) {
          console.log(`   ⚠️  ${error.code}: ${error.sqlMessage?.substring(0, 60)}... (ignoré)`);
          continue;
        }
        
        throw error;
      }
    }

    console.log('   ✅ Table testimonials créée avec succès\n');
    console.log('✅ Migration testimonials terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter la migration
runTestimonialsMigration();

