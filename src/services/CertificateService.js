const { pool } = require('../config/database');

class CertificateService {
  static async generateCertificate(userId, courseId) {
    const [existing] = await pool.execute(
      'SELECT * FROM certificates WHERE user_id = ? AND course_id = ? LIMIT 1',
      [userId, courseId]
    );
    if (existing.length) return existing[0];

    // Générer un code au format MDSC-########-BJ (8 chiffres aléatoires)
    const random = Math.floor(10000000 + Math.random() * 90000000);
    const certificateCode = `MDSC-${random}-BJ`;
    const pdfUrl = null; // Stub: à implémenter via générateur PDF
    const qrUrl = null;  // Stub: à implémenter via QR code

    const [res] = await pool.execute(
      `INSERT INTO certificates (certificate_code, user_id, course_id, certificate_number, issued_at, verified, pdf_url, qr_code_url, is_valid)
       VALUES (?, ?, ?, ?, NOW(), FALSE, ?, ?, TRUE)`,
      [certificateCode, userId, courseId, `MDSC-${Date.now()}`, pdfUrl, qrUrl]
    );

    return { id: res.insertId, certificate_code: certificateCode, pdf_url: pdfUrl };
  }
}

module.exports = CertificateService;


