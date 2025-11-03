const mysql = require('mysql2/promise');
require('dotenv').config();

// Configuration de la connexion à MariaDB
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'mdsc_auth',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0,
  // Configuration UTF-8 pour gérer les accents
  charset: 'utf8mb4',
  collation: 'utf8mb4_unicode_ci',
});

// Wrapper pour s'assurer que chaque connexion utilise utf8mb4
const originalGetConnection = pool.getConnection.bind(pool);
pool.getConnection = async function() {
  const connection = await originalGetConnection();
  
  // Configurer utf8mb4 sur cette connexion
  try {
    await connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
    await connection.query("SET CHARACTER SET utf8mb4");
    await connection.query("SET character_set_connection = utf8mb4");
    await connection.query("SET character_set_results = utf8mb4");
  } catch (error) {
    console.warn('⚠️ Erreur lors de la configuration UTF-8:', error.message);
  }
  
  return connection;
};

// Test de la connexion
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à MariaDB réussie');
    
    // S'assurer que la connexion utilise utf8mb4
    await connection.query("SET NAMES 'utf8mb4' COLLATE 'utf8mb4_unicode_ci'");
    await connection.query("SET CHARACTER SET utf8mb4");
    await connection.query("SET character_set_connection = utf8mb4");
    
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à MariaDB:', error.message);
    return false;
  }
};

module.exports = { pool, testConnection };

