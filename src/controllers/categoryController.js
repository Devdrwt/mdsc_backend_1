const { pool } = require('../config/database');

// Récupérer toutes les catégories
const getAllCategories = async (req, res) => {
  try {
    const query = `
      SELECT 
        c.*,
        COUNT(co.id) as courses_count
      FROM categories c
      LEFT JOIN courses co ON c.id = co.category_id AND co.is_published = TRUE
      WHERE c.is_active = TRUE
      GROUP BY c.id
      ORDER BY c.name ASC
    `;

    const [categories] = await pool.execute(query);

    res.json({
      success: true,
      data: categories.map(category => ({
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        is_active: category.is_active,
        created_at: category.created_at,
        updated_at: category.updated_at,
        courses_count: category.courses_count
      }))
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des catégories:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des catégories'
    });
  }
};

// Récupérer une catégorie spécifique
const getCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT 
        c.*,
        COUNT(co.id) as courses_count
      FROM categories c
      LEFT JOIN courses co ON c.id = co.category_id AND co.is_published = TRUE
      WHERE c.id = ?
      GROUP BY c.id
    `;

    const [categories] = await pool.execute(query, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    const category = categories[0];

    res.json({
      success: true,
      data: {
        id: category.id,
        name: category.name,
        description: category.description,
        color: category.color,
        icon: category.icon,
        is_active: category.is_active,
        created_at: category.created_at,
        courses_count: category.courses_count
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la catégorie'
    });
  }
};

// Créer une catégorie (admin seulement)
const createCategory = async (req, res) => {
  try {
    const { name, description, color, icon } = req.body;

    // Vérifier que le nom n'est pas déjà utilisé
    const existingQuery = 'SELECT id FROM categories WHERE name = ?';
    const [existing] = await pool.execute(existingQuery, [name]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Une catégorie avec ce nom existe déjà'
      });
    }

    // Insérer la catégorie
    const insertQuery = `
      INSERT INTO categories (name, description, color, icon, is_active, created_at)
      VALUES (?, ?, ?, ?, TRUE, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [name, description, color, icon]);

    res.status(201).json({
      success: true,
      message: 'Catégorie créée avec succès',
      data: {
        id: result.insertId,
        name,
        description,
        color,
        icon
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création de la catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la catégorie'
    });
  }
};

// Modifier une catégorie (admin seulement)
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, color, icon, is_active } = req.body;

    // Vérifier que la catégorie existe
    const categoryQuery = 'SELECT id FROM categories WHERE id = ?';
    const [categories] = await pool.execute(categoryQuery, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // Vérifier que le nom n'est pas déjà utilisé par une autre catégorie
    if (name) {
      const existingQuery = 'SELECT id FROM categories WHERE name = ? AND id != ?';
      const [existing] = await pool.execute(existingQuery, [name, id]);

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Une catégorie avec ce nom existe déjà'
        });
      }
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];

    if (name !== undefined) {
      updates.push('name = ?');
      values.push(name);
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(description);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);

    const updateQuery = `UPDATE categories SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, values);

    res.json({
      success: true,
      message: 'Catégorie mise à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de la catégorie'
    });
  }
};

// Supprimer une catégorie (admin seulement)
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la catégorie existe
    const categoryQuery = 'SELECT id FROM categories WHERE id = ?';
    const [categories] = await pool.execute(categoryQuery, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    // Vérifier qu'aucun cours n'utilise cette catégorie
    const coursesQuery = 'SELECT COUNT(*) as count FROM courses WHERE category_id = ?';
    const [courses] = await pool.execute(coursesQuery, [id]);

    if (courses[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer cette catégorie car elle est utilisée par des cours'
      });
    }

    // Supprimer la catégorie
    await pool.execute('DELETE FROM categories WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Catégorie supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la catégorie:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la catégorie'
    });
  }
};

// Activer/Désactiver une catégorie (admin seulement)
const toggleCategoryStatus = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que la catégorie existe
    const categoryQuery = 'SELECT id, is_active FROM categories WHERE id = ?';
    const [categories] = await pool.execute(categoryQuery, [id]);

    if (categories.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Catégorie non trouvée'
      });
    }

    const newStatus = !categories[0].is_active;

    // Mettre à jour le statut
    await pool.execute(
      'UPDATE categories SET is_active = ? WHERE id = ?',
      [newStatus, id]
    );

    res.json({
      success: true,
      message: `Catégorie ${newStatus ? 'activée' : 'désactivée'} avec succès`,
      data: {
        id: parseInt(id),
        is_active: newStatus
      }
    });

  } catch (error) {
    console.error('Erreur lors du changement de statut:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de statut'
    });
  }
};

module.exports = {
  getAllCategories,
  getCategory,
  createCategory,
  updateCategory,
  deleteCategory,
  toggleCategoryStatus
};
