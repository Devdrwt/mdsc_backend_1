require('dotenv').config();
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  const connection = await pool.getConnection();
  
  try {
    console.log('🚀 Début de la migration 023: Ajout d\'index de performance...');
    
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'migrations', '023_add_performance_indexes.sql');
    const sqlContent = fs.readFileSync(sqlFile, 'utf8');
    
    // Diviser les requêtes par ';' et exécuter une par une
    const queries = sqlContent
      .split(';')
      .map(query => query.trim())
      .filter(query => query.length > 0 && !query.startsWith('--'));
    
    console.log(`📝 Exécution de ${queries.length} requêtes CREATE INDEX...`);
    
    for (const query of queries) {
      if (query.trim()) {
        try {
          await connection.execute(query);
          console.log('✅ Index créé avec succès');
        } catch (error) {
          if (error.code === 'ER_DUP_KEYNAME' || error.message.includes('Duplicate key name')) {
            console.log('⚠️  Index déjà existant, ignoré');
          } else {
            console.error('❌ Erreur lors de la création de l\'index:', error.message);
            console.log('Requête:', query.substring(0, 100) + '...');
          }
        }
      }
    }
    
    console.log('✅ Migration 023 terminée avec succès');
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    throw error;
  } finally {
    connection.release();
    await pool.end();
  }
}

runMigration().catch(console.error);

