// Script pour récupérer le token de vérification d'email
// Utile quand le serveur email n'est pas configuré

const { pool } = require('./src/config/database');

async function getLatestVerificationToken() {
  try {
    const [results] = await pool.execute(`
      SELECT 
        u.id,
        u.email,
        CONCAT(u.first_name, ' ', u.last_name) as name,
        u.role,
        ev.token,
        ev.expires_at,
        CONCAT('http://localhost:3000/verify-email?token=', ev.token) as verification_link
      FROM users u
      LEFT JOIN email_verification_tokens ev ON u.id = ev.user_id
      WHERE ev.token IS NOT NULL
      ORDER BY u.created_at DESC
      LIMIT 1
    `);

    if (results.length === 0) {
      console.log('\n❌ Aucun utilisateur en attente de vérification\n');
      process.exit(0);
    }

    const user = results[0];
    
    console.log('\n' + '='.repeat(70));
    console.log('📧 DERNIER UTILISATEUR EN ATTENTE DE VÉRIFICATION');
    console.log('='.repeat(70));
    console.log(`👤 Nom: ${user.name}`);
    console.log(`📧 Email: ${user.email}`);
    console.log(`👔 Rôle: ${user.role}`);
    console.log(`⏰ Expire le: ${user.expires_at}`);
    console.log('='.repeat(70));
    console.log('\n🔗 LIEN DE VÉRIFICATION:');
    console.log('='.repeat(70));
    console.log(user.verification_link);
    console.log('='.repeat(70));
    console.log('\n💡 Copiez ce lien et ouvrez-le dans votre navigateur\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

getLatestVerificationToken();

