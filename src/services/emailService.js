const nodemailer = require('nodemailer');

// Configuration du transporteur d'emails
const transporter = nodemailer.createTransport({
  host: (process.env.EMAIL_HOST || 'smtp.gmail.com').trim(),
  port: parseInt(process.env.EMAIL_PORT, 10) || 587,
  secure: String(process.env.EMAIL_SECURE).trim() === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Vérification de la configuration email
const verifyEmailConfig = async () => {
  // Possibilité de désactiver volontairement l'email via .env
  if (process.env.EMAIL_ENABLED === 'false') {
    console.log('ℹ️  Emails désactivés par configuration (EMAIL_ENABLED=false)');
    return true;
  }

  // Normaliser/valider les variables (.trim pour éviter valeurs avec espaces)
  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASSWORD || '').trim();

  if (!emailUser || !emailPass) {
    console.log('ℹ️  Configuration email absente - les emails ne seront pas envoyés.');
    return true; // Ne pas bloquer le démarrage du serveur
  }
  
  try {
    await transporter.verify();
    const maskedUser = emailUser.replace(/.(?=.{2})/g, '*');
    console.log(`✅ Configuration email valide (user=${maskedUser})`);
    return true;
  } catch (error) {
    console.warn('⚠️  Impossible de vérifier la configuration email, tentative d\'envoi au runtime:', error.message);
    // Ne pas bloquer le serveur; on tentera l'envoi lors des appels réels
    return true;
  }
};

// Préheader invisible (aperçu dans les boîtes mail)
const buildPreheader = (text) => {
  return `
    <span style="display:none!important;opacity:0;color:transparent;visibility:hidden;height:0;width:0;overflow:hidden;mso-hide:all;">
      ${text}
    </span>
  `;
};

// Template HTML pour l'email de vérification
const getVerificationEmailTemplate = (firstName, verificationUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3380AA; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .button { display: inline-block; padding: 15px 30px; background: #3380AA; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; transition: all .2s ease; }
        .button:hover { background: transparent !important; color: #F8C37B !important; text-decoration: underline; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildPreheader('Vérifiez votre adresse email pour activer votre compte MdSC.')}
        <div class="header">
          <h1>Maison de la Société Civile</h1>
          <p>Plateforme MOOC</p>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName},</h2>
          <p>Merci de vous être inscrit sur la plateforme MdSC !</p>
          <p>Pour activer votre compte, veuillez cliquer sur le bouton ci-dessous :</p>
          <div style="text-align: center;">
            <a href="${verificationUrl}" class="button">Vérifier mon email</a>
          </div>
          <p>Ou copiez ce lien dans votre navigateur :</p>
          <p style="word-break: break-all; color: #3380AA;">${verificationUrl}</p>
          <p><strong>Ce lien expirera dans 24 heures.</strong></p>
          <p>Si vous n'avez pas créé de compte, vous pouvez ignorer cet email.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.</p>
          <p>Crédibilité, Innovation</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Template HTML pour la réinitialisation du mot de passe
const getPasswordResetEmailTemplate = (firstName, resetUrl) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3380AA; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .button { display: inline-block; padding: 15px 30px; background: #3380AA; color: #ffffff; text-decoration: none; border-radius: 5px; margin: 20px 0; transition: all .2s ease; }
        .button:hover { background: transparent !important; color: #F8C37B !important; text-decoration: underline; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildPreheader('Réinitialisez votre mot de passe MdSC - lien valable 1 heure.')}
        <div class="header">
          <h1>Réinitialisation du mot de passe</h1>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName},</h2>
          <p>Vous avez demandé à réinitialiser votre mot de passe.</p>
          <p>Pour créer un nouveau mot de passe, cliquez sur le bouton ci-dessous :</p>
          <div style="text-align: center;">
            <a href="${resetUrl}" class="button">Réinitialiser mon mot de passe</a>
          </div>
          <p>Ou copiez ce lien dans votre navigateur :</p>
          <p style="word-break: break-all; color: #3380AA;">${resetUrl}</p>
          <div class="warning">
            <p><strong>⚠️ Ce lien expirera dans 1 heure.</strong></p>
            <p>Si vous n'avez pas demandé cette réinitialisation, veuillez ignorer cet email et votre mot de passe restera inchangé.</p>
          </div>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.</p>
          <p>Crédibilité, Innovation</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Version texte (plain text) - Vérification
const getVerificationText = (firstName, url) => (
  `Bonjour ${firstName},\n\n` +
  `Merci pour votre inscription sur la plateforme MdSC.\n` +
  `Pour activer votre compte, veuillez cliquer sur le lien suivant (valable 24h):\n` +
  `${url}\n\n` +
  `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n` +
  `Maison de la Société Civile`
);

// Version texte (plain text) - Réinitialisation
const getPasswordResetText = (firstName, url) => (
  `Bonjour ${firstName},\n\n` +
  `Vous avez demandé la réinitialisation de votre mot de passe MdSC.\n` +
  `Cliquez sur le lien suivant pour créer un nouveau mot de passe (valable 1h):\n` +
  `${url}\n\n` +
  `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.\n\n` +
  `Maison de la Société Civile`
);

// Template HTML pour le code 2FA admin
const get2FACodeEmailTemplate = (firstName, code2FA) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #3380AA; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
        .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
        .code-box { background: #f8f9fa; border: 2px dashed #3380AA; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
        .code { font-size: 32px; font-weight: bold; color: #3380AA; letter-spacing: 5px; font-family: 'Courier New', monospace; }
        .warning { background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 15px 0; }
        .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="container">
        ${buildPreheader(`Code de vérification 2FA: ${code2FA}`)}
        <div class="header">
          <h1>Code de vérification 2FA</h1>
          <p>Administration MdSC</p>
        </div>
        <div class="content">
          <h2>Bonjour ${firstName},</h2>
          <p>Vous avez demandé à vous connecter à l'interface d'administration de la plateforme MdSC.</p>
          <p>Utilisez le code suivant pour compléter votre authentification :</p>
          <div class="code-box">
            <div class="code">${code2FA}</div>
          </div>
          <div class="warning">
            <p><strong>⚠️ Ce code est valable pendant 10 minutes seulement.</strong></p>
            <p>Si vous n'êtes pas à l'origine de cette demande de connexion, veuillez ignorer cet email et contacter immédiatement l'administrateur système.</p>
          </div>
          <p>Pour des raisons de sécurité, ne partagez jamais ce code avec personne.</p>
        </div>
        <div class="footer">
          <p>© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.</p>
          <p>Crédibilité, Innovation</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Version texte (plain text) - Code 2FA
const get2FACodeText = (firstName, code2FA) => (
  `Bonjour ${firstName},\n\n` +
  `Vous avez demandé à vous connecter à l'interface d'administration MdSC.\n\n` +
  `Code de vérification 2FA: ${code2FA}\n\n` +
  `Ce code est valable pendant 10 minutes seulement.\n\n` +
  `Si vous n'êtes pas à l'origine de cette demande, ignorez cet email et contactez l'administrateur.\n\n` +
  `Maison de la Société Civile`
);

// Envoyer l'email de vérification
const sendVerificationEmail = async (email, firstName, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const baseVerify = (process.env.VERIFY_EMAIL_URL || `${frontendUrl}/verify-email`).replace(/\/$/, '');
  const verificationUrl = `${baseVerify}?token=${token}`;
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '[MdSC] Vérification de votre adresse email',
      html: getVerificationEmailTemplate(firstName, verificationUrl),
      text: getVerificationText(firstName, verificationUrl)
    });
    console.log(`✅ Email de vérification envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email de vérification:', error.message);
    throw error;
  }
};

// Envoyer l'email de réinitialisation de mot de passe
const sendPasswordResetEmail = async (email, firstName, token) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/$/, '');
  const baseReset = (process.env.RESET_PASSWORD_URL || `${frontendUrl}/reset-password`).replace(/\/$/, '');
  const resetUrl = `${baseReset}?token=${token}`;
  
  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: email,
      subject: '[MdSC] Réinitialisation de votre mot de passe',
      html: getPasswordResetEmailTemplate(firstName, resetUrl),
      text: getPasswordResetText(firstName, resetUrl)
    });
    console.log(`✅ Email de réinitialisation envoyé à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi email de réinitialisation:', error.message);
    throw error;
  }
};

// Envoyer le code 2FA par email (pour admin)
const send2FACodeEmail = async (email, firstName, code2FA) => {
  // Vérifier si l'email est activé
  if (process.env.EMAIL_ENABLED === 'false') {
    console.log('ℹ️  Emails désactivés - code 2FA non envoyé par email');
    return false;
  }

  const emailUser = (process.env.EMAIL_USER || '').trim();
  const emailPass = (process.env.EMAIL_PASSWORD || '').trim();

  if (!emailUser || !emailPass) {
    console.log('ℹ️  Configuration email absente - code 2FA non envoyé par email');
    return false;
  }

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_FROM || emailUser,
      to: email,
      subject: '[MdSC Admin] Code de vérification 2FA',
      html: get2FACodeEmailTemplate(firstName, code2FA),
      text: get2FACodeText(firstName, code2FA)
    });
    console.log(`✅ Code 2FA envoyé par email à ${email}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi code 2FA par email:', error.message);
    // Ne pas bloquer le processus si l'email échoue
    return false;
  }
};

module.exports = {
  verifyEmailConfig,
  sendVerificationEmail,
  sendPasswordResetEmail,
  send2FACodeEmail,
};

