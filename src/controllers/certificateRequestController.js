const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

/**
 * Demander un certificat (étudiant)
 */
const requestCertificate = async (req, res) => {
  try {
    const { enrollmentId } = req.params;
    const userId = req.user.userId;

    // Vérifier l'inscription
    const [enrollments] = await pool.execute(
      `SELECT e.*, c.title as course_title, c.id as course_id
       FROM enrollments e
       JOIN courses c ON e.course_id = c.id
       WHERE e.id = ? AND e.user_id = ?`,
      [enrollmentId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Inscription non trouvée'
      });
    }

    const enrollment = enrollments[0];

    // Vérifier qu'une demande n'existe pas déjà
    const [existing] = await pool.execute(
      'SELECT id FROM certificate_requests WHERE enrollment_id = ?',
      [enrollmentId]
    );

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une demande de certificat existe déjà pour cette inscription'
      });
    }

    // Vérifier l'éligibilité (cours complété + évaluation finale réussie)
    const [progress] = await pool.execute(
      `SELECT 
        COUNT(*) as total_lessons,
        SUM(CASE WHEN p.status = 'completed' THEN 1 ELSE 0 END) as completed_lessons
       FROM progress p
       WHERE p.enrollment_id = ?`,
      [enrollmentId]
    );

    if (progress[0].total_lessons > 0 && progress[0].completed_lessons < progress[0].total_lessons) {
      return res.status(400).json({
        success: false,
        message: 'Vous devez compléter toutes les leçons avant de demander un certificat'
      });
    }

    // Vérifier l'évaluation finale
    const [evaluations] = await pool.execute(
      `SELECT ce.* FROM course_evaluations ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.id = ? AND ce.is_published = TRUE`,
      [enrollment.course_id]
    );

    if (evaluations.length > 0) {
      const evaluation = evaluations[0];
      
      // Vérifier qu'une tentative réussie existe
      const [attempts] = await pool.execute(
        `SELECT id FROM quiz_attempts 
         WHERE enrollment_id = ? 
         AND course_evaluation_id = ? 
         AND is_passed = TRUE`,
        [enrollmentId, evaluation.id]
      );

      if (attempts.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Vous devez réussir l\'évaluation finale avant de demander un certificat'
        });
      }
    }

    // Créer la demande
    const [requestResult] = await pool.execute(
      `INSERT INTO certificate_requests (
        enrollment_id, user_id, course_id, status, user_info
      ) VALUES (?, ?, ?, 'pending', ?)`,
      [
        enrollmentId, 
        userId, 
        enrollment.course_id,
        JSON.stringify({
          first_name: req.user.first_name || '',
          last_name: req.user.last_name || '',
          email: req.user.email || ''
        })
      ]
    );

    res.status(201).json({
      success: true,
      message: 'Demande de certificat créée avec succès',
      data: {
        request_id: requestResult.insertId,
        status: 'pending'
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la demande'
    });
  }
};

/**
 * Récupérer mes demandes de certificat
 */
