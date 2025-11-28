const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  let connection;
  
  try {
    // Connexion à la base de données
    connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME || 'mdsc_auth',
      multipleStatements: true
    });

    console.log('✅ Connexion à la base de données établie');

    // Lire le fichier de migration
    const migrationPath = path.join(__dirname, 'migrations', '021_add_thumbnail_to_live_sessions.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Fichier de migration chargé');

    // Exécuter la migration
    // La migration utilise PREPARE/EXECUTE, donc on doit l'exécuter en une seule fois
    await connection.query(migrationSQL);
    
    console.log('✅ Migration exécutée avec succès');

    // Vérifier que la colonne existe
    const [columns] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'mdsc_auth'
        AND TABLE_NAME = 'live_sessions'
        AND COLUMN_NAME = 'thumbnail_url'
    `);

    if (columns.length > 0) {
      console.log('✅ Colonne thumbnail_url ajoutée avec succès:');
      console.log(JSON.stringify(columns[0], null, 2));
    } else {
      console.log('⚠️  La colonne thumbnail_url n\'a pas été trouvée');
    }

    // Afficher la structure complète de la table
    const [structure] = await connection.query(`
      SELECT 
        COLUMN_NAME,
        DATA_TYPE,
        IS_NULLABLE,
        COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = 'mdsc_auth'
        AND TABLE_NAME = 'live_sessions'
      ORDER BY ORDINAL_POSITION
    `);

    console.log('\n📋 Structure de la table live_sessions:');
    structure.forEach(col => {
      console.log(`  - ${col.COLUMN_NAME} (${col.DATA_TYPE}, ${col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL'})`);
    });

  } catch (error) {
    console.error('❌ Erreur lors de l\'exécution de la migration:', error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
      console.log('\n🔌 Connexion fermée');
    }
  }
}

runMigration();

