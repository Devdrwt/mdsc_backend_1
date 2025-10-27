// Script pour lister tous les utilisateurs
const { pool } = require('./src/config/database');

async function listUsers() {
  try {
    const [results] = await pool.execute(`
      SELECT 
        id,
        email,
        CONCAT(first_name, ' ', last_name) as name,
        role,
        is_email_verified,
        CASE WHEN google_id IS NOT NULL THEN 'Oui' ELSE 'Non' END as google_auth,
        created_at
      FROM users
      ORDER BY created_at DESC
    `);

    console.log('\n' + '='.repeat(100));
    console.log('👥 LISTE DES UTILISATEURS MDSC');
    console.log('='.repeat(100));
    
    if (results.length === 0) {
      console.log('\n❌ Aucun utilisateur trouvé dans la base de données\n');
      process.exit(0);
    }

    console.log(`\nTotal: ${results.length} utilisateur(s)\n`);
    
    results.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name}`);
      console.log(`   📧 Email: ${user.email}`);
      console.log(`   👔 Rôle: ${user.role}`);
      console.log(`   ${user.is_email_verified ? '✅' : '⏳'} Email vérifié: ${user.is_email_verified ? 'Oui' : 'Non'}`);
      console.log(`   🔐 Google Auth: ${user.google_auth}`);
      console.log(`   📅 Créé le: ${user.created_at}`);
      console.log('');
    });
    
    console.log('='.repeat(100) + '\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

listUsers();

