require('dotenv').config();
const { pool } = require('../src/config/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
  try {
    // Récupérer les arguments de la ligne de commande
    const args = process.argv.slice(2);
    
    let email, password, firstName, lastName;

    if (args.length >= 2) {
      // Mode non-interactif : email et password en arguments
      email = args[0];
      password = args[1];
      firstName = args[2] || 'Admin';
      lastName = args[3] || 'User';
    } else {
      // Mode interactif
      const readline = require('readline');
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      });

      function question(query) {
        return new Promise(resolve => rl.question(query, resolve));
      }

      console.log('🔐 Création d\'un administrateur\n');
      console.log('='.repeat(50));

      email = await question('📧 Adresse email administrateur: ');
      password = await question('🔑 Mot de passe (minimum 12 caractères): ');
      firstName = await question('👤 Prénom (optionnel, défaut: Admin): ') || 'Admin';
      lastName = await question('👤 Nom (optionnel, défaut: User): ') || 'User';

      rl.close();
    }

    // Validation
    if (!email || !email.includes('@')) {
      console.error('❌ Email invalide');
      process.exit(1);
    }

    if (!password || password.length < 12) {
      console.error('❌ Le mot de passe doit contenir au moins 12 caractères');
      process.exit(1);
    }

    // Vérifier si l'email existe déjà
    const [existing] = await pool.execute(
      'SELECT id, email, role FROM users WHERE email = ?',
      [email]
    );

    if (existing.length > 0) {
      console.log(`\n⚠️  Un utilisateur avec l'email ${email} existe déjà:`);
      console.log(`   - ID: ${existing[0].id}`);
      console.log(`   - Rôle: ${existing[0].role}`);
      
      if (args.length < 2) {
        // Mode interactif : demander confirmation
        const readline = require('readline');
        const rl = readline.createInterface({
          input: process.stdin,
          output: process.stdout
        });
        const update = await new Promise(resolve => rl.question('\nVoulez-vous mettre à jour cet utilisateur en admin? (o/n): ', resolve));
        rl.close();
        
        if (update.toLowerCase() !== 'o' && update.toLowerCase() !== 'oui') {
          console.log('❌ Opération annulée');
          process.exit(0);
        }
      } else {
        // Mode non-interactif : mettre à jour automatiquement
        console.log('\n⚠️  Mise à jour de l\'utilisateur existant...');
      }

      // Mettre à jour l'utilisateur existant
      const hashedPassword = await bcrypt.hash(password, 10);
      
      await pool.execute(
        `UPDATE users 
         SET password = ?, role = 'admin', is_active = TRUE, is_email_verified = TRUE, email_verified_at = NOW()
         WHERE email = ?`,
        [hashedPassword, email]
      );

      console.log('\n✅ Administrateur mis à jour avec succès!');
      console.log('='.repeat(50));
      console.log(`   Email: ${email}`);
      console.log(`   Rôle: admin`);
      console.log('='.repeat(50));
      process.exit(0);
    }

    // Hasher le mot de passe
    console.log('\n⏳ Hachage du mot de passe...');
    const hashedPassword = await bcrypt.hash(password, 10);

    // Créer l'administrateur
    console.log('⏳ Création de l\'administrateur...');
    const [result] = await pool.execute(
      `INSERT INTO users (
        email, password, first_name, last_name, role, 
        is_active, is_email_verified, email_verified_at
      ) VALUES (?, ?, ?, ?, 'admin', TRUE, TRUE, NOW())`,
      [email, hashedPassword, firstName, lastName]
    );

    console.log('\n✅ Administrateur créé avec succès!');
    console.log('='.repeat(50));
    console.log(`   ID: ${result.insertId}`);
    console.log(`   Email: ${email}`);
    console.log(`   Prénom: ${firstName}`);
    console.log(`   Nom: ${lastName}`);
    console.log(`   Rôle: admin`);
    console.log('='.repeat(50));
    console.log('\n💡 Vous pouvez maintenant vous connecter avec cet email et ce mot de passe.');

  } catch (error) {
    console.error('\n❌ Erreur lors de la création:', error.message);
    if (error.code === 'ER_DUP_ENTRY') {
      console.error('   Un utilisateur avec cet email existe déjà.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

createAdmin();
