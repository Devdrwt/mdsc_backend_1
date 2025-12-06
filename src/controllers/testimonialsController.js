const { pool } = require('../config/database');

/**
 * Récupère la liste des témoignages
 * GET /api/testimonials
 * Query params: limit, order, order_by, includePending (admin seulement)
 */
const getTestimonials = async (req, res) => {
  try {
    const { limit, order = 'asc', order_by = 'display_order', includePending } = req.query;
    const isAdmin = req.user && req.user.role === 'admin';

    // Construire la requête avec JOIN sur courses pour récupérer course_title
    let query = `
      SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
    `;
    const params = [];

    // Filtrer par is_active et status
    // Pour les non-admins : toujours filtrer par is_active = TRUE AND status = 'approved'
    // Pour les admins : par défaut montrer tous les témoignages (y compris pending)
    // sauf si includePending=false est explicitement demandé
    if (!isAdmin) {
      query += ' WHERE t.is_active = TRUE AND t.status = \'approved\'';
    } else if (includePending === 'false') {
      // Admin mais veut uniquement les témoignages approuvés
      query += ' WHERE t.is_active = TRUE AND t.status = \'approved\'';
    }
    // Si admin et includePending n'est pas 'false', on montre tous les témoignages (pas de WHERE)

    // Valider order_by
    const allowedOrderBy = ['display_order', 'created_at', 'id'];
    const orderByField = allowedOrderBy.includes(order_by) ? order_by : 'display_order';

    // Valider order
    const orderDirection = order.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

    // Ajouter le tri (préfixer avec t. pour éviter les ambiguïtés)
    // Pour les admins, trier d'abord par statut (pending en premier) puis par order_by
    if (isAdmin && includePending !== 'false') {
      query += ` ORDER BY 
        CASE t.status 
          WHEN 'pending' THEN 1 
          WHEN 'rejected' THEN 2 
          WHEN 'approved' THEN 3 
          ELSE 4 
        END ASC,
        t.${orderByField} ${orderDirection}, 
        t.id ASC`;
    } else {
      query += ` ORDER BY t.${orderByField} ${orderDirection}, t.id ASC`;
    }

    // Ajouter la limite si spécifiée
    if (limit && !isNaN(parseInt(limit))) {
      query += ' LIMIT ?';
      params.push(parseInt(limit));
    }

    const [testimonials] = await pool.execute(query, params);

    // Formater les données
    const formattedTestimonials = testimonials.map(testimonial => ({
      id: testimonial.id,
      quote: testimonial.quote,
      author: testimonial.author,
      title: testimonial.title || null,
      avatar: testimonial.avatar || null,
      rating: testimonial.rating || 5,
      is_active: Boolean(testimonial.is_active),
      display_order: testimonial.display_order || 0,
      course_id: testimonial.course_id || null,
      course_title: testimonial.course_title || null,
      status: testimonial.status || 'approved',
      user_id: testimonial.user_id || null,
      rejection_reason: testimonial.rejection_reason || null,
      created_at: testimonial.created_at,
      updated_at: testimonial.updated_at
    }));

    res.json({
      success: true,
      data: formattedTestimonials
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des témoignages:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des témoignages'
    });
  }
};

/**
 * Récupère un témoignage spécifique par ID
 * GET /api/testimonials/:id
 */
const getTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const isAdmin = req.user && req.user.role === 'admin';

    let query = `
      SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.id = ?
    `;
    const params = [id];

    // Si l'utilisateur n'est pas admin, filtrer par is_active et status
    if (!isAdmin) {
      query += ' AND t.is_active = TRUE AND t.status = \'approved\'';
    }

    const [testimonials] = await pool.execute(query, params);

    if (testimonials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    const testimonial = testimonials[0];

    res.json({
      success: true,
      data: {
        id: testimonial.id,
        quote: testimonial.quote,
        author: testimonial.author,
        title: testimonial.title || null,
        avatar: testimonial.avatar || null,
        rating: testimonial.rating || 5,
        is_active: Boolean(testimonial.is_active),
        display_order: testimonial.display_order || 0,
        course_id: testimonial.course_id || null,
        course_title: testimonial.course_title || null,
        status: testimonial.status || 'approved',
        user_id: testimonial.user_id || null,
        rejection_reason: testimonial.rejection_reason || null,
        created_at: testimonial.created_at,
        updated_at: testimonial.updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du témoignage'
    });
  }
};

