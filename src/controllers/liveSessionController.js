const { pool } = require('../config/database');
const { sanitizeValue, convertToMySQLDateTime } = require('../utils/sanitize');
const JitsiService = require('../services/jitsiService');

/**
 * POST /api/courses/:courseId/live-sessions
 * Créer une session live pour un cours
 */
const createSession = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { title, description, scheduled_start_at, scheduled_end_at, max_participants, is_recording_enabled } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Validation
    if (!title || !scheduled_start_at || !scheduled_end_at) {
      return res.status(400).json({
        success: false,
        error: 'Le titre et les dates sont requis'
      });
    }

    const startDate = new Date(scheduled_start_at);
    const endDate = new Date(scheduled_end_at);

    if (startDate >= endDate) {
      return res.status(400).json({
        success: false,
        error: 'La date de fin doit être après la date de début'
      });
    }

    // Vérifier que l'utilisateur est l'instructeur du cours
    const [courses] = await pool.execute(
      'SELECT id, instructor_id, course_type FROM courses WHERE id = ?',
      [courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Cours non trouvé'
      });
    }

    const course = courses[0];

    if (course.instructor_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à créer une session pour ce cours'
      });
    }

    // Vérifier si une session existe déjà pour ce cours (éviter les doublons)
    const [existingSessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE course_id = ? ORDER BY created_at DESC LIMIT 1',
      [courseId]
    );

    if (existingSessions.length > 0) {
      // Une session existe déjà, retourner la session existante au lieu d'en créer une nouvelle
      console.log(`ℹ️ [LiveSession] Session existante trouvée pour le cours ${courseId} (session ID: ${existingSessions[0].id})`);
      return res.status(200).json({
        success: true,
        message: 'Une session existe déjà pour ce cours',
        data: existingSessions[0],
        is_existing: true
      });
    }

    // Générer le nom de salle Jitsi (temporaire, sera mis à jour avec l'ID de session)
    const tempSessionId = Date.now();
    const jitsiRoomName = JitsiService.generateRoomName(courseId, tempSessionId);
    const jitsiRoomPassword = JitsiService.generateRoomPassword();

    // Créer la session
    const [result] = await pool.execute(
      `INSERT INTO live_sessions (
        course_id, instructor_id, title, description,
        scheduled_start_at, scheduled_end_at,
        jitsi_room_name, jitsi_server_url, jitsi_room_password,
        max_participants, is_recording_enabled, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        courseId,
        userId,
        sanitizeValue(title),
        sanitizeValue(description),
        convertToMySQLDateTime(scheduled_start_at),
        convertToMySQLDateTime(scheduled_end_at),
        jitsiRoomName,
        process.env.JITSI_SERVER_URL || 'https://meet.jit.si',
        jitsiRoomPassword,
        max_participants || 50,
        is_recording_enabled ? 1 : 0
      ]
    );

    const sessionId = result.insertId;

    // Mettre à jour le nom de salle avec le vrai sessionId
    const finalRoomName = JitsiService.generateRoomName(courseId, sessionId);
    await pool.execute(
      'UPDATE live_sessions SET jitsi_room_name = ? WHERE id = ?',
      [finalRoomName, sessionId]
    );

    // Récupérer la session créée
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    res.status(201).json({
      success: true,
      message: 'Session live créée avec succès',
      data: sessions[0]
    });

  } catch (error) {
    console.error('Erreur lors de la création de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/courses/:courseId/live-sessions
 * Récupérer toutes les sessions d'un cours
 */
const getCourseSessions = async (req, res) => {
  try {
    const { courseId } = req.params;
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [sessions] = await pool.execute(
      `SELECT 
        ls.*,
        COUNT(DISTINCT lsp.id) as participants_count
       FROM live_sessions ls
       LEFT JOIN live_session_participants lsp ON ls.id = lsp.session_id
       WHERE ls.course_id = ?
       GROUP BY ls.id
       ORDER BY ls.scheduled_start_at DESC
       LIMIT ? OFFSET ?`,
      [courseId, parseInt(limit), offset]
    );

    const [countResult] = await pool.execute(
      'SELECT COUNT(*) as total FROM live_sessions WHERE course_id = ?',
      [courseId]
    );

    res.json({
      success: true,
      data: sessions,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult[0].total),
        pages: Math.ceil(countResult[0].total / limit)
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des sessions:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/live-sessions/:sessionId
 * Récupérer les détails d'une session
 */
const getSessionById = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    const [sessions] = await pool.execute(
      `SELECT 
        ls.*,
        c.title as course_title,
        u.first_name as instructor_first_name,
        u.last_name as instructor_last_name,
        u.email as instructor_email
       FROM live_sessions ls
       JOIN courses c ON ls.course_id = c.id
       JOIN users u ON ls.instructor_id = u.id
       WHERE ls.id = ?`,
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    // Récupérer les participants
    const [participants] = await pool.execute(
      `SELECT 
        lsp.*,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture
       FROM live_session_participants lsp
       JOIN users u ON lsp.user_id = u.id
       WHERE lsp.session_id = ?`,
      [sessionId]
    );

    session.participants = participants;
    session.participants_count = participants.length;

    res.json({
      success: true,
      data: session
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * PUT /api/live-sessions/:sessionId
 * Mettre à jour une session
 */
const updateSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { title, description, scheduled_start_at, scheduled_end_at, max_participants, is_recording_enabled } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur est l'instructeur
    const [sessions] = await pool.execute(
      'SELECT instructor_id, status FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    if (session.instructor_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à modifier cette session'
      });
    }

    if (session.status === 'live' || session.status === 'ended') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de modifier une session en cours ou terminée'
      });
    }

    // Construire la requête de mise à jour
    const updates = [];
    const values = [];

    if (title) {
      updates.push('title = ?');
      values.push(sanitizeValue(title));
    }
    if (description !== undefined) {
      updates.push('description = ?');
      values.push(sanitizeValue(description));
    }
    if (scheduled_start_at) {
      updates.push('scheduled_start_at = ?');
      values.push(convertToMySQLDateTime(scheduled_start_at));
    }
    if (scheduled_end_at) {
      updates.push('scheduled_end_at = ?');
      values.push(convertToMySQLDateTime(scheduled_end_at));
    }
    if (max_participants !== undefined) {
      updates.push('max_participants = ?');
      values.push(max_participants);
    }
    if (is_recording_enabled !== undefined) {
      updates.push('is_recording_enabled = ?');
      values.push(is_recording_enabled ? 1 : 0);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(sessionId);

    await pool.execute(
      `UPDATE live_sessions SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    // Récupérer la session mise à jour
    const [updatedSessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    res.json({
      success: true,
      message: 'Session mise à jour avec succès',
      data: updatedSessions[0]
    });

  } catch (error) {
    console.error('Erreur lors de la mise à jour de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * DELETE /api/live-sessions/:sessionId
 * Supprimer une session
 */
const deleteSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur est l'instructeur
    const [sessions] = await pool.execute(
      'SELECT instructor_id, status FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    if (session.instructor_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Vous n\'êtes pas autorisé à supprimer cette session'
      });
    }

    if (session.status === 'live') {
      return res.status(400).json({
        success: false,
        error: 'Impossible de supprimer une session en cours'
      });
    }

    await pool.execute('DELETE FROM live_sessions WHERE id = ?', [sessionId]);

    res.json({
      success: true,
      message: 'Session supprimée avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/live-sessions/:sessionId/start
 * Démarrer une session (instructeur uniquement)
 */
const startSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur est l'instructeur
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    if (session.instructor_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Seul l\'instructeur peut démarrer la session'
      });
    }

    if (session.status === 'live') {
      return res.status(400).json({
        success: false,
        error: 'La session est déjà en cours'
      });
    }

    // Mettre à jour le statut
    await pool.execute(
      `UPDATE live_sessions 
       SET status = 'live', actual_start_at = NOW() 
       WHERE id = ?`,
      [sessionId]
    );

    // Générer le JWT pour l'instructeur (avec rôle moderator pour les droits de modération)
    const user = req.user;
    const expiresAt = new Date(session.scheduled_end_at);
    const jwt = JitsiService.generateJWT({
      roomName: session.jitsi_room_name,
      userId: userId,
      userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      userEmail: user.email || '',
      role: 'moderator', // Utiliser 'moderator' pour donner les droits de modération
      expiresAt
    });

    const jitsiJoinUrl = JitsiService.generateJoinUrl({
      roomName: session.jitsi_room_name,
      jwt,
      serverUrl: session.jitsi_server_url,
      password: session.jitsi_room_password
    });

    res.json({
      success: true,
      message: 'Session démarrée avec succès',
      data: {
        session_id: sessionId,
        status: 'live',
        actual_start_at: new Date(),
        jitsi_join_url: jitsiJoinUrl
      }
    });

  } catch (error) {
    console.error('Erreur lors du démarrage de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/live-sessions/:sessionId/end
 * Terminer une session (instructeur uniquement)
 */
const endSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { recording_url } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Vérifier que l'utilisateur est l'instructeur
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    if (session.instructor_id !== userId && req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Seul l\'instructeur peut terminer la session'
      });
    }

    if (session.status !== 'live') {
      return res.status(400).json({
        success: false,
        error: 'La session n\'est pas en cours'
      });
    }

    // Mettre à jour le statut
    await pool.execute(
      `UPDATE live_sessions 
       SET status = 'ended', actual_end_at = NOW(), recording_url = ?
       WHERE id = ?`,
      [recording_url || null, sessionId]
    );

    res.json({
      success: true,
      message: 'Session terminée avec succès',
      data: {
        session_id: sessionId,
        status: 'ended',
        actual_end_at: new Date(),
        recording_url: recording_url || null
      }
    });

  } catch (error) {
    console.error('Erreur lors de la fin de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/live-sessions/:sessionId/participants
 * Récupérer les participants d'une session
 */
const getParticipants = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const [participants] = await pool.execute(
      `SELECT 
        lsp.*,
        u.first_name,
        u.last_name,
        u.email,
        u.profile_picture
       FROM live_session_participants lsp
       JOIN users u ON lsp.user_id = u.id
       WHERE lsp.session_id = ?
       ORDER BY lsp.joined_at DESC`,
      [sessionId]
    );

    res.json({
      success: true,
      data: participants
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des participants:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/live-sessions/:sessionId/join
 * Rejoindre une session (étudiant inscrit)
 */
const joinSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { enrollment_id } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Récupérer la session
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    // Vérifier que l'utilisateur est inscrit au cours
    if (enrollment_id) {
      const [enrollments] = await pool.execute(
        'SELECT * FROM enrollments WHERE id = ? AND user_id = ? AND course_id = ?',
        [enrollment_id, userId, session.course_id]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Vous devez être inscrit au cours pour rejoindre la session'
        });
      }
    } else {
      // Vérifier l'inscription sans enrollment_id
      const [enrollments] = await pool.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
        [userId, session.course_id]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Vous devez être inscrit au cours pour rejoindre la session'
        });
      }
    }

    // Vérifier le nombre de participants
    const [participantsCount] = await pool.execute(
      'SELECT COUNT(*) as count FROM live_session_participants WHERE session_id = ? AND is_present = TRUE',
      [sessionId]
    );

    if (participantsCount[0].count >= session.max_participants) {
      return res.status(400).json({
        success: false,
        error: 'La session est complète'
      });
    }

    // Vérifier si l'utilisateur a déjà rejoint
    const [existing] = await pool.execute(
      'SELECT * FROM live_session_participants WHERE session_id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if (existing.length > 0) {
      // Mettre à jour
      await pool.execute(
        `UPDATE live_session_participants 
         SET joined_at = NOW(), is_present = TRUE, left_at = NULL
         WHERE session_id = ? AND user_id = ?`,
        [sessionId, userId]
      );
    } else {
      // Créer
      await pool.execute(
        `INSERT INTO live_session_participants 
         (session_id, user_id, enrollment_id, joined_at, is_present, role)
         VALUES (?, ?, ?, NOW(), TRUE, 'participant')`,
        [sessionId, userId, enrollment_id || null]
      );
    }

    // Générer le JWT pour l'utilisateur
    const user = req.user;
    const expiresAt = new Date(session.scheduled_end_at);
    const jwt = JitsiService.generateJWT({
      roomName: session.jitsi_room_name,
      userId: userId,
      userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      userEmail: user.email || '',
      role: session.instructor_id === userId ? 'moderator' : 'participant', // Utiliser 'moderator' pour l'instructeur
      expiresAt
    });

    const jitsiJoinUrl = JitsiService.generateJoinUrl({
      roomName: session.jitsi_room_name,
      jwt,
      serverUrl: session.jitsi_server_url,
      password: session.jitsi_room_password
    });

    res.json({
      success: true,
      message: 'Session rejointe avec succès',
      data: {
        session_id: sessionId,
        user_id: userId,
        jitsi_join_url: jitsiJoinUrl,
        jitsi_room_password: session.jitsi_room_password,
        joined_at: new Date()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la jonction à la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/live-sessions/:sessionId/leave
 * Quitter une session
 */
const leaveSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Récupérer la participation
    const [participants] = await pool.execute(
      'SELECT * FROM live_session_participants WHERE session_id = ? AND user_id = ?',
      [sessionId, userId]
    );

    if (participants.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Participation non trouvée'
      });
    }

    const participant = participants[0];

    // Calculer la durée de présence
    const joinedAt = new Date(participant.joined_at);
    const leftAt = new Date();
    const durationMinutes = Math.floor((leftAt - joinedAt) / (1000 * 60));

    // Mettre à jour
    await pool.execute(
      `UPDATE live_session_participants 
       SET left_at = NOW(), is_present = FALSE, 
           attendance_duration = attendance_duration + ?
       WHERE session_id = ? AND user_id = ?`,
      [durationMinutes, sessionId, userId]
    );

    res.json({
      success: true,
      message: 'Session quittée avec succès',
      data: {
        session_id: sessionId,
        user_id: userId,
        left_at: leftAt,
        attendance_duration: (participant.attendance_duration || 0) + durationMinutes
      }
    });

  } catch (error) {
    console.error('Erreur lors de la sortie de la session:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/student/live-sessions
 * Récupérer les sessions live de l'étudiant connecté
 */
const getStudentSessions = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const now = new Date();

    // Sessions à venir
    const [upcoming] = await pool.execute(
      `SELECT 
        ls.*,
        c.title as course_title,
        lsp.joined_at,
        lsp.is_present
       FROM live_sessions ls
       JOIN courses c ON ls.course_id = c.id
       LEFT JOIN live_session_participants lsp ON ls.id = lsp.session_id AND lsp.user_id = ?
       WHERE ls.scheduled_start_at > ?
         AND ls.status IN ('scheduled', 'live')
         AND EXISTS (
           SELECT 1 FROM enrollments e 
           WHERE e.course_id = ls.course_id AND e.user_id = ?
         )
       ORDER BY ls.scheduled_start_at ASC`,
      [userId, now, userId]
    );

    // Sessions en cours
    const [live] = await pool.execute(
      `SELECT 
        ls.*,
        c.title as course_title,
        lsp.joined_at,
        lsp.is_present
       FROM live_sessions ls
       JOIN courses c ON ls.course_id = c.id
       LEFT JOIN live_session_participants lsp ON ls.id = lsp.session_id AND lsp.user_id = ?
       WHERE ls.status = 'live'
         AND ls.scheduled_start_at <= ?
         AND ls.scheduled_end_at >= ?
         AND EXISTS (
           SELECT 1 FROM enrollments e 
           WHERE e.course_id = ls.course_id AND e.user_id = ?
         )
       ORDER BY ls.scheduled_start_at ASC`,
      [userId, now, now, userId]
    );

    // Sessions passées
    const [past] = await pool.execute(
      `SELECT 
        ls.*,
        c.title as course_title,
        lsp.joined_at,
        lsp.left_at,
        lsp.attendance_duration,
        lsp.is_present
       FROM live_sessions ls
       JOIN courses c ON ls.course_id = c.id
       LEFT JOIN live_session_participants lsp ON ls.id = lsp.session_id AND lsp.user_id = ?
       WHERE ls.scheduled_end_at < ?
         AND EXISTS (
           SELECT 1 FROM enrollments e 
           WHERE e.course_id = ls.course_id AND e.user_id = ?
         )
       ORDER BY ls.scheduled_end_at DESC
       LIMIT 20`,
      [userId, now, userId]
    );

    res.json({
      success: true,
      data: {
        upcoming: upcoming,
        live: live,
        past: past
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des sessions étudiant:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * POST /api/live-sessions/:sessionId/jitsi-token
 * Générer un JWT pour rejoindre Jitsi
 */
const getJitsiToken = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.id ?? req.user?.userId;
    const { role = 'participant' } = req.body;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Récupérer la session
    const [sessions] = await pool.execute(
      'SELECT * FROM live_sessions WHERE id = ?',
      [sessionId]
    );

    if (sessions.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Session non trouvée'
      });
    }

    const session = sessions[0];

    // Vérifier que l'utilisateur est inscrit ou est l'instructeur
    if (session.instructor_id !== userId) {
      const [enrollments] = await pool.execute(
        'SELECT id FROM enrollments WHERE user_id = ? AND course_id = ?',
        [userId, session.course_id]
      );

      if (enrollments.length === 0) {
        return res.status(403).json({
          success: false,
          error: 'Vous devez être inscrit au cours'
        });
      }
    }

    // Déterminer le rôle réel
    let actualRole = role;
    if (session.instructor_id === userId) {
      actualRole = 'moderator'; // Utiliser 'moderator' pour donner les droits de modération à l'instructeur
    }

    // Générer le JWT
    const user = req.user;
    const expiresAt = new Date(session.scheduled_end_at);
    const jwt = JitsiService.generateJWT({
      roomName: session.jitsi_room_name,
      userId: userId,
      userName: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
      userEmail: user.email || '',
      role: actualRole,
      expiresAt
    });

    const jitsiJoinUrl = JitsiService.generateJoinUrl({
      roomName: session.jitsi_room_name,
      jwt,
      serverUrl: session.jitsi_server_url,
      password: session.jitsi_room_password
    });

    res.json({
      success: true,
      data: {
        jwt,
        jitsi_join_url: jitsiJoinUrl,
        expires_at: expiresAt.toISOString()
      }
    });

  } catch (error) {
    console.error('Erreur lors de la génération du JWT:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

/**
 * GET /api/student/calendar/live-sessions
 * Récupérer les sessions live pour le calendrier
 */
const getCalendarSessions = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;
    const { start_date, end_date } = req.query;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    let query = `
      SELECT 
        ls.id,
        ls.title,
        c.title as course_title,
        ls.scheduled_start_at as start,
        ls.scheduled_end_at as end,
        ls.status,
        ls.course_id
      FROM live_sessions ls
      JOIN courses c ON ls.course_id = c.id
      WHERE EXISTS (
        SELECT 1 FROM enrollments e 
        WHERE e.course_id = ls.course_id AND e.user_id = ?
      )
    `;

    const params = [userId];

    if (start_date) {
      query += ` AND ls.scheduled_start_at >= ?`;
      params.push(start_date);
    }

    if (end_date) {
      query += ` AND ls.scheduled_end_at <= ?`;
      params.push(end_date);
    }

    query += ` ORDER BY ls.scheduled_start_at ASC`;

    const [sessions] = await pool.execute(query, params);

    const calendarEvents = sessions.map(session => ({
      id: session.id,
      title: session.title,
      course_title: session.course_title,
      start: session.start,
      end: session.end,
      type: 'live_session',
      url: `/courses/${session.course_id}/live-sessions/${session.id}`,
      status: session.status
    }));

    res.json({
      success: true,
      data: calendarEvents
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des sessions calendrier:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur serveur'
    });
  }
};

module.exports = {
  createSession,
  getCourseSessions,
  getSessionById,
  updateSession,
  deleteSession,
  startSession,
  endSession,
  getParticipants,
  joinSession,
  leaveSession,
  getStudentSessions,
  getJitsiToken,
  getCalendarSessions
};

