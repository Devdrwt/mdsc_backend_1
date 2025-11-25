const { pool } = require('../config/database');
const { sanitizeValue } = require('../utils/sanitize');

/**
 * GET /api/courses/:courseId/forum
 * Récupérer ou créer le forum d'un cours
 */
const getCourseForum = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur est inscrit au cours
    const [enrollments] = await pool.execute(
      'SELECT id FROM enrollments WHERE course_id = ? AND user_id = ?',
      [courseId, userId]
    );

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'Vous devez être inscrit au cours pour accéder au forum'
      });
    }

    // Récupérer ou créer le forum
    let [forums] = await pool.execute(
      'SELECT * FROM forums WHERE course_id = ?',
      [courseId]
    );

    if (forums.length === 0) {
      // Créer le forum automatiquement
      const [courses] = await pool.execute('SELECT title FROM courses WHERE id = ?', [courseId]);
      
      if (courses.length === 0) {
        return res.status(404).json({
          success: false,
          error: 'Cours non trouvé'
        });
      }

      const [result] = await pool.execute(
        `INSERT INTO forums (course_id, name, title, description, is_active)
         VALUES (?, ?, ?, ?, TRUE)`,
        [
          courseId,
          `Forum - ${courses[0].title}`,
          `Forum - ${courses[0].title}`,
          'Forum de discussion pour ce cours'
        ]
      );

      const [newForum] = await pool.execute(
        'SELECT * FROM forums WHERE id = LAST_INSERT_ID()',
        []
      );
      forums = newForum;
    } else {
      forums = forums;
    }

    const forum = forums[0] || forums;

    // Compter les topics et réponses
    const [topicCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM forum_discussions WHERE forum_id = ?',
      [forum.id]
    );

    const [replyCount] = await pool.execute(
      `SELECT COUNT(*) as count FROM forum_replies fr
       JOIN forum_discussions fd ON fr.discussion_id = fd.id
       WHERE fd.forum_id = ?`,
      [forum.id]
    );

    res.json({
      success: true,
      data: {
        ...forum,
        topic_count: parseInt(topicCount[0].count || 0),
        reply_count: parseInt(replyCount[0].count || 0)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du forum:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/forums/:forumId/topics
 * Lister les topics d'un forum
 */
const getForumTopics = async (req, res) => {
  try {
    const { forumId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { page = 1, limit = 20, sort = 'recent', search } = req.query;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    let orderBy = 'fd.created_at DESC';
    if (sort === 'popular') orderBy = 'fd.replies_count DESC, fd.views_count DESC';
    if (sort === 'pinned') orderBy = 'fd.is_pinned DESC, fd.created_at DESC';

    let query = `
      SELECT 
        fd.*,
        u.first_name,
        u.last_name,
        u.profile_picture as avatar,
        lr.first_name as last_reply_first_name,
        lr.last_name as last_reply_last_name
      FROM forum_discussions fd
      JOIN users u ON fd.user_id = u.id
      LEFT JOIN users lr ON fd.last_reply_by = lr.id
      WHERE fd.forum_id = ?
    `;
    const params = [forumId];

    if (search) {
      query += ` AND (fd.title LIKE ? OR fd.content LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ` ORDER BY ${orderBy} LIMIT ? OFFSET ?`;
    params.push(parseInt(limit), offset);

    const [topics] = await pool.execute(query, params);

    const countQuery = search
      ? `SELECT COUNT(*) as total FROM forum_discussions WHERE forum_id = ? AND (title LIKE ? OR content LIKE ?)`
      : `SELECT COUNT(*) as total FROM forum_discussions WHERE forum_id = ?`;

    const countParams = search ? [forumId, `%${search}%`, `%${search}%`] : [forumId];
    const [countResult] = await pool.execute(countQuery, countParams);

    res.json({
      success: true,
      data: topics,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult[0].total),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des topics:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/forums/:forumId/topics
 * Créer un topic
 */
const createTopic = async (req, res) => {
  try {
    const { forumId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { title, content } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!title || !content) {
      return res.status(400).json({
        success: false,
        error: 'Le titre et le contenu sont requis'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO forum_discussions (forum_id, user_id, title, content)
       VALUES (?, ?, ?, ?)`,
      [forumId, userId, sanitizeValue(title), sanitizeValue(content)]
    );

    const [newTopic] = await pool.execute(
      'SELECT * FROM forum_discussions WHERE id = LAST_INSERT_ID()',
      []
    );

    res.status(201).json({
      success: true,
      message: 'Topic créé avec succès',
      data: newTopic[0]
    });

  } catch (error) {
    console.error('Erreur lors de la création du topic:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/topics/:topicId/replies
 * Lister les réponses d'un topic
 */
const getTopicReplies = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { page = 1, limit = 50, sort = 'recent' } = req.query;
    const offset = (page - 1) * limit;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Incrémenter le compteur de vues
    await pool.execute(
      'UPDATE forum_discussions SET views_count = views_count + 1 WHERE id = ?',
      [topicId]
    );

    let orderBy = 'fr.created_at ASC';
    if (sort === 'votes') orderBy = '(fr.upvotes - fr.downvotes) DESC, fr.created_at ASC';

    const [replies] = await pool.execute(
      `SELECT 
        fr.*,
        u.first_name,
        u.last_name,
        u.profile_picture as avatar,
        EXISTS(
          SELECT 1 FROM forum_reactions 
          WHERE reply_id = fr.id AND user_id = ? AND reaction_type = 'upvote'
        ) as has_upvoted,
        EXISTS(
          SELECT 1 FROM forum_reactions 
          WHERE reply_id = fr.id AND user_id = ? AND reaction_type = 'downvote'
        ) as has_downvoted
      FROM forum_replies fr
      JOIN users u ON fr.user_id = u.id
      WHERE fr.discussion_id = ? AND fr.parent_reply_id IS NULL
      ORDER BY ${orderBy}
      LIMIT ? OFFSET ?`,
      [userId, userId, topicId, parseInt(limit), offset]
    );

    // Récupérer les réponses imbriquées pour chaque réponse principale
    for (let reply of replies) {
      const [nestedReplies] = await pool.execute(
        `SELECT 
          fr.*,
          u.first_name,
          u.last_name,
          u.profile_picture as avatar
        FROM forum_replies fr
        JOIN users u ON fr.user_id = u.id
        WHERE fr.parent_reply_id = ?
        ORDER BY fr.created_at ASC`,
        [reply.id]
      );
      reply.replies = nestedReplies;
    }

    res.json({
      success: true,
      data: replies,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: replies.length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des réponses:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/topics/:topicId/replies
 * Créer une réponse
 */
const createReply = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { content, parent_reply_id } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Le contenu est requis'
      });
    }

    const [result] = await pool.execute(
      `INSERT INTO forum_replies (discussion_id, user_id, content, parent_reply_id)
       VALUES (?, ?, ?, ?)`,
      [topicId, userId, sanitizeValue(content), parent_reply_id || null]
    );

    // Mettre à jour le compteur de réponses du topic
    await pool.execute(
      `UPDATE forum_discussions 
       SET replies_count = replies_count + 1,
           last_reply_at = NOW(),
           last_reply_by = ?
       WHERE id = ?`,
      [userId, topicId]
    );

    const [newReply] = await pool.execute(
      'SELECT * FROM forum_replies WHERE id = LAST_INSERT_ID()',
      []
    );

    res.status(201).json({
      success: true,
      message: 'Réponse créée avec succès',
      data: newReply[0]
    });

  } catch (error) {
    console.error('Erreur lors de la création de la réponse:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/replies/:replyId/reactions
 * Ajouter une réaction (upvote/downvote)
 */
const addReaction = async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { reaction_type } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    if (!['upvote', 'downvote'].includes(reaction_type)) {
      return res.status(400).json({
        success: false,
        error: 'Type de réaction invalide'
      });
    }

    // Vérifier si l'utilisateur a déjà réagi
    const [existing] = await pool.execute(
      'SELECT * FROM forum_reactions WHERE reply_id = ? AND user_id = ?',
      [replyId, userId]
    );

    if (existing.length > 0) {
      // Mettre à jour la réaction existante
      await pool.execute(
        'UPDATE forum_reactions SET reaction_type = ? WHERE reply_id = ? AND user_id = ?',
        [reaction_type, replyId, userId]
      );
    } else {
      // Créer une nouvelle réaction
      await pool.execute(
        'INSERT INTO forum_reactions (reply_id, user_id, reaction_type) VALUES (?, ?, ?)',
        [replyId, userId, reaction_type]
      );
    }

    // Mettre à jour les compteurs de votes
    const [upvotes] = await pool.execute(
      'SELECT COUNT(*) as count FROM forum_reactions WHERE reply_id = ? AND reaction_type = ?',
      [replyId, 'upvote']
    );

    const [downvotes] = await pool.execute(
      'SELECT COUNT(*) as count FROM forum_reactions WHERE reply_id = ? AND reaction_type = ?',
      [replyId, 'downvote']
    );

    await pool.execute(
      'UPDATE forum_replies SET upvotes = ?, downvotes = ? WHERE id = ?',
      [parseInt(upvotes[0].count), parseInt(downvotes[0].count), replyId]
    );

    res.json({
      success: true,
      message: 'Réaction ajoutée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'ajout de la réaction:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/replies/:replyId/mark-solution
 * Marquer une réponse comme solution
 */
const markAsSolution = async (req, res) => {
  try {
    const { replyId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Récupérer la réponse et le topic
    const [replies] = await pool.execute(
      `SELECT fr.*, fd.user_id as topic_author_id
       FROM forum_replies fr
       JOIN forum_discussions fd ON fr.discussion_id = fd.id
       WHERE fr.id = ?`,
      [replyId]
    );

    if (replies.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Réponse non trouvée'
      });
    }

    const reply = replies[0];

    // Vérifier que l'utilisateur est l'auteur du topic ou un admin/instructeur
    const userRole = req.user?.role;
    if (reply.topic_author_id !== userId && userRole !== 'admin' && userRole !== 'instructor') {
      return res.status(403).json({
        success: false,
        error: 'Seul l\'auteur du topic peut marquer une solution'
      });
    }

    // Désactiver les autres solutions du topic
    await pool.execute(
      `UPDATE forum_replies 
       SET is_solution = false 
       WHERE discussion_id = ? AND id != ?`,
      [reply.discussion_id, replyId]
    );

    // Marquer cette réponse comme solution
    await pool.execute(
      'UPDATE forum_replies SET is_solution = true WHERE id = ?',
      [replyId]
    );

    res.json({
      success: true,
      message: 'Réponse marquée comme solution'
    });

  } catch (error) {
    console.error('Erreur lors du marquage de la solution:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/topics/:topicId
 * Récupérer un topic par son ID
 */
const getTopicById = async (req, res) => {
  try {
    const { topicId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const [topics] = await pool.execute(
      `SELECT 
        fd.*,
        u.first_name,
        u.last_name,
        u.profile_picture as avatar
      FROM forum_discussions fd
      JOIN users u ON fd.user_id = u.id
      WHERE fd.id = ?`,
      [topicId]
    );

    if (topics.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Topic non trouvé'
      });
    }

    res.json({
      success: true,
      data: topics[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du topic:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

module.exports = {
  getCourseForum,
  getForumTopics,
  createTopic,
  getTopicReplies,
  createReply,
  addReaction,
  markAsSolution,
  getTopicById
};