/**
 * Crée un nouveau témoignage
 * POST /api/testimonials
 * Les étudiants peuvent créer des témoignages avec status='pending'
 * Les admins peuvent créer directement avec status='approved'
 */
const createTestimonial = async (req, res) => {
  try {
    const { quote, author, title, avatar, rating, is_active, display_order, course_id, status } = req.body;
    const isAdmin = req.user && req.user.role === 'admin';
    const userId = req.user?.id || req.user?.userId;

    // Validation
    const errors = [];

    if (!quote || typeof quote !== 'string' || quote.trim().length < 20) {
      errors.push({
        field: 'quote',
        message: 'Le texte du témoignage est requis et doit contenir au moins 20 caractères'
      });
    }

    // Pour les étudiants, utiliser leur nom depuis req.user si author n'est pas fourni
    let finalAuthor = author;
    if (!finalAuthor && !isAdmin && req.user) {
      finalAuthor = `${req.user.first_name || ''} ${req.user.last_name || ''}`.trim() || req.user.email;
    }

    if (!finalAuthor || typeof finalAuthor !== 'string' || finalAuthor.trim().length < 2) {
      errors.push({
        field: 'author',
        message: 'Le nom de l\'auteur est requis et doit contenir au moins 2 caractères'
      });
    }

    if (title && typeof title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Le titre doit être une chaîne de caractères'
      });
    }

    if (avatar && (typeof avatar !== 'string' || avatar.length > 2)) {
      errors.push({
        field: 'avatar',
        message: 'L\'avatar doit contenir au maximum 2 caractères'
      });
    }

    if (rating !== undefined && (isNaN(rating) || rating < 1 || rating > 5)) {
      errors.push({
        field: 'rating',
        message: 'La note doit être un nombre entre 1 et 5'
      });
    }

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      errors.push({
        field: 'is_active',
        message: 'is_active doit être un booléen'
      });
    }

    if (display_order !== undefined && (isNaN(display_order) || display_order < 0)) {
      errors.push({
        field: 'display_order',
        message: 'display_order doit être un nombre positif'
      });
    }

    if (course_id !== undefined && course_id !== null) {
      if (isNaN(course_id) || course_id < 1) {
        errors.push({
          field: 'course_id',
          message: 'course_id doit être un nombre positif valide'
        });
      } else {
        // Vérifier que le cours existe
        const [courses] = await pool.execute('SELECT id FROM courses WHERE id = ?', [course_id]);
        if (courses.length === 0) {
          errors.push({
            field: 'course_id',
            message: 'Le cours spécifié n\'existe pas'
          });
        }
      }
    }

    if (status && !['pending', 'approved', 'rejected'].includes(status)) {
      errors.push({
        field: 'status',
        message: 'status doit être pending, approved ou rejected'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    // Déterminer le statut par défaut
    // Les étudiants créent avec status='pending', les admins avec status='approved'
    const finalStatus = status || (isAdmin ? 'approved' : 'pending');

    // Pour les étudiants, remplir automatiquement les champs depuis le profil
    let finalTitle = title;
    let finalAvatar = avatar;
    
    if (!isAdmin && req.user) {
      // Utiliser le titre/fonction de l'utilisateur si disponible
      if (!finalTitle && req.user.organization) {
        finalTitle = req.user.organization;
      }
      // Générer l'avatar depuis les initiales si non fourni
      if (!finalAvatar && finalAuthor) {
        const names = finalAuthor.trim().split(' ');
        if (names.length >= 2) {
          finalAvatar = (names[0][0] + names[names.length - 1][0]).toUpperCase().substring(0, 2);
        } else if (names.length === 1) {
          finalAvatar = names[0].substring(0, 2).toUpperCase();
        }
      }
    }

    // Si display_order n'est pas fourni, utiliser le dernier ordre + 1
    let finalDisplayOrder = display_order;
    if (finalDisplayOrder === undefined) {
      const [maxOrder] = await pool.execute(
        'SELECT COALESCE(MAX(display_order), -1) as max_order FROM testimonials'
      );
      finalDisplayOrder = (maxOrder[0].max_order || 0) + 1;
    }

    // Insérer le témoignage avec user_id
    const insertQuery = `
      INSERT INTO testimonials (quote, author, title, avatar, rating, is_active, display_order, course_id, status, user_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    const finalRating = rating !== undefined ? parseInt(rating) : 5;
    const finalIsActive = is_active !== undefined ? is_active : (isAdmin ? true : false);
    // user_id est NULL pour les admins qui créent manuellement, sinon l'ID de l'utilisateur connecté
    const finalUserId = isAdmin ? null : userId;

    const [result] = await pool.execute(insertQuery, [
      quote.trim(),
      finalAuthor.trim(),
      finalTitle ? finalTitle.trim() : null,
      finalAvatar ? finalAvatar.trim().substring(0, 2) : null,
      finalRating,
      finalIsActive,
      finalDisplayOrder,
      course_id || null,
      finalStatus,
      finalUserId
    ]);

    // Récupérer le témoignage créé avec le titre du cours
    const [newTestimonials] = await pool.execute(
      `SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.id = ?`,
      [result.insertId]
    );

    const newTestimonial = newTestimonials[0];

    res.status(201).json({
      success: true,
      message: isAdmin ? 'Témoignage créé avec succès' : 'Témoignage soumis avec succès. Il sera modéré avant publication.',
      data: {
        id: newTestimonial.id,
        quote: newTestimonial.quote,
        author: newTestimonial.author,
        title: newTestimonial.title || null,
        avatar: newTestimonial.avatar || null,
        rating: newTestimonial.rating || 5,
        is_active: Boolean(newTestimonial.is_active),
        display_order: newTestimonial.display_order || 0,
        course_id: newTestimonial.course_id || null,
        course_title: newTestimonial.course_title || null,
        status: newTestimonial.status || 'approved',
        user_id: newTestimonial.user_id || null,
        rejection_reason: newTestimonial.rejection_reason || null,
        created_at: newTestimonial.created_at,
        updated_at: newTestimonial.updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du témoignage'
    });
  }
};

/**
 * Met à jour un témoignage existant (Admin seulement)
 * PUT /api/testimonials/:id
 */
const updateTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { quote, author, title, avatar, rating, is_active, display_order } = req.body;

    // Vérifier que le témoignage existe
    const [testimonials] = await pool.execute(
      'SELECT * FROM testimonials WHERE id = ?',
      [id]
    );

    if (testimonials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    // Validation des champs fournis
    const errors = [];

    if (quote !== undefined) {
      if (typeof quote !== 'string' || quote.trim().length < 10) {
        errors.push({
          field: 'quote',
          message: 'Le texte du témoignage doit contenir au moins 10 caractères'
        });
      }
    }

    if (author !== undefined) {
      if (typeof author !== 'string' || author.trim().length < 2) {
        errors.push({
          field: 'author',
          message: 'Le nom de l\'auteur doit contenir au moins 2 caractères'
        });
      }
    }

    if (title !== undefined && typeof title !== 'string') {
      errors.push({
        field: 'title',
        message: 'Le titre doit être une chaîne de caractères'
      });
    }

    if (avatar !== undefined && (typeof avatar !== 'string' || avatar.length > 2)) {
      errors.push({
        field: 'avatar',
        message: 'L\'avatar doit contenir au maximum 2 caractères'
      });
    }

    if (rating !== undefined && (isNaN(rating) || rating < 1 || rating > 5)) {
      errors.push({
        field: 'rating',
        message: 'La note doit être un nombre entre 1 et 5'
      });
    }

    if (is_active !== undefined && typeof is_active !== 'boolean') {
      errors.push({
        field: 'is_active',
        message: 'is_active doit être un booléen'
      });
    }

    if (display_order !== undefined && (isNaN(display_order) || display_order < 0)) {
      errors.push({
        field: 'display_order',
        message: 'display_order doit être un nombre positif'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    // Validation de course_id si fourni
    if (course_id !== undefined && course_id !== null) {
      if (isNaN(course_id) || course_id < 1) {
        errors.push({
          field: 'course_id',
          message: 'course_id doit être un nombre positif valide'
        });
      } else {
        // Vérifier que le cours existe
        const [courses] = await pool.execute('SELECT id FROM courses WHERE id = ?', [course_id]);
        if (courses.length === 0) {
          errors.push({
            field: 'course_id',
            message: 'Le cours spécifié n\'existe pas'
          });
        }
      }
    }

    if (status !== undefined && !['pending', 'approved', 'rejected'].includes(status)) {
      errors.push({
        field: 'status',
        message: 'status doit être pending, approved ou rejected'
      });
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors
      });
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];

    if (quote !== undefined) {
      updates.push('quote = ?');
      values.push(quote.trim());
    }
    if (author !== undefined) {
      updates.push('author = ?');
      values.push(author.trim());
    }
    if (title !== undefined) {
      updates.push('title = ?');
      values.push(title ? title.trim() : null);
    }
    if (avatar !== undefined) {
      updates.push('avatar = ?');
      values.push(avatar ? avatar.trim().substring(0, 2) : null);
    }
    if (rating !== undefined) {
      updates.push('rating = ?');
      values.push(parseInt(rating));
    }
    if (is_active !== undefined) {
      updates.push('is_active = ?');
      values.push(is_active);
    }
    if (display_order !== undefined) {
      updates.push('display_order = ?');
      values.push(parseInt(display_order));
    }
    if (course_id !== undefined) {
      updates.push('course_id = ?');
      values.push(course_id || null);
    }
    if (status !== undefined) {
      updates.push('status = ?');
      values.push(status);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);

    const updateQuery = `UPDATE testimonials SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, values);

    // Récupérer le témoignage mis à jour avec le titre du cours
    const [updatedTestimonials] = await pool.execute(
      `SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.id = ?`,
      [id]
    );

    const updatedTestimonial = updatedTestimonials[0];

    res.json({
      success: true,
      message: 'Témoignage mis à jour avec succès',
      data: {
        id: updatedTestimonial.id,
        quote: updatedTestimonial.quote,
        author: updatedTestimonial.author,
        title: updatedTestimonial.title || null,
        avatar: updatedTestimonial.avatar || null,
        rating: updatedTestimonial.rating || 5,
        is_active: Boolean(updatedTestimonial.is_active),
        display_order: updatedTestimonial.display_order || 0,
        course_id: updatedTestimonial.course_id || null,
        course_title: updatedTestimonial.course_title || null,
        status: updatedTestimonial.status || 'approved',
        user_id: updatedTestimonial.user_id || null,
        rejection_reason: updatedTestimonial.rejection_reason || null,
        created_at: updatedTestimonial.created_at,
        updated_at: updatedTestimonial.updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du témoignage'
    });
  }
};

/**
 * Récupère les témoignages de l'utilisateur connecté
 * GET /api/testimonials/my
 */
const getMyTestimonials = async (req, res) => {
  try {
    const userId = req.user?.id || req.user?.userId;
    
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    // Récupérer les témoignages de l'utilisateur par user_id
    const query = `
      SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.user_id = ?
      ORDER BY t.created_at DESC
    `;

    const [testimonials] = await pool.execute(query, [userId]);

    // Formater les données
    const formattedTestimonials = testimonials.map(testimonial => ({
      id: testimonial.id,
      quote: testimonial.quote,
      author: testimonial.author,
      title: testimonial.title || null,
      avatar: testimonial.avatar || null,
      rating: testimonial.rating || 5,
      is_active: Boolean(testimonial.is_active),
      display_order: testimonial.display_order || 0,
      course_id: testimonial.course_id || null,
      course_title: testimonial.course_title || null,
      status: testimonial.status || 'approved',
      user_id: testimonial.user_id || null,
      rejection_reason: testimonial.rejection_reason || null,
      created_at: testimonial.created_at,
      updated_at: testimonial.updated_at
    }));

    res.json({
      success: true,
      data: formattedTestimonials
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des témoignages de l\'utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des témoignages'
    });
  }
};

/**
 * Approuve un témoignage (Admin seulement)
 * POST /api/testimonials/:id/approve
 */
const approveTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le témoignage existe
    const [testimonials] = await pool.execute(
      'SELECT * FROM testimonials WHERE id = ?',
      [id]
    );

    if (testimonials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    // Mettre à jour le statut et is_active
    await pool.execute(
      'UPDATE testimonials SET status = ?, is_active = ?, rejection_reason = NULL WHERE id = ?',
      ['approved', true, id]
    );

    // Récupérer le témoignage mis à jour avec le titre du cours
    const [updatedTestimonials] = await pool.execute(
      `SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.id = ?`,
      [id]
    );

    const updatedTestimonial = updatedTestimonials[0];

    res.json({
      success: true,
      message: 'Témoignage approuvé avec succès',
      data: {
        id: updatedTestimonial.id,
        quote: updatedTestimonial.quote,
        author: updatedTestimonial.author,
        title: updatedTestimonial.title || null,
        avatar: updatedTestimonial.avatar || null,
        rating: updatedTestimonial.rating || 5,
        is_active: Boolean(updatedTestimonial.is_active),
        display_order: updatedTestimonial.display_order || 0,
        course_id: updatedTestimonial.course_id || null,
        course_title: updatedTestimonial.course_title || null,
        status: updatedTestimonial.status || 'approved',
        user_id: updatedTestimonial.user_id || null,
        rejection_reason: updatedTestimonial.rejection_reason || null,
        created_at: updatedTestimonial.created_at,
        updated_at: updatedTestimonial.updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors de l\'approbation du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'approbation du témoignage'
    });
  }
};

/**
 * Rejette un témoignage (Admin seulement)
 * POST /api/testimonials/:id/reject
 */
const rejectTestimonial = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Vérifier que le témoignage existe
    const [testimonials] = await pool.execute(
      'SELECT * FROM testimonials WHERE id = ?',
      [id]
    );

    if (testimonials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    // Mettre à jour le statut, is_active et la raison du rejet
    await pool.execute(
      'UPDATE testimonials SET status = ?, is_active = ?, rejection_reason = ? WHERE id = ?',
      ['rejected', false, reason || null, id]
    );

    // Récupérer le témoignage mis à jour avec le titre du cours
    const [updatedTestimonials] = await pool.execute(
      `SELECT 
        t.*,
        c.title as course_title
      FROM testimonials t
      LEFT JOIN courses c ON t.course_id = c.id
      WHERE t.id = ?`,
      [id]
    );

    const updatedTestimonial = updatedTestimonials[0];

    res.json({
      success: true,
      message: 'Témoignage rejeté',
      data: {
        id: updatedTestimonial.id,
        quote: updatedTestimonial.quote,
        author: updatedTestimonial.author,
        title: updatedTestimonial.title || null,
        avatar: updatedTestimonial.avatar || null,
        rating: updatedTestimonial.rating || 5,
        is_active: Boolean(updatedTestimonial.is_active),
        display_order: updatedTestimonial.display_order || 0,
        course_id: updatedTestimonial.course_id || null,
        course_title: updatedTestimonial.course_title || null,
        status: updatedTestimonial.status || 'rejected',
        user_id: updatedTestimonial.user_id || null,
        rejection_reason: updatedTestimonial.rejection_reason || null,
        created_at: updatedTestimonial.created_at,
        updated_at: updatedTestimonial.updated_at
      }
    });

  } catch (error) {
    console.error('Erreur lors du rejet du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rejet du témoignage'
    });
  }
};

/**
 * Supprime un témoignage (Admin seulement)
 * DELETE /api/testimonials/:id
 */
const deleteTestimonial = async (req, res) => {
  try {
    const { id } = req.params;

    // Vérifier que le témoignage existe
    const [testimonials] = await pool.execute(
      'SELECT id FROM testimonials WHERE id = ?',
      [id]
    );

    if (testimonials.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Témoignage non trouvé'
      });
    }

    // Supprimer le témoignage
    await pool.execute('DELETE FROM testimonials WHERE id = ?', [id]);

    res.json({
      success: true,
      message: 'Témoignage supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du témoignage:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du témoignage'
    });
  }
};

module.exports = {
  getTestimonials,
  getTestimonial,
  getMyTestimonials,
  createTestimonial,
  updateTestimonial,
  approveTestimonial,
  rejectTestimonial,
  deleteTestimonial
};

