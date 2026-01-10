const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const QRCode = require('qrcode');
const MinioService = require('./minioService');

class CertificateService {
  /**
   * Générer un QR code et l'uploader vers MinIO
   */
  static async generateAndUploadQRCode(certificateCode, certificateNumber) {
    if (!MinioService.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible. Le stockage de fichiers nécessite MinIO.');
    }

    // Générer le QR code en mémoire (buffer)
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-certificate/${certificateNumber}`;
    
    const qrCodeBuffer = await QRCode.toBuffer(verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300
    });

    // Upload vers MinIO
    const objectName = MinioService.generateObjectName('certificates/qrcodes', `${certificateCode}.png`);
    const uploadResult = await MinioService.uploadFile(
      qrCodeBuffer,
      objectName,
      'image/png'
    );

    return uploadResult.url;
  }

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

      // Générer et uploader le QR code vers MinIO
      const qrCodeUrl = await this.generateAndUploadQRCode(certificateCode, certificateNumber);
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
      console.error('❌ [CERTIFICATE SERVICE] Erreur lors de la génération du certificat:', error);
      throw error;
    }
  }
}

module.exports = CertificateService;


