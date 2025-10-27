const { pool } = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

// Récupérer mes certificats
const getMyCertificates = async (req, res) => {
  try {
    const userId = req.user.id;
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
    const userId = req.user.id;

    const query = `
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
      WHERE c.id = ? AND c.user_id = ?
    `;

    const [certificates] = await pool.execute(query, [certificateId, userId]);

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

// Télécharger un certificat PDF
const downloadCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const userId = req.user.id;

    // Récupérer les informations du certificat
    const query = `
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
      WHERE c.id = ? AND c.user_id = ? AND c.is_valid = TRUE
    `;

    const [certificates] = await pool.execute(query, [certificateId, userId]);

    if (certificates.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Certificat non trouvé ou invalide'
      });
    }

    const certificate = certificates[0];

    // Vérifier si le PDF existe déjà
    if (certificate.pdf_url && fs.existsSync(certificate.pdf_url)) {
      return res.download(certificate.pdf_url, `certificat-${certificate.certificate_number}.pdf`);
    }

    // Générer le PDF
    const pdfPath = await generateCertificatePDF(certificate);
    
    // Mettre à jour l'URL du PDF dans la base de données
    await pool.execute(
      'UPDATE certificates SET pdf_url = ? WHERE id = ?',
      [pdfPath, certificateId]
    );

    res.download(pdfPath, `certificat-${certificate.certificate_number}.pdf`);

  } catch (error) {
    console.error('Erreur lors du téléchargement du certificat:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du téléchargement du certificat'
    });
  }
};

// Générer un certificat PDF
const generateCertificatePDF = async (certificate) => {
  return new Promise((resolve, reject) => {
    try {
      // Créer le dossier certificates s'il n'existe pas
      const certificatesDir = path.join(__dirname, '../../certificates');
      if (!fs.existsSync(certificatesDir)) {
        fs.mkdirSync(certificatesDir, { recursive: true });
      }

      const fileName = `certificate-${certificate.certificate_number}.pdf`;
      const filePath = path.join(certificatesDir, fileName);

      // Créer le document PDF
      const doc = new PDFDocument({
        size: 'A4',
        layout: 'landscape',
        margin: 50
      });

      // Pipe vers le fichier
      const stream = fs.createWriteStream(filePath);
      doc.pipe(stream);

      // Couleurs MdSC
      const primaryColor = '#007bff';
      const secondaryColor = '#28a745';
      const textColor = '#333333';

      // Fond dégradé (simulé avec des rectangles)
      doc.rect(0, 0, doc.page.width, doc.page.height)
         .fill('#f8f9fa');

      // Bordure décorative
      doc.rect(30, 30, doc.page.width - 60, doc.page.height - 60)
         .stroke(primaryColor, 3);

      // Logo/En-tête MdSC
      doc.fontSize(24)
         .fill(primaryColor)
         .text('MAISON DE LA SOCIÉTÉ CIVILE', 50, 80, { align: 'center' });

      doc.fontSize(16)
         .fill(secondaryColor)
         .text('CERTIFICAT DE FORMATION', 50, 120, { align: 'center' });

      // Texte principal
      doc.fontSize(18)
         .fill(textColor)
         .text('Ceci certifie que', 50, 180, { align: 'center' });

      // Nom de l'utilisateur
      doc.fontSize(28)
         .fill(primaryColor)
         .text(`${certificate.first_name} ${certificate.last_name}`, 50, 220, { align: 'center' });

      doc.fontSize(16)
         .fill(textColor)
         .text('a suivi avec succès la formation', 50, 260, { align: 'center' });

      // Titre du cours
      doc.fontSize(22)
         .fill(primaryColor)
         .text(`"${certificate.course_title}"`, 50, 300, { align: 'center' });

      // Durée et date
      const issuedDate = new Date(certificate.issued_at).toLocaleDateString('fr-FR', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });

      doc.fontSize(14)
         .fill(textColor)
         .text(`Durée: ${certificate.duration_minutes} minutes`, 50, 360, { align: 'center' })
         .text(`Délivré le: ${issuedDate}`, 50, 380, { align: 'center' });

      // Numéro de certificat
      doc.fontSize(12)
         .fill('#666666')
         .text(`N° de certificat: ${certificate.certificate_number}`, 50, 420, { align: 'center' });

      // Signature
      doc.fontSize(14)
         .fill(textColor)
         .text('Directeur de la Formation', 50, 480, { align: 'right' });

      // Ligne de signature
      doc.moveTo(doc.page.width - 200, 500)
         .lineTo(doc.page.width - 50, 500)
         .stroke(textColor, 1);

      // Pied de page
      doc.fontSize(10)
         .fill('#666666')
         .text('Ce certificat est délivré électroniquement et peut être vérifié en ligne', 50, 520, { align: 'center' });

      // Finaliser le PDF
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

// Générer automatiquement un certificat (appelé quand un cours est complété)
const generateCertificateForCourse = async (userId, courseId) => {
  try {
    // Vérifier que l'utilisateur a complété le cours
    const enrollmentQuery = `
      SELECT * FROM enrollments 
      WHERE user_id = ? AND course_id = ? AND completed_at IS NOT NULL
    `;
    const [enrollments] = await pool.execute(enrollmentQuery, [userId, courseId]);

    if (enrollments.length === 0) {
      throw new Error('Cours non complété');
    }

    // Vérifier qu'un certificat n'existe pas déjà
    const existingCertQuery = `
      SELECT id FROM certificates 
      WHERE user_id = ? AND course_id = ? AND is_valid = TRUE
    `;
    const [existingCerts] = await pool.execute(existingCertQuery, [userId, courseId]);

    if (existingCerts.length > 0) {
      return existingCerts[0].id; // Retourner l'ID du certificat existant
    }

    // Générer un numéro de certificat unique
    const certificateNumber = `MDSC-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Créer le certificat
    const insertQuery = `
      INSERT INTO certificates (user_id, course_id, certificate_number, issued_at)
      VALUES (?, ?, ?, NOW())
    `;
    const [result] = await pool.execute(insertQuery, [userId, courseId, certificateNumber]);

    return result.insertId;

  } catch (error) {
    console.error('Erreur lors de la génération du certificat:', error);
    throw error;
  }
};

// Révocation d'un certificat (admin seulement)
const revokeCertificate = async (req, res) => {
  try {
    const { certificateId } = req.params;
    const { reason } = req.body;
    const adminId = req.user.id;

    // Vérifier que l'utilisateur est admin
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
  getCertificateById,
  downloadCertificate,
  generateCertificateForCourse,
  revokeCertificate
};
