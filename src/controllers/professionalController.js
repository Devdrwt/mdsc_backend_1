const { pool } = require('../config/database');

// ========================================
// DOMAINES (Secteurs professionnels)
// ========================================

// Récupérer tous les domaines (compat: map vers categories)
const getAllDomains = async (req, res) => {
  try {
    const { is_active } = req.query;
    const whereClause = is_active !== undefined ? 'WHERE c.is_active = ?' : '';
    const params = is_active !== undefined ? [is_active === 'true' ? 1 : 0] : [];

    // Mapper domains -> categories (nommage legacy côté front)
    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.color,
        c.icon,
        c.is_active,
        COUNT(DISTINCT co.id) as modules_count,
        COUNT(DISTINCT CASE WHEN co.is_published = TRUE THEN co.id END) as published_modules_count
      FROM categories c
      LEFT JOIN courses co ON co.category_id = c.id
      ${whereClause}
      GROUP BY c.id, c.name, c.description, c.color, c.icon, c.is_active
      ORDER BY c.name
    `;

    const [rows] = await pool.execute(query, params);

    res.json({ success: true, data: rows });
    
  } catch (error) {
    console.error('Erreur lors de la récupération des domaines:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des domaines'
    });
  }
};

// Récupérer un domaine par ID (compat: categories)
const getDomainById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.id,
        c.name,
        c.description,
        c.color,
        c.icon,
        c.is_active,
        COUNT(DISTINCT co.id) as modules_count,
        COUNT(DISTINCT CASE WHEN co.is_published = TRUE THEN co.id END) as published_modules_count
      FROM categories c
      LEFT JOIN courses co ON co.category_id = c.id
      WHERE c.id = ?
      GROUP BY c.id, c.name, c.description, c.color, c.icon, c.is_active
    `;

    const [rows] = await pool.execute(query, [id]);

    if (rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domaine non trouvé'
      });
    }

    res.json({ success: true, data: rows[0] });
    
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
      INSERT INTO categories (name, description, icon, color, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, TRUE, NOW(), NOW())
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

const updateDomain = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, icon, color, is_active } = req.body;

    const [existing] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domaine non trouvé'
      });
    }

    const query = `
      UPDATE categories
      SET
        name = COALESCE(?, name),
        description = COALESCE(?, description),
        icon = COALESCE(?, icon),
        color = COALESCE(?, color),
        is_active = COALESCE(?, is_active),
        updated_at = NOW()
      WHERE id = ?
    `;

    await pool.execute(query, [
      name,
      description,
      icon,
      color,
      typeof is_active === 'boolean' ? (is_active ? 1 : 0) : null,
      id
    ]);

    res.json({
      success: true,
      message: 'Domaine mis à jour avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la mise à jour du domaine:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du domaine'
    });
  }
};

const deleteDomain = async (req, res) => {
  try {
    const { id } = req.params;

    const [existing] = await pool.execute(
      'SELECT id FROM categories WHERE id = ? LIMIT 1',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Domaine non trouvé'
      });
    }

    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Domaine supprimé avec succès'
    });
  } catch (error) {
    console.error('Erreur lors de la suppression du domaine:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du domaine'
    });
  }
};

// ========================================
// MODULES (Regroupement de cours)
// ========================================

// Récupérer tous les modules d'un domaine (compat: via courses.category_id)
const getModulesByDomain = async (req, res) => {
  try {
    const { domainId } = req.params;
    const { is_published } = req.query;

    const whereClause = `WHERE co.category_id = ? ${is_published !== undefined ? 'AND co.is_published = ?' : ''}`;
    const params = [domainId, ...(is_published !== undefined ? [is_published === 'true' ? 1 : 0] : [])];

    // Ici on retourne les cours de la catégorie comme "modules" (compat front)
    const query = `
      SELECT 
        co.id,
        co.title,
        co.description,
        co.thumbnail_url,
        co.duration_minutes,
        co.difficulty,
        co.language,
        co.is_published,
        co.created_at,
        COUNT(DISTINCT e.id) as enrollments_count
      FROM courses co
      LEFT JOIN enrollments e ON e.course_id = co.id
      ${whereClause}
      GROUP BY co.id
      ORDER BY co.created_at DESC
    `;

    const [rows] = await pool.execute(query, params);

    res.json({ success: true, data: rows });
    
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
// SÉQUENCES (Structure du contenu) - SUPPRIMÉ
// ========================================
// NOTE: Les tables sequences, contents, mini_controls ont été supprimées
// car elles étaient une fonctionnalité alternative non utilisée.
// Le système utilise maintenant uniquement l'architecture Modules/Lessons.

// Ces fonctions ont été désactivées car les tables correspondantes n'existent plus:
// - sequences
// - sequence_progress  
// - contents
// - mini_controls
// - mini_control_results

module.exports = {
  // Domaines
  getAllDomains,
  getDomainById,
  createDomain,
  updateDomain,
  deleteDomain,
  
  // Modules
  getModulesByDomain,
  getModuleById,
  createModule,
  
  // Séquences - SUPPRIMÉES (tables non utilisées)
  // getCourseSequences,
  // createSequence,
  
  // Contenus - SUPPRIMÉES (tables non utilisées)
  // getSequenceContents,
  // createContent
};
