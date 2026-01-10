const { sendEmail } = require('../services/emailService');

/**
 * Envoyer un message de contact
 */
const sendContactMessage = async (req, res) => {
  try {
    const { name, email, phone, subject, message, recipient_email } = req.body;

    // Validation des champs requis
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Les champs nom, email, sujet et message sont requis',
      });
    }

    // Validation de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Format d\'email invalide',
      });
    }

    // Email de destination : priorité à CONTACT_EMAIL dans .env, sinon recipient_email de la requête, sinon EMAIL_FROM, sinon défaut
    const recipientEmail = process.env.CONTACT_EMAIL || recipient_email || process.env.EMAIL_FROM || 'info@mdscbenin.org';

    // Template HTML pour l'email de contact
    const contactEmailTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3380AA; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .field { margin-bottom: 15px; }
          .field-label { font-weight: bold; color: #3380AA; }
          .field-value { margin-top: 5px; padding: 10px; background: #f5f5f5; border-radius: 4px; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Nouveau message de contact</h1>
            <p>Plateforme MOOC - Maison de la Société Civile</p>
          </div>
          <div class="content">
            <div class="field">
              <div class="field-label">Nom:</div>
              <div class="field-value">${name}</div>
            </div>
            <div class="field">
              <div class="field-label">Email:</div>
              <div class="field-value">${email}</div>
            </div>
            ${phone ? `
            <div class="field">
              <div class="field-label">Téléphone:</div>
              <div class="field-value">${phone}</div>
            </div>
            ` : ''}
            <div class="field">
              <div class="field-label">Sujet:</div>
              <div class="field-value">${subject}</div>
            </div>
            <div class="field">
              <div class="field-label">Message:</div>
              <div class="field-value" style="white-space: pre-wrap;">${message}</div>
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

    // Version texte
    const contactEmailText = `
Nouveau message de contact - Plateforme MOOC MdSC

Nom: ${name}
Email: ${email}
${phone ? `Téléphone: ${phone}` : ''}
Sujet: ${subject}

Message:
${message}

---
© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.
    `;

    // Envoyer l'email
    await sendEmail({
      to: recipientEmail,
      subject: `[Contact MdSC] ${subject}`,
      html: contactEmailTemplate,
      text: contactEmailText,
      from: process.env.EMAIL_FROM,
    });

    // Envoyer une confirmation à l'expéditeur
    const confirmationTemplate = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: 'Open Sans', Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #3380AA; color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
          .content { background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Message reçu</h1>
            <p>Plateforme MOOC - Maison de la Société Civile</p>
          </div>
          <div class="content">
            <p>Bonjour ${name},</p>
            <p>Nous avons bien reçu votre message concernant "<strong>${subject}</strong>".</p>
            <p>Notre équipe vous répondra dans les plus brefs délais.</p>
            <p>Cordialement,<br>L'équipe Maison de la Société Civile</p>
          </div>
          <div class="footer">
            <p>© ${new Date().getFullYear()} Maison de la Société Civile. Tous droits réservés.</p>
            <p>Crédibilité, Innovation</p>
          </div>
        </div>
      </body>
      </html>
    `;

    // Envoyer la confirmation (sans bloquer si ça échoue)
    try {
      await sendEmail({
        to: email,
        subject: '[MdSC] Confirmation de réception de votre message',
        html: confirmationTemplate,
        text: `Bonjour ${name},\n\nNous avons bien reçu votre message concernant "${subject}".\n\nNotre équipe vous répondra dans les plus brefs délais.\n\nCordialement,\nL'équipe Maison de la Société Civile`,
        from: process.env.EMAIL_FROM,
      });
    } catch (confirmationError) {
      console.warn('⚠️ Erreur lors de l\'envoi de la confirmation:', confirmationError.message);
      // Ne pas bloquer la réponse si la confirmation échoue
    }

    res.json({
      success: true,
      message: 'Votre message a été envoyé avec succès. Nous vous répondrons dans les plus brefs délais.',
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi du message de contact:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message. Veuillez réessayer plus tard.',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
  }
};

module.exports = {
  sendContactMessage,
};

