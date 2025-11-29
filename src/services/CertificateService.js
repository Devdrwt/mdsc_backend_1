const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

class CertificateService {
  static async generateCertificate(userId, courseId) {
    try {
      const [existing] = await pool.execute(
        'SELECT * FROM certificates WHERE user_id = ? AND course_id = ? LIMIT 1',
        [userId, courseId]
      );
      if (existing.length) return existing[0];

      // Générer un code unique pour le certificat (pour QR code)
      const certificateCode = uuidv4();
      
      // Générer un numéro de certificat unique pour affichage (format MDSC-XXXXXXXX-BJ)
      const random = Math.floor(10000000 + Math.random() * 90000000); // 8 chiffres aléatoires
      const certificateNumber = `MDSC-${random}-BJ`;

      // Générer le QR code
      const qrCodeDir = path.join(__dirname, '../../certificates/qrcodes');
      if (!fs.existsSync(qrCodeDir)) {
        fs.mkdirSync(qrCodeDir, { recursive: true });
      }
      
      const qrCodePath = path.join(qrCodeDir, `${certificateCode}.png`);
      // Utiliser certificate_number (format MDSC-XXXXXX-BJ) pour la vérification dans le QR code
      const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-certificate/${certificateNumber}`;
      
      await QRCode.toFile(qrCodePath, verificationUrl, {
        errorCorrectionLevel: 'H',
        type: 'png',
        width: 300
      });

      const qrCodeUrl = `/certificates/qrcodes/${certificateCode}.png`;
      const pdfUrl = null; // PDF sera généré séparément si nécessaire

      const [res] = await pool.execute(
        `INSERT INTO certificates (certificate_code, user_id, course_id, certificate_number, issued_at, verified, pdf_url, qr_code_url, is_valid)
         VALUES (?, ?, ?, ?, NOW(), FALSE, ?, ?, TRUE)`,
        [certificateCode, userId, courseId, certificateNumber, pdfUrl, qrCodeUrl]
      );

      return { 
        id: res.insertId, 
        certificate_code: certificateCode, 
        certificate_number: certificateNumber,
        pdf_url: pdfUrl,
        qr_code_url: qrCodeUrl
      };
    } catch (error) {
      console.error('Erreur lors de la génération du certificat dans CertificateService:', error);
      throw error;
    }
  }
}

module.exports = CertificateService;


