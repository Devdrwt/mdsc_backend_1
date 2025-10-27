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
  keepAliveInitialDelay: 0
});

// Test de la connexion
const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log('✅ Connexion à MariaDB réussie');
    connection.release();
    return true;
  } catch (error) {
    console.error('❌ Erreur de connexion à MariaDB:', error.message);
    return false;
  }
};

module.exports = { pool, testConnection };

