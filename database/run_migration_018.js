/**
 * Script pour exécuter uniquement la migration 018 (payment_providers)
 * Usage: node database/run_migration_018.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function runMigration018() {
  try {
    console.log('🔄 Exécution de la migration 018_add_payment_providers_table.sql...\n');

    const filePath = path.join(__dirname, 'migrations', '018_add_payment_providers_table.sql');
    const sql = fs.readFileSync(filePath, 'utf8');

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
        console.log(`   ✅ Requête exécutée avec succès`);
      } catch (error) {
        // Ignorer les erreurs communes qui indiquent que la migration a déjà été appliquée
        const ignorableErrors = [
          'ER_DUP_FIELDNAME',      // Colonne existe déjà
          'ER_TABLE_EXISTS_ERROR', // Table existe déjà
          'ER_DUP_KEYNAME',        // Index existe déjà
          'ER_KEY_COLUMN_DOES_NOT_EXITS' // Index sur colonne qui n'existe pas encore
        ];
        
        if (ignorableErrors.includes(error.code)) {
          console.log(`   ⚠️  ${error.code}: ${error.sqlMessage?.substring(0, 60)}... (ignoré - déjà appliqué)`);
          continue;
        }
        
        throw error;
      }
    }

    console.log('\n✅ Migration 018 exécutée avec succès !');
    console.log('📋 La table payment_providers a été créée.');
    console.log('📋 Le champ fedapay a été ajouté à la table payments.\n');

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Exécuter la migration
runMigration018();

