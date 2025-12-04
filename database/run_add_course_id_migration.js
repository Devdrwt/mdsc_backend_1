/**
 * Script pour ajouter course_id et status à la table testimonials
 * Usage: node database/run_add_course_id_migration.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function runMigration() {
  try {
    console.log('🔄 Ajout de course_id et status à la table testimonials...\n');

    const migrationFile = path.join(__dirname, 'add_course_id_to_testimonials.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('❌ Fichier de migration non trouvé:', migrationFile);
      process.exit(1);
    }

    const sql = fs.readFileSync(migrationFile, 'utf8');

    console.log('▶️  Exécution de add_course_id_to_testimonials.sql...');

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
        console.log(`   ✅ Exécuté: ${statement.substring(0, 60)}...`);
      } catch (error) {
        // Ignorer les erreurs communes qui indiquent que la migration a déjà été appliquée
        const ignorableErrors = [
          'ER_DUP_FIELDNAME',      // Colonne existe déjà
          'ER_DUP_KEYNAME',        // Index existe déjà
          'ER_DUP_KEY',            // Contrainte existe déjà
          'ER_CANT_DROP_FIELD_OR_KEY' // Impossible de supprimer (contrainte existe)
        ];
        
        if (ignorableErrors.includes(error.code)) {
          console.log(`   ⚠️  ${error.code}: ${error.sqlMessage?.substring(0, 60)}... (ignoré)`);
          continue;
        }
        
        throw error;
      }
    }

    console.log('\n✅ Migration terminée avec succès !');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter la migration
runMigration();

