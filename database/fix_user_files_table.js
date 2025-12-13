const mysql = require('mysql2/promise');
require('dotenv').config();

async function fixUserFilesTable() {
  console.log('🔧 Correction de la table user_files...\n');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    // 1. Vérifier la structure actuelle
    console.log('1️⃣  Structure actuelle de la table:');
    const [columns] = await connection.query('DESCRIBE user_files');
    console.table(columns);

    // 2. Vérifier si storage_type existe
    const hasStorageType = columns.some(col => col.Field === 'storage_type');
    
    if (!hasStorageType) {
      console.log('\n2️⃣  Ajout de la colonne storage_type...');
      await connection.query(`
        ALTER TABLE user_files 
        ADD COLUMN storage_type VARCHAR(50) DEFAULT 'local' 
        AFTER mime_type
      `);
      console.log('✅ Colonne storage_type ajoutée');
    } else {
      console.log('\n2️⃣  ✅ La colonne storage_type existe déjà');
    }

    // 3. Vérifier si id est AUTO_INCREMENT
    const idColumn = columns.find(col => col.Field === 'id');
    const isAutoIncrement = idColumn?.Extra?.includes('auto_increment');

    if (!isAutoIncrement) {
      console.log('\n3️⃣  Correction du champ id en AUTO_INCREMENT...');
      await connection.query(`
        ALTER TABLE user_files 
        MODIFY COLUMN id INT AUTO_INCREMENT PRIMARY KEY
      `);
      console.log('✅ Champ id configuré en AUTO_INCREMENT');
    } else {
      console.log('\n3️⃣  ✅ Le champ id est déjà AUTO_INCREMENT');
    }

    // 4. Vérifier la structure finale
    console.log('\n4️⃣  Structure finale de la table:');
    const [finalColumns] = await connection.query('DESCRIBE user_files');
    console.table(finalColumns);

    // 5. Compter les enregistrements
    const [countResult] = await connection.query('SELECT COUNT(*) as count FROM user_files');
    console.log(`\n5️⃣  Nombre d'enregistrements dans user_files: ${countResult[0].count}`);

    console.log('\n✅ Correction terminée avec succès!');

  } catch (error) {
    console.error('❌ Erreur:', error.message);
    throw error;
  } finally {
    await connection.end();
  }
}

// Exécuter
fixUserFilesTable()
  .then(() => {
    console.log('\n🎉 Script terminé!');
    process.exit(0);
  })
  .catch(error => {
    console.error('\n💥 Erreur fatale:', error);
    process.exit(1);
  });
