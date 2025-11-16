const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

// Récupérer mes certificats
const getMyCertificates = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    const { courseId } = req.query;

    let whereClause = 'WHERE c.user_id = ?';
    let params = [userId];

    if (courseId) {
      whereClause += ' AND c.course_id = ?';
      params.push(courseId);
    }

    const query = `
      SELECT 
        c.*,
        co.title as course_title,
        co.description as course_description,
        u.first_name,
        u.last_name,
        u.email
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      ${whereClause}
      ORDER BY c.issued_at DESC
    `;

    const [certificates] = await pool.execute(query, params);

    res.json({
      success: true,
      data: certificates
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des certificats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des certificats'
    });
  }
};

// Récupérer un certificat par ID
const getCertificateById = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    let query = `
      SELECT 
        c.*,
        co.title as course_title,
        co.description as course_description,
        co.duration_minutes,
        u.first_name,
        u.last_name,
        u.email
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    const params = [certificateId];

    // Si ce n'est pas un admin, vérifier que le certificat appartient à l'utilisateur
    if (!isAdmin) {
      query += ' AND c.user_id = ?';
      params.push(userId);
    }

    const [certificates] = await pool.execute(query, params);

    if (certificates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificat non trouvé'
      });
    }

    res.json({
      success: true,
      data: certificates[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du certificat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du certificat'
    });
  }
};

// Vérifier un certificat par code (pour QR code)
const verifyCertificate = async (req, res) => {
  try {
    const { code } = req.params;

    const query = `
      SELECT 
        c.*,
        co.title as course_title,
        co.description as course_description,
        u.first_name,
        u.last_name,
        u.email,
        CASE 
          WHEN c.is_valid = FALSE THEN FALSE
          WHEN c.expires_at IS NOT NULL AND c.expires_at < NOW() THEN FALSE
          WHEN c.revoked_at IS NOT NULL THEN FALSE
          ELSE TRUE
        END as is_verified
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      WHERE c.certificate_code = ?
    `;

    const [certificates] = await pool.execute(query, [code]);

    if (certificates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificat non trouvé',
        is_verified: false
      });
    }

    const certificate = certificates[0];

    // Mettre à jour verified si pas déjà fait
    if (!certificate.verified && certificate.is_verified) {
      await pool.execute(
        'UPDATE certificates SET verified = TRUE WHERE id = ?',
        [certificate.id]
      );
      certificate.verified = true;
    }

    res.json({
      success: true,
      data: certificate
    });

  } catch (error) {
    console.error('Erreur lors de la vérification du certificat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du certificat'
    });
  }
};

// Télécharger un certificat PDF
const downloadCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const isAdmin = req.user?.role === 'admin';

    let query = `
      SELECT 
        c.*,
        co.title as course_title,
        co.description as course_description,
        co.duration_minutes,
        u.first_name,
        u.last_name,
        u.email
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      WHERE c.id = ?
    `;
    const params = [certificateId];

    // Si ce n'est pas un admin, vérifier que le certificat appartient à l'utilisateur
    if (!isAdmin) {
      query += ' AND c.user_id = ?';
      params.push(userId);
    }

    const [certificates] = await pool.execute(query, params);

    if (certificates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificat non trouvé'
      });
    }

    const certificate = certificates[0];

    // Générer le PDF s'il n'existe pas encore
    if (!certificate.pdf_url) {
      const pdfPath = await generateCertificatePDF(certificate);
      const pdfUrl = `/certificates/${path.basename(pdfPath)}`;
      
      await pool.execute(
        'UPDATE certificates SET pdf_url = ? WHERE id = ?',
        [pdfUrl, certificateId]
      );
      
      certificate.pdf_url = pdfUrl;
    }

    const filePath = path.join(__dirname, '../../', certificate.pdf_url);

    res.download(filePath, `certificate-${certificate.certificate_number}.pdf`, (err) => {
      if (err) {
        console.error('Erreur lors du téléchargement:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Erreur lors du téléchargement du certificat'
          });
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors du téléchargement du certificat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du certificat'
    });
  }
};

// Générer un certificat PDF avec un design proche du CertificatePreview (bords bleus, titres, QR)
const generateCertificatePDF = async (certificate) => {
  return new Promise((resolve, reject) => {
    try {
      const certificatesDir = path.join(__dirname, '../../certificates');
      if (!fs.existsSync(certificatesDir)) {
        fs.mkdirSync(certificatesDir, { recursive: true });
      }

      const fileName = `certificate-${certificate.certificate_code}.pdf`;
      const filePath = path.join(certificatesDir, fileName);

      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 24 // ~8mm pour éviter toute coupe à l'impression/téléchargement
      });

      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      const primaryBlue = '#006599';
      const textColor = '#1f2937';

      const pageW = doc.page.width;
      const pageH = doc.page.height;
      const m = doc.page.margins; // {top,left,right,bottom}
      const left = m.left;
      const top = m.top;
      const usableW = pageW - m.left - m.right;
      const usableH = pageH - m.top - m.bottom;

      // Fond blanc
      doc.save();
      doc.rect(0, 0, pageW, pageH).fill('#FFFFFF');
      doc.restore();

      // Bordure externe (15px ≈ 11.34 pt)
      const outerThickness = 15 * 0.75; // px -> pt
      const innerThickness = 4 * 0.75;  // px -> pt
      const insetGap = 2 * 0.75;       // px -> pt

      // Outer border
      doc.save();
      doc.lineWidth(outerThickness);
      doc.strokeColor(primaryBlue);
      doc.rect(
        left + outerThickness / 2,
        top + outerThickness / 2,
        usableW - outerThickness,
        usableH - outerThickness
      ).stroke();
      doc.restore();

      // Inner border
      const inset = outerThickness + insetGap + innerThickness / 2;
      const innerW = usableW - (inset * 2);
      const innerH = usableH - (inset * 2);
      doc.save();
      doc.lineWidth(innerThickness);
      doc.strokeColor(primaryBlue);
      doc.rect(left + inset, top + inset, innerW, innerH).stroke();
      doc.restore();

      // Titres
      // "CERTIFICAT DE RECONNAISSANCE"
      doc.fillColor(textColor);
      doc.fontSize(30);
      doc.font('Helvetica-Bold');
      doc.text('CERTIFICAT DE RECONNAISSANCE', left, top + 66, { width: usableW, align: 'center' });

      // "Ce diplôme est décerné à :"
      doc.moveDown(1);
      doc.fontSize(16);
      doc.fillColor(primaryBlue);
      doc.font('Helvetica');
      doc.text('Ce diplôme est décerné à :', left, top + 116, { width: usableW, align: 'center' });

      // Nom bénéficiaire
      const fullName = `${certificate.first_name || ''} ${certificate.last_name || ''}`.trim();
      doc.font('Helvetica-Bold');
      doc.fillColor(textColor);
      doc.fontSize(28);
      doc.text(fullName || '—', left, top + 151, { width: usableW, align: 'center' });

      // Description
      const courseTitle = certificate.course_title || '—';
      const issuedDate = new Date(certificate.issued_at || Date.now()).toLocaleDateString('fr-FR', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      const paragraphY = top + 196;
      doc.font('Helvetica');
      doc.fontSize(14);
      doc.fillColor(textColor);
      const desc = `Nous certifions par la présente que ${fullName || '—'} a complété avec succès la formation « ${courseTitle} ». Ses réalisations exceptionnelles, son professionnalisme et sa quête d’excellence constituent une véritable source d’inspiration.`;
      doc.text(desc, left + usableW * 0.12, paragraphY, { width: usableW * 0.76, align: 'center' });

      // Ligne "Fait à ...   Le ..."
      const lineY = paragraphY + 110;
      const leftX = left + usableW * 0.25;
      const midGap = 60;
      const labelFontSize = 12;

      doc.fontSize(labelFontSize);
      doc.fillColor(textColor);
      doc.text('Fait à :', leftX, lineY);
      const locationText = (certificate.location || 'Cotonou, Bénin');
      const locWidth = doc.widthOfString(locationText);
      const locX = leftX + doc.widthOfString('Fait à : ') + 6;
      // Souligner uniquement la valeur
      doc.text(locationText, locX, lineY);
      doc.moveTo(locX, lineY + 14).lineTo(locX + locWidth, lineY + 14).strokeColor(textColor).lineWidth(0.5).stroke();

      const rightStartX = leftX + 200 + midGap;
      doc.text('Le :', rightStartX, lineY);
      const dateWidth = doc.widthOfString(issuedDate);
      const dateX = rightStartX + doc.widthOfString('Le : ') + 6;
      doc.text(issuedDate, dateX, lineY);
      doc.moveTo(dateX, lineY + 14).lineTo(dateX + dateWidth, lineY + 14).strokeColor(textColor).lineWidth(0.5).stroke();

      // QR code (si présent) en bas à gauche et code
      if (certificate.qr_code_url && fs.existsSync(path.join(__dirname, '../../', certificate.qr_code_url))) {
        const qrCodePath = path.join(__dirname, '../../', certificate.qr_code_url);
        doc.image(qrCodePath, left + 26, top + usableH - 180, { fit: [120, 120] });
        doc.fontSize(10).fillColor('#374151');
        doc.text(certificate.certificate_code || '', left + 26, top + usableH - 50, { width: 150, align: 'center' });
      }

      // Sceau (si un fichier est disponible côté backend, optionnel)
      const possibleSealPaths = [
        path.join(__dirname, '../../public/Sceau.png'),
        path.join(__dirname, '../../Sceau.png'),
      ];
      const sealPath = possibleSealPaths.find(p => fs.existsSync(p));
      if (sealPath) {
        doc.image(sealPath, left + usableW - 220, top + usableH - 220, { fit: [150, 150] });
      }

      doc.end();

      stream.on('finish', () => {
        resolve(filePath);
      });

      stream.on('error', (error) => {
        reject(error);
      });

    } catch (error) {
      reject(error);
    }
  });
};

// Wrapper HTTP pour générer un certificat
const generateCertificateForCourseHTTP = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const certificateId = await generateCertificateForCourse(userId, courseId);

    res.json({
      success: true,
      message: 'Certificat généré avec succès',
      data: { certificateId }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du certificat:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Erreur lors de la génération du certificat'
    });
  }
};

// Générer automatiquement un certificat (appelé quand un cours est complété)
const generateCertificateForCourse = async (userId, courseId) => {
  try {
    // Vérifier que l'utilisateur a complété le cours
    const enrollmentQuery = `
      SELECT * FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND status = 'completed'
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      throw new Error('Cours non complété');
    }

    // Si il y a un quiz final, vérifier qu'il est réussi
    const finalQuizQuery = `
      SELECT q.id, q.passing_score
      FROM quizzes q
      WHERE q.course_id = ? AND q.is_final = TRUE AND q.is_published = TRUE
      ORDER BY q.created_at DESC
      LIMIT 1
    `;
    const [finalQuizzes] = await pool.execute(finalQuizQuery, [courseId]);

    if (finalQuizzes.length > 0) {
      const finalQuiz = finalQuizzes[0];
      // Vérifier qu'il y a une tentative réussie du quiz final
      const finalAttemptQuery = `
        SELECT id FROM quiz_attempts
        WHERE user_id = ? AND quiz_id = ? AND is_passed = TRUE
        ORDER BY completed_at DESC
        LIMIT 1
      `;
      const [finalAttempts] = await pool.execute(finalAttemptQuery, [userId, finalQuiz.id]);

      if (finalAttempts.length === 0) {
        throw new Error('Quiz final non réussi');
      }
    }

    // Vérifier qu'un certificat n'existe pas déjà
    const existingCertQuery = `
      SELECT id FROM certificates 
      WHERE user_id = ? AND course_id = ? AND is_valid = TRUE
    `;
    const [existingCerts] = await pool.execute(existingCertQuery, [userId, courseId]);

    if (existingCerts.length > 0) {
      return existingCerts[0].id;
    }

    // Générer un code unique pour le certificat au format Mdsc-xxxxxxxx-Bj (8 chiffres)
    const generateMdscCode = () => {
      const num = Math.floor(10000000 + Math.random() * 90000000); // 8 chiffres
      return `Mdsc-${num}-Bj`;
    };

    // S'assurer de l'unicité du code
    let certificateCode = generateMdscCode();
    for (let i = 0; i < 5; i++) {
      const [dup] = await pool.execute(
        'SELECT id FROM certificates WHERE certificate_code = ? LIMIT 1',
        [certificateCode]
      );
      if (!dup || dup.length === 0) break;
      certificateCode = generateMdscCode();
    }
    
    // Générer un numéro de certificat unique pour affichage
    const certificateNumber = `MDSC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Générer le QR code
    const qrCodeDir = path.join(__dirname, '../../certificates/qrcodes');
    if (!fs.existsSync(qrCodeDir)) {
      fs.mkdirSync(qrCodeDir, { recursive: true });
    }
    
    const qrCodePath = path.join(qrCodeDir, `${certificateCode}.png`);
    const verificationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-certificate/${certificateCode}`;
    
    await QRCode.toFile(qrCodePath, verificationUrl, {
      errorCorrectionLevel: 'H',
      type: 'png',
      width: 300
    });

    const qrCodeUrl = `/certificates/qrcodes/${certificateCode}.png`;

    // Créer le certificat avec certificate_code et qr_code_url
    const insertQuery = `
      INSERT INTO certificates (
        user_id, course_id, certificate_code, certificate_number, 
        qr_code_url, issued_at, is_valid
      )
      VALUES (?, ?, ?, ?, ?, NOW(), TRUE)
    `;
    const [result] = await pool.execute(insertQuery, [
      userId, 
      courseId, 
      certificateCode,
      certificateNumber,
      qrCodeUrl
    ]);

    const insertedCertificateId = result.insertId;

    // Récupérer infos utilisateur et cours pour activité/notification
    try {
      const [[userRow = {}] = []] = await pool.execute(
        'SELECT first_name, last_name FROM users WHERE id = ? LIMIT 1',
        [userId]
      );
      const [[courseRow = {}] = []] = await pool.execute(
        'SELECT title FROM courses WHERE id = ? LIMIT 1',
        [courseId]
      );

      // Enregistrer l'activité "certificat obtenu"
      try {
        const { recordActivity } = require('./gamificationController');
        await recordActivity(
          userId,
          'certificate_issued',
          0,
          `Certificat obtenu pour "${courseRow.title || 'Votre formation'}"`,
          {
            certificateId: insertedCertificateId,
            certificateCode,
            certificateNumber,
            courseId,
            courseTitle: courseRow.title || 'Votre formation',
            user: {
              first_name: userRow.first_name || null,
              last_name: userRow.last_name || null
            }
          }
        );
      } catch (activityError) {
        console.error('Erreur activité (certificate_issued):', activityError);
      }

      // Créer une notification pour l'étudiant
      try {
        await pool.execute(
          `INSERT INTO notifications (user_id, title, message, type, is_read, action_url, metadata)
           VALUES (?, ?, ?, ?, FALSE, ?, ?)`,
          [
            userId,
            '🎓 Certificat obtenu',
            `Votre certificat pour "${courseRow.title || 'votre formation'}" est disponible.`,
            'certificate_issued',
            '/dashboard/student/certificates',
            JSON.stringify({
              certificateId: insertedCertificateId,
              certificateCode,
              certificateNumber,
              courseId,
              courseTitle: courseRow.title || 'Votre formation'
            })
          ]
        );
      } catch (notifError) {
        console.error('Erreur notification (certificate_issued):', notifError);
      }
    } catch (metaError) {
      console.error('Erreur récupération métadonnées certificat:', metaError);
    }

    return insertedCertificateId;

  } catch (error) {
    console.error('Erreur lors de la génération du certificat:', error);
    throw error;
  }
};

