const { pool } = require('../config/database');

// ========================================
// DOMAINES (Secteurs professionnels)
// ========================================

// Récupérer tous les domaines
const getAllDomains = async (req, res) => {
  try {
    const { is_active } = req.query;
    
    let whereClause = '';
    let params = [];
    
    if (is_active !== undefined) {
      whereClause = 'WHERE is_active = ?';
      params.push(is_active === 'true' ? 1 : 0);
    }
    
    const query = `
      SELECT 
        d.*,
        COUNT(m.id) as modules_count,
        COUNT(CASE WHEN m.is_published = TRUE THEN 1 END) as published_modules_count
      FROM domains d
      LEFT JOIN modules m ON d.id = m.domain_id
      ${whereClause}
      GROUP BY d.id
      ORDER BY d.name
    `;
    
    const [domains] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: domains
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des domaines:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des domaines'
    });
  }
};

// Récupérer un domaine par ID
const getDomainById = async (req, res) => {
  try {
    const { id } = req.params;
    
    const query = `
      SELECT 
        d.*,
        COUNT(m.id) as modules_count,
        COUNT(CASE WHEN m.is_published = TRUE THEN 1 END) as published_modules_count
      FROM domains d
      LEFT JOIN modules m ON d.id = m.domain_id
      WHERE d.id = ?
      GROUP BY d.id
    `;
    
    const [domains] = await pool.execute(query, [id]);
    
    if (domains.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domaine non trouvé'
      });
    }
    
    res.json({
      success: true,
      data: domains[0]
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération du domaine:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du domaine'
    });
  }
};

// Créer un domaine (Admin)
const createDomain = async (req, res) => {
  try {
    const { name, description, icon, color } = req.body;
    
    const query = `
      INSERT INTO domains (name, description, icon, color)
      VALUES (?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [name, description, icon, color]);
    
    res.status(201).json({
      success: true,
      message: 'Domaine créé avec succès',
      data: {
        id: result.insertId
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du domaine:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du domaine'
    });
  }
};

// ========================================
// MODULES (Regroupement de cours)
// ========================================

// Récupérer tous les modules d'un domaine
const getModulesByDomain = async (req, res) => {
  try {
    const { domainId } = req.params;
    const { is_published, difficulty } = req.query;
    
    let whereClause = 'WHERE m.domain_id = ?';
    let params = [domainId];
    
    if (is_published !== undefined) {
      whereClause += ' AND m.is_published = ?';
      params.push(is_published === 'true' ? 1 : 0);
    }
    
    if (difficulty) {
      whereClause += ' AND m.difficulty = ?';
      params.push(difficulty);
    }
    
    const query = `
      SELECT 
        m.*,
        d.name as domain_name,
        d.color as domain_color,
        COUNT(c.id) as courses_count,
        COUNT(CASE WHEN c.is_published = TRUE THEN 1 END) as published_courses_count,
        COUNT(me.id) as enrollments_count
      FROM modules m
      LEFT JOIN domains d ON m.domain_id = d.id
      LEFT JOIN courses c ON m.id = c.module_id
      LEFT JOIN module_enrollments me ON m.id = me.module_id
      ${whereClause}
      GROUP BY m.id
      ORDER BY m.title
    `;
    
    const [modules] = await pool.execute(query, params);
    
    res.json({
      success: true,
      data: modules
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des modules:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des modules'
    });
  }
};

// Récupérer un module par ID avec ses cours
const getModuleById = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Récupérer les informations du module
    const moduleQuery = `
      SELECT 
        m.*,
        d.name as domain_name,
        d.color as domain_color,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name
      FROM modules m
      LEFT JOIN domains d ON m.domain_id = d.id
      LEFT JOIN users u ON m.instructor_id = u.id
      WHERE m.id = ?
    `;
    
    const [modules] = await pool.execute(moduleQuery, [id]);
    
    if (modules.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Module non trouvé'
      });
    }
    
    const module = modules[0];
    
    // Récupérer les cours du module
    const coursesQuery = `
      SELECT 
        c.*,
        COUNT(e.id) as enrollment_count,
        AVG(cr.rating) as average_rating
      FROM courses c
      LEFT JOIN enrollments e ON c.id = e.course_id
      LEFT JOIN course_reviews cr ON c.id = cr.course_id
      WHERE c.module_id = ?
      GROUP BY c.id
      ORDER BY c.created_at
    `;
    
    const [courses] = await pool.execute(coursesQuery, [id]);
    
    // Récupérer l'évaluation du module
    const evaluationQuery = `
      SELECT * FROM module_evaluations 
      WHERE module_id = ? AND is_active = TRUE
    `;
    
    const [evaluations] = await pool.execute(evaluationQuery, [id]);
    
    res.json({
      success: true,
      data: {
        ...module,
        courses,
        evaluation: evaluations[0] || null
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération du module:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du module'
    });
  }
};

// Créer un module (Instructeur/Admin)
const createModule = async (req, res) => {
  try {
    const {
      domain_id,
      title,
      description,
      short_description,
      thumbnail_url,
      duration_hours,
      difficulty,
      language,
      price,
      currency,
      max_students,
      enrollment_deadline,
      module_start_date,
      module_end_date,
      certification_required,
      certification_criteria
    } = req.body;
    
    const instructor_id = req.user.userId;
    
    const query = `
      INSERT INTO modules (
        domain_id, title, description, short_description, thumbnail_url,
        duration_hours, difficulty, language, price, currency,
        max_students, enrollment_deadline, module_start_date, module_end_date,
        certification_required, certification_criteria, instructor_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      domain_id, title, description, short_description, thumbnail_url,
      duration_hours, difficulty, language, price, currency,
      max_students, enrollment_deadline, module_start_date, module_end_date,
      certification_required, certification_criteria, instructor_id
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Module créé avec succès',
      data: {
        id: result.insertId
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du module:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du module'
    });
  }
};

