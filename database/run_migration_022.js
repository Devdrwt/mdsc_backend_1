/**
 * Script pour exécuter la migration 022: Ajouter storage_type à user_files
 * Usage: node database/run_migration_022.js
 */

const fs = require('fs');
const path = require('path');
const { pool } = require('../src/config/database');

async function runMigration022() {
  let connection;
  try {
    console.log('🔄 Exécution de la migration 022_add_storage_type_to_user_files.sql...\n');
    
    // Obtenir une connexion
    connection = await pool.getConnection();
    
    // Lire le fichier SQL
    const sqlFile = path.join(__dirname, 'migrations/022_add_storage_type_to_user_files.sql');
    
    if (!fs.existsSync(sqlFile)) {
      console.error('❌ Fichier de migration non trouvé:', sqlFile);
      process.exit(1);
    }
    
    // Vérifier si la colonne storage_type existe déjà
    const [colCheck] = await connection.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_files' 
        AND COLUMN_NAME = 'storage_type'
    `);
    
    const colExists = colCheck[0].count > 0;
    
    if (colExists) {
      console.log('   ⚠️  La colonne storage_type existe déjà. Migration ignorée.');
    } else {
      console.log('   ▶️  Ajout de la colonne storage_type...');
      await connection.query(`
        ALTER TABLE user_files 
        ADD COLUMN storage_type ENUM('minio', 's3', 'local') DEFAULT 'local' 
        AFTER mime_type
      `);
      console.log('   ✅ Colonne storage_type ajoutée');
    }
    
    // Vérifier si l'index idx_storage_type existe déjà
    const [idxCheck] = await connection.query(`
      SELECT COUNT(*) as count FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_files' 
        AND INDEX_NAME = 'idx_storage_type'
    `);
    
    const idxExists = idxCheck[0].count > 0;
    
    if (idxExists) {
      console.log('   ⚠️  L\'index idx_storage_type existe déjà. Migration ignorée.');
    } else {
      console.log('   ▶️  Ajout de l\'index idx_storage_type...');
      await connection.query(`
        ALTER TABLE user_files 
        ADD INDEX idx_storage_type (storage_type)
      `);
      console.log('   ✅ Index idx_storage_type ajouté');
    }
    
    // Exécuter la requête de vérification finale
    console.log('\n📊 Vérification de la structure de la table user_files...');
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'user_files'
        AND COLUMN_NAME IN ('id', 'user_id', 'file_type', 'file_name', 'mime_type', 'storage_type', 'created_at')
      ORDER BY ORDINAL_POSITION
    `);
    
    console.table(columns);
    
    // Vérifier si storage_type existe
    const storageTypeExists = columns.some(col => col.COLUMN_NAME === 'storage_type');
    
    if (storageTypeExists) {
      console.log('\n✅ Migration 022 exécutée avec succès !');
      console.log('✅ La colonne storage_type a été ajoutée à la table user_files');
    } else {
      console.log('\n⚠️  La colonne storage_type n\'a pas été trouvée. Vérifiez les erreurs ci-dessus.');
    }
    
  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      connection.release();
    }
    await pool.end();
  }
}

// Exécuter la migration
runMigration022();