const getMyCertificateRequests = async (req, res) => {
  try {
    const userId = req.user.userId;

    const [requests] = await pool.execute(
      `SELECT 
        cr.*,
        c.title as course_title,
        c.slug as course_slug,
        cert.pdf_url as certificate_url,
        cert.issued_at,
        cert.certificate_code,
        cert.certificate_number
       FROM certificate_requests cr
       JOIN courses c ON cr.course_id = c.id
       LEFT JOIN certificates cert ON cr.id = cert.request_id
       WHERE cr.user_id = ?
       ORDER BY cr.created_at DESC`,
      [userId]
    );

    res.json({
      success: true,
      data: requests
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

/**
 * Récupérer toutes les demandes (admin)
 */
const getAllCertificateRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    let params = [];

    if (status) {
      whereClause += ' AND cr.status = ?';
      params.push(status);
    }

    const [requests] = await pool.execute(
      `SELECT 
        cr.*,
        c.title as course_title,
        u.first_name,
        u.last_name,
        u.email,
        cert.pdf_url as certificate_url,
        cert.issued_at,
        cert.certificate_code,
        cert.certificate_number,
        cert.id as certificate_id
       FROM certificate_requests cr
       JOIN courses c ON cr.course_id = c.id
       JOIN users u ON cr.user_id = u.id
       LEFT JOIN certificates cert ON cr.id = cert.request_id
       ${whereClause}
       ORDER BY cr.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), offset]
    );

    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM certificate_requests cr ${whereClause}`,
      params
    );

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: countResult[0].total,
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

/**
 * Approuver une demande et générer le certificat (admin)
 */
const approveCertificateRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const adminId = req.user.userId;

    // Récupérer la demande
    const [requests] = await pool.execute(
      `SELECT cr.*, u.first_name, u.last_name, u.email, c.title as course_title
       FROM certificate_requests cr
       JOIN users u ON cr.user_id = u.id
       JOIN courses c ON cr.course_id = c.id
       WHERE cr.id = ?`,
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    const request = requests[0];

    if (request.status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cette demande a déjà été traitée'
      });
    }

    // Générer le certificat PDF
    const certificateData = await generateCertificatePDF(request);

    // Générer un code unique pour le certificat
    const certificateCode = uuidv4();
    // Générer un numéro de certificat unique pour affichage (format MDSC-XXXXXXXX-BJ)
    const random = Math.floor(10000000 + Math.random() * 90000000); // 8 chiffres aléatoires
    const certificateNumber = `MDSC-${random}-BJ`;

    // Créer le certificat dans la base de données
    const [certificateResult] = await pool.execute(
      `INSERT INTO certificates (
        request_id, user_id, course_id, certificate_code, certificate_number,
        pdf_url, qr_code_url
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        requestId,
        request.user_id,
        request.course_id,
        certificateCode,
        certificateNumber,
        certificateData.url,
        null // qr_code_url sera généré séparément si nécessaire
      ]
    );

    // Mettre à jour la demande
    await pool.execute(
      `UPDATE certificate_requests 
       SET status = 'approved', reviewed_at = NOW(), reviewed_by = ?, issued_at = NOW()
       WHERE id = ?`,
      [adminId, requestId]
    );

    res.json({
      success: true,
      message: 'Certificat généré avec succès',
      data: {
        certificate_id: certificateResult.insertId,
        certificate_url: certificateData.url
      }
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la génération du certificat',
      error: error.message
    });
  }
};

/**
 * Rejeter une demande (admin)
 */
const rejectCertificateRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { rejection_reason } = req.body;
    const adminId = req.user.userId;

    const [requests] = await pool.execute(
      'SELECT id, status FROM certificate_requests WHERE id = ?',
      [requestId]
    );

    if (requests.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Demande non trouvée'
      });
    }

    if (requests[0].status !== 'pending') {
      return res.status(400).json({
        success: false,
        message: 'Cette demande a déjà été traitée'
      });
    }

    await pool.execute(
      `UPDATE certificate_requests 
       SET status = 'rejected', reviewed_at = NOW(), reviewed_by = ?, rejection_reason = ?
       WHERE id = ?`,
      [adminId, sanitizeValue(rejection_reason), requestId]
    );

    res.json({
      success: true,
      message: 'Demande rejetée'
    });

  } catch (error) {
    console.error('Erreur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet'
    });
  }
};

/**
 * Générer le PDF du certificat
 */
async function generateCertificatePDF(request) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        layout: 'landscape',
        margin: 50
      });

      // Créer le dossier de certificats s'il n'existe pas
      const certDir = path.join(__dirname, '../../uploads/certificates');
      if (!fs.existsSync(certDir)) {
        fs.mkdirSync(certDir, { recursive: true });
      }

      const filename = `certificate_${request.id}_${Date.now()}.pdf`;
      const filepath = path.join(certDir, filename);
      const stream = fs.createWriteStream(filepath);

      doc.pipe(stream);

      // Design du certificat
      doc.fontSize(48)
         .font('Helvetica-Bold')
         .text('ATTESTATION DE COMPLÉTION', { align: 'center' })
         .moveDown(2);

      doc.fontSize(24)
         .font('Helvetica')
         .text('Ceci certifie que', { align: 'center' })
         .moveDown();

      doc.fontSize(36)
         .font('Helvetica-Bold')
         .text(`${request.first_name} ${request.last_name}`, { align: 'center' })
         .moveDown(2);

      doc.fontSize(20)
         .font('Helvetica')
         .text('a complété avec succès le cours', { align: 'center' })
         .moveDown();

      doc.fontSize(28)
         .font('Helvetica-Bold')
         .text(request.course_title, { align: 'center' })
         .moveDown(3);

      // Générer le QR code
      const qrCodeData = JSON.stringify({
        certificate_id: request.id,
        user_id: request.user_id,
        course_id: request.course_id,
        issued_at: new Date().toISOString()
      });

      const qrCodeImage = await QRCode.toDataURL(qrCodeData, {
        width: 200,
        margin: 2
      });

      // Ajouter le QR code
      const qrCodeBuffer = Buffer.from(qrCodeImage.split(',')[1], 'base64');
      doc.image(qrCodeBuffer, {
        fit: [150, 150],
        align: 'center'
      })
      .moveDown();

      doc.fontSize(12)
         .font('Helvetica')
         .text(`Attestation ID: ${request.id}`, { align: 'center' })
         .text(`Date d'émission: ${new Date().toLocaleDateString('fr-FR')}`, { align: 'center' });

      doc.end();

      stream.on('finish', () => {
        resolve({
          url: `/uploads/certificates/${filename}`,
          qrCodeData
        });
      });

      stream.on('error', reject);

    } catch (error) {
      reject(error);
    }
  });
}

module.exports = {
  requestCertificate,
  getMyCertificateRequests,
  getAllCertificateRequests,
  approveCertificateRequest,
  rejectCertificateRequest
};