// ========================================
// SÉQUENCES (Structure du contenu)
// ========================================

// Récupérer les séquences d'un cours
const getCourseSequences = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const query = `
      SELECT 
        s.*,
        COUNT(c.id) as contents_count,
        COUNT(mc.id) as mini_controls_count
      FROM sequences s
      LEFT JOIN contents c ON s.id = c.sequence_id
      LEFT JOIN mini_controls mc ON s.id = mc.sequence_id
      WHERE s.course_id = ?
      GROUP BY s.id
      ORDER BY s.sequence_order
    `;
    
    const [sequences] = await pool.execute(query, [courseId]);
    
    res.json({
      success: true,
      data: sequences
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des séquences:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des séquences'
    });
  }
};

// Créer une séquence (Instructeur)
const createSequence = async (req, res) => {
  try {
    const { courseId } = req.params;
    const {
      title,
      description,
      sequence_order,
      estimated_duration_minutes,
      has_mini_control,
      mini_control_points,
      is_required
    } = req.body;
    
    const query = `
      INSERT INTO sequences (
        course_id, title, description, sequence_order,
        estimated_duration_minutes, has_mini_control, mini_control_points, is_required
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      courseId, title, description, sequence_order,
      estimated_duration_minutes, has_mini_control, mini_control_points, is_required
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Séquence créée avec succès',
      data: {
        id: result.insertId
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la création de la séquence:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la séquence'
    });
  }
};

// ========================================
// CONTENUS (PDF, Vidéos, Live)
// ========================================

// Récupérer les contenus d'une séquence
const getSequenceContents = async (req, res) => {
  try {
    const { sequenceId } = req.params;
    
    const query = `
      SELECT * FROM contents 
      WHERE sequence_id = ? 
      ORDER BY content_order
    `;
    
    const [contents] = await pool.execute(query, [sequenceId]);
    
    res.json({
      success: true,
      data: contents
    });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des contenus:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des contenus'
    });
  }
};

// Créer un contenu (Instructeur)
const createContent = async (req, res) => {
  try {
    const { sequenceId } = req.params;
    const {
      title,
      description,
      content_type,
      content_url,
      file_path,
      file_size_bytes,
      mime_type,
      duration_minutes,
      content_order,
      is_downloadable,
      is_required,
      access_level
    } = req.body;
    
    const query = `
      INSERT INTO contents (
        sequence_id, title, description, content_type, content_url,
        file_path, file_size_bytes, mime_type, duration_minutes,
        content_order, is_downloadable, is_required, access_level
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const [result] = await pool.execute(query, [
      sequenceId, title, description, content_type, content_url,
      file_path, file_size_bytes, mime_type, duration_minutes,
      content_order, is_downloadable, is_required, access_level
    ]);
    
    res.status(201).json({
      success: true,
      message: 'Contenu créé avec succès',
      data: {
        id: result.insertId
      }
    });
    
  } catch (error) {
    console.error('Erreur lors de la création du contenu:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du contenu'
    });
  }
};

module.exports = {
  // Domaines
  getAllDomains,
  getDomainById,
  createDomain,
  
  // Modules
  getModulesByDomain,
  getModuleById,
  createModule,
  
  // Séquences
  getCourseSequences,
  createSequence,
  
  // Contenus
  getSequenceContents,
  createContent
};