// Récupérer tous les certificats (admin seulement)
const getAllCertificates = async (req, res) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const { 
      page = 1, 
      limit = 20, 
      status, 
      search,
      period,
      courseId,
      userId
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    let whereClause = 'WHERE 1=1';
    const params = [];

    // Filtre par statut
    if (status) {
      if (status === 'valid') {
        whereClause += ' AND c.is_valid = TRUE AND (c.expires_at IS NULL OR c.expires_at > NOW()) AND c.revoked_at IS NULL';
      } else if (status === 'revoked') {
        whereClause += ' AND c.revoked_at IS NOT NULL';
      } else if (status === 'expired') {
        whereClause += ' AND c.expires_at IS NOT NULL AND c.expires_at <= NOW()';
      } else if (status === 'pending') {
        // Certificats liés à des demandes en attente
        whereClause += ' AND cr.status = "pending"';
      }
    }

    // Recherche
    if (search) {
      whereClause += ` AND (
        u.first_name LIKE ? OR 
        u.last_name LIKE ? OR 
        u.email LIKE ? OR 
        co.title LIKE ? OR 
        c.certificate_code LIKE ? OR 
        c.certificate_number LIKE ?
      )`;
      const searchPattern = `%${search}%`;
      params.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }

    // Filtre par période
    if (period) {
      const now = new Date();
      let startDate;
      if (period === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      } else if (period === '7days') {
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (period === '30days') {
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }
      if (startDate) {
        whereClause += ' AND c.issued_at >= ?';
        params.push(startDate.toISOString().slice(0, 19).replace('T', ' '));
      }
    }

    // Filtre par cours
    if (courseId) {
      whereClause += ' AND c.course_id = ?';
      params.push(courseId);
    }

    // Filtre par utilisateur
    if (userId) {
      whereClause += ' AND c.user_id = ?';
      params.push(userId);
    }

    // Requête principale
    const query = `
      SELECT 
        c.*,
        co.title as course_title,
        co.description as course_description,
        u.id as user_id,
        u.first_name,
        u.last_name,
        u.email,
        cr.status as request_status,
        CASE 
          WHEN c.revoked_at IS NOT NULL THEN 'revoked'
          WHEN c.expires_at IS NOT NULL AND c.expires_at <= NOW() THEN 'expired'
          WHEN c.is_valid = FALSE THEN 'invalid'
          ELSE 'valid'
        END as certificate_status
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN certificate_requests cr ON c.request_id = cr.id
      ${whereClause}
      ORDER BY c.issued_at DESC
      LIMIT ? OFFSET ?
    `;

    const [certificates] = await pool.execute(query, [...params, parseInt(limit), offset]);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM certificates c
      JOIN courses co ON c.course_id = co.id
      JOIN users u ON c.user_id = u.id
      LEFT JOIN certificate_requests cr ON c.request_id = cr.id
      ${whereClause}
    `;
    const [countResult] = await pool.execute(countQuery, params);
    const total = countResult[0].total;

    // Statistiques
    const [statsResult] = await pool.execute(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN c.revoked_at IS NOT NULL THEN 1 ELSE 0 END) as revoked,
        SUM(CASE WHEN c.expires_at IS NOT NULL AND c.expires_at <= NOW() THEN 1 ELSE 0 END) as expired,
        SUM(CASE WHEN c.is_valid = TRUE AND (c.expires_at IS NULL OR c.expires_at > NOW()) AND c.revoked_at IS NULL THEN 1 ELSE 0 END) as valid,
        SUM(CASE WHEN cr.status = 'pending' THEN 1 ELSE 0 END) as pending
      FROM certificates c
      LEFT JOIN certificate_requests cr ON c.request_id = cr.id
    `);

    const stats = statsResult[0] || {};

    res.json({
      success: true,
      data: {
        certificates: certificates.map(cert => ({
          id: cert.id,
          certificate_code: cert.certificate_code,
          certificate_number: cert.certificate_number,
          user: {
            id: cert.user_id,
            first_name: cert.first_name,
            last_name: cert.last_name,
            email: cert.email,
            full_name: `${cert.first_name} ${cert.last_name}`
          },
          course: {
            id: cert.course_id,
            title: cert.course_title,
            description: cert.course_description
          },
          status: cert.certificate_status,
          request_status: cert.request_status,
          issued_at: cert.issued_at,
          expires_at: cert.expires_at,
          verified: Boolean(cert.verified),
          is_valid: Boolean(cert.is_valid),
          revoked_at: cert.revoked_at,
          revoked_reason: cert.revoked_reason,
          pdf_url: cert.pdf_url,
          qr_code_url: cert.qr_code_url
        })),
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: Number(total),
          pages: Math.ceil(total / parseInt(limit))
        },
        statistics: {
          total: Number(stats.total || 0),
          valid: Number(stats.valid || 0),
          revoked: Number(stats.revoked || 0),
          expired: Number(stats.expired || 0),
          pending: Number(stats.pending || 0)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des certificats:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des certificats'
    });
  }
};

// Révocation d'un certificat (admin seulement)
const revokeCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { reason } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès non autorisé'
      });
    }

    const query = `
      UPDATE certificates 
      SET is_valid = FALSE, revoked_at = NOW(), revoked_reason = ?
      WHERE id = ?
    `;
    await pool.execute(query, [reason, certificateId]);

    res.json({
      success: true,
      message: 'Certificat révoqué avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la révocation du certificat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la révocation du certificat'
    });
  }
};

module.exports = {
  getMyCertificates,
  getAllCertificates,
  getCertificateById,
  verifyCertificate,
  downloadCertificate,
  generateCertificateForCourse: generateCertificateForCourseHTTP,
  generateCertificateForCourseInternal: generateCertificateForCourse,
  revokeCertificate
};
