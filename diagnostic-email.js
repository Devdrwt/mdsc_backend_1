/**
 * Script de diagnostic pour l'envoi d'emails
 * Vérifie tous les points de défaillance potentiels
 */

require('dotenv').config();

const nodemailer = require('nodemailer');

console.log('\n' + '='.repeat(70));
console.log('🔍 DIAGNOSTIC COMPLET - ENVOI D\'EMAILS');
console.log('='.repeat(70) + '\n');

// 1. Vérifier les variables d'environnement
console.log('📋 1. VARIABLES D\'ENVIRONNEMENT\n');

const vars = {
  'EMAIL_ENABLED': process.env.EMAIL_ENABLED,
  'EMAIL_HOST': process.env.EMAIL_HOST,
  'EMAIL_PORT': process.env.EMAIL_PORT,
  'EMAIL_SECURE': process.env.EMAIL_SECURE,
  'EMAIL_USER': process.env.EMAIL_USER,
  'EMAIL_PASSWORD': process.env.EMAIL_PASSWORD ? '***' + process.env.EMAIL_PASSWORD.slice(-3) : undefined,
  'EMAIL_FROM': process.env.EMAIL_FROM,
  'FRONTEND_URL': process.env.FRONTEND_URL,
  'VERIFY_EMAIL_URL': process.env.VERIFY_EMAIL_URL,
  'RESET_PASSWORD_URL': process.env.RESET_PASSWORD_URL,
};

let envErrors = [];
let envWarnings = [];

Object.entries(vars).forEach(([key, value]) => {
  const status = value !== undefined && value !== null && value !== '' 
    ? '✅' 
    : '❌';
  console.log(`  ${status} ${key.padEnd(25)}: ${value || '(vide ou non défini)'}`);
  
  if (!value && (key === 'EMAIL_USER' || key === 'EMAIL_PASSWORD')) {
    envErrors.push(`${key} est manquant`);
  }
  
  if (!value && (key === 'EMAIL_HOST' || key === 'EMAIL_PORT' || key === 'EMAIL_FROM')) {
    envWarnings.push(`${key} utilise la valeur par défaut`);
  }
});

if (process.env.EMAIL_ENABLED === 'false') {
  envErrors.push('EMAIL_ENABLED est défini à false - les emails sont désactivés');
}

console.log('\n');

if (envErrors.length > 0) {
  console.log('❌ ERREURS CRITIQUES:');
  envErrors.forEach(err => console.log(`   - ${err}`));
  console.log('\n');
}

if (envWarnings.length > 0) {
  console.log('⚠️  AVERTISSEMENTS:');
  envWarnings.forEach(warn => console.log(`   - ${warn}`));
  console.log('\n');
}

// 2. Vérifier la configuration Nodemailer
console.log('📧 2. CONFIGURATION NODEMAILER\n');

let transporter;
try {
  transporter = nodemailer.createTransport({
    host: (process.env.EMAIL_HOST || 'smtp.gmail.com').trim(),
    port: parseInt(process.env.EMAIL_PORT, 10) || 587,
    secure: String(process.env.EMAIL_SECURE).trim() === 'true',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASSWORD,
    },
  });

  console.log(`  Host: ${transporter.options.host}`);
  console.log(`  Port: ${transporter.options.port}`);
  console.log(`  Secure (TLS): ${transporter.options.secure}`);
  console.log(`  User: ${transporter.options.auth.user || '(non défini)'}`);
  console.log(`  Password: ${transporter.options.auth.pass ? '***' : '(non défini)'}`);
  
  console.log('\n');
} catch (error) {
  console.error('  ❌ Erreur lors de la création du transporteur:', error.message);
  console.log('\n');
  process.exit(1);
}

// 3. Tester la connexion SMTP
console.log('🔌 3. TEST DE CONNEXION SMTP\n');

