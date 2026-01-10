// Script pour exécuter la migration 021: Ajout du support MinIO à user_files
const { pool } = require('../src/config/database');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('🔄 Exécution de la migration 021: Ajout du support MinIO à user_files...');
    
    const migrationFile = path.join(__dirname, 'migrations/021_add_storage_type_to_user_files.sql');
    
    if (!fs.existsSync(migrationFile)) {
      console.error('❌ Fichier de migration non trouvé:', migrationFile);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(migrationFile, 'utf8');
    
    // Exécuter la migration
    // Note: MySQL ne supporte pas "ADD COLUMN IF NOT EXISTS", donc on doit vérifier d'abord
    const [columns] = await pool.execute(`
      SELECT COLUMN_NAME 
      FROM INFORMATION_SCHEMA.COLUMNS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_files' 
      AND COLUMN_NAME = 'storage_type'
    `);
    
    if (columns.length === 0) {
      console.log('📝 Ajout de la colonne storage_type...');
      await pool.execute(`
        ALTER TABLE user_files
        ADD COLUMN storage_type ENUM('minio', 's3', 'local') DEFAULT 'local' AFTER mime_type
      `);
      console.log('✅ Colonne storage_type ajoutée');
    } else {
      console.log('ℹ️  La colonne storage_type existe déjà');
    }
    
    // Ajouter l'index si nécessaire
    const [indexes] = await pool.execute(`
      SELECT INDEX_NAME 
      FROM INFORMATION_SCHEMA.STATISTICS 
      WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'user_files' 
      AND INDEX_NAME = 'idx_storage_type'
    `);
    
    if (indexes.length === 0) {
      console.log('📝 Ajout de l\'index idx_storage_type...');
      await pool.execute(`
        ALTER TABLE user_files
        ADD INDEX idx_storage_type (storage_type)
      `);
      console.log('✅ Index ajouté');
    } else {
      console.log('ℹ️  L\'index idx_storage_type existe déjà');
    }
    
    console.log('🎉 Migration 021 terminée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error);
    process.exit(1);
  }
}

runMigration();
