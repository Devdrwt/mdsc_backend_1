// Script Node.js pour créer la table user_files
const { pool } = require('../src/config/database');

async function migrateUserFiles() {
  try {
    console.log('🔄 Création de la table user_files...');
    
    // Créer la table user_files
    await pool.execute(`
      CREATE TABLE IF NOT EXISTS user_files (
        id INT AUTO_INCREMENT PRIMARY KEY,
        user_id INT NOT NULL,
        file_type ENUM('profile_picture', 'identity_document', 'certificate', 'other') NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        original_name VARCHAR(255) NOT NULL,
        file_path VARCHAR(500) NOT NULL,
        file_size INT NOT NULL,
        mime_type VARCHAR(100) NOT NULL,
        storage_type ENUM('minio', 's3', 'local') DEFAULT 'local',
        is_verified BOOLEAN DEFAULT FALSE,
        verified_at TIMESTAMP NULL,
        verified_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (verified_by) REFERENCES users(id) ON DELETE SET NULL,
        INDEX idx_user (user_id),
        INDEX idx_type (file_type),
        INDEX idx_verified (is_verified),
        INDEX idx_storage_type (storage_type)
      )
    `);
    
    console.log('✅ Table user_files créée');
    
    // Créer le dossier uploads s'il n'existe pas
    const fs = require('fs');
    const path = require('path');
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
      console.log('✅ Dossier uploads/profiles créé');
    }
    
    // Vérifier la table créée
    const [filesCount] = await pool.execute('SELECT COUNT(*) as count FROM user_files');
    console.log(`📊 Total fichiers: ${filesCount[0].count}`);
    
    console.log('🎉 Migration des fichiers utilisateur terminée avec succès!');
    process.exit(0);
    
  } catch (error) {
    console.error('❌ Erreur lors de la migration:', error.message);
    process.exit(1);
  }
}

migrateUserFiles();