transporter.verify()
  .then(() => {
    console.log('  ✅ Connexion SMTP réussie\n');
    
    // 4. Tester l'envoi d'un email de test
    console.log('📨 4. TEST D\'ENVOI D\'EMAIL\n');
    
    if (!process.env.EMAIL_FROM) {
      console.log('  ❌ EMAIL_FROM non défini - impossible de tester l\'envoi\n');
      return;
    }
    
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASSWORD) {
      console.log('  ❌ EMAIL_USER ou EMAIL_PASSWORD manquant - impossible de tester l\'envoi\n');
      return;
    }
    
    // Récupérer et nettoyer l'email de test
    let testEmail = process.argv[2] || 'abdoubachaikowiyou@gmail.com';
    
    // Nettoyer l'email (enlever crochets, espaces, etc.)
    testEmail = testEmail.trim().replace(/^\[|\]$/g, '');
    
    // Valider le format de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      console.error(`  ❌ Format d'email invalide: ${testEmail}`);
      console.error('  Utilisation de l\'email par défaut: abdoubachaikowiyou@gmail.com\n');
      testEmail = 'abdoubachaikowiyou@gmail.com';
    }
    
    console.log(`  Envoi d'un email de test à: ${testEmail}`);
    
    return transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: testEmail,
      subject: '[TEST] Diagnostic Email MdSC',
      html: `
        <h2>Test d'envoi d'email</h2>
        <p>Si vous recevez cet email, la configuration fonctionne correctement.</p>
        <p><strong>Date:</strong> ${new Date().toISOString()}</p>
      `,
      text: `Test d'envoi d'email - ${new Date().toISOString()}`
    });
  })
  .then((result) => {
    if (result) {
      console.log('  ✅ Email de test envoyé avec succès!');
      console.log(`  Message ID: ${result.messageId}\n`);
    }
    
    // 5. Résumé final
    console.log('='.repeat(70));
    console.log('📊 RÉSUMÉ DU DIAGNOSTIC');
    console.log('='.repeat(70) + '\n');
    
    if (envErrors.length === 0) {
      console.log('✅ Tous les paramètres critiques sont configurés');
    } else {
      console.log('❌ Problèmes détectés - voir les erreurs ci-dessus');
    }
    
    console.log('\n📝 POINTS À VÉRIFIER:\n');
    console.log('  1. ✅ Variables d\'environnement dans .env');
    console.log('  2. ✅ Connexion SMTP (testée ci-dessus)');
    console.log('  3. ⚠️  Si Gmail: Vérifier que "Accès moins sécurisé" est activé');
    console.log('     OU utiliser un "Mot de passe d\'application" (recommandé)');
    console.log('  4. ⚠️  Si autre fournisseur: Vérifier les paramètres SMTP');
    console.log('  5. ⚠️  Vérifier que le serveur peut sortir sur le port SMTP (587 ou 465)');
    console.log('  6. ⚠️  Vérifier les logs du serveur lors d\'un envoi réel');
    console.log('\n');
  })
  .catch((error) => {
    console.error('  ❌ ERREUR:', error.message);
    console.error('  Code:', error.code);
    console.error('  Command:', error.command);
    console.error('  Response:', error.response);
    console.error('  ResponseCode:', error.responseCode);
    console.error('\n');
    
    console.log('💡 SOLUTIONS POSSIBLES:\n');
    
    if (error.code === 'EAUTH') {
      console.log('  - Problème d\'authentification:');
      console.log('    • Vérifiez EMAIL_USER et EMAIL_PASSWORD');
      if (transporter.options.host.includes('gmail')) {
        console.log('    • Pour Gmail: Utilisez un "Mot de passe d\'application"');
        console.log('    • Activez l\'authentification à deux facteurs');
        console.log('    • Générez un mot de passe d\'application:');
        console.log('      https://myaccount.google.com/apppasswords');
      }
    }
    
    if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      console.log('  - Problème de connexion réseau:');
      console.log('    • Vérifiez que le serveur peut accéder à Internet');
      console.log('    • Vérifiez que le port SMTP n\'est pas bloqué par un firewall');
      console.log('    • Vérifiez EMAIL_HOST et EMAIL_PORT');
    }
    
    if (error.code === 'EMESSAGE' || error.code === 'EENVELOPE') {
      console.log('  - Problème avec le message ou l\'adresse destinataire:');
      console.log('    • Vérifiez EMAIL_FROM (format: "nom <email@domaine.com>")');
      console.log('    • Vérifiez le format de l\'adresse email destinataire');
      console.log('    • Assurez-vous que l\'email ne contient pas de crochets [ ]');
      console.log('    • Format attendu: email@domaine.com');
    }
    
    console.log('\n');
    process.exit(1);
  });

