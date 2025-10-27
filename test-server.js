// Test simple du serveur
require('dotenv').config();

console.log('🔍 Test de configuration...\n');

console.log('DB_HOST:', process.env.DB_HOST);
console.log('DB_PORT:', process.env.DB_PORT);
console.log('DB_USER:', process.env.DB_USER);
console.log('DB_NAME:', process.env.DB_NAME);
console.log('EMAIL_USER:', process.env.EMAIL_USER);
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? '***configuré***' : 'NON CONFIGURÉ');
console.log('PORT:', process.env.PORT);
console.log('\n');

// Test de connexion à la base de données
const mysql = require('mysql2/promise');

async function testDB() {
  try {
    console.log('📡 Test de connexion à MariaDB...');
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD || '',
      database: process.env.DB_NAME,
    });
    
    console.log('✅ Connexion à MariaDB réussie !');
    
    const [tables] = await connection.query('SHOW TABLES');
    console.log('📋 Tables trouvées:', tables.length);
    tables.forEach(table => {
      console.log('  -', Object.values(table)[0]);
    });
    
    await connection.end();
    
    console.log('\n✅ Tous les tests passés ! Le serveur peut démarrer.');
    console.log('\n🚀 Démarrez maintenant avec: npm run dev');
    
  } catch (error) {
    console.error('\n❌ Erreur:', error.message);
    console.error('\n💡 Vérifiez votre configuration .env');
  }
}

testDB();

