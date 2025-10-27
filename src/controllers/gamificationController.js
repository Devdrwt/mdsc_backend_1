const { pool } = require('../config/database');

// Récupérer le profil gamification de l'utilisateur
const getUserGamificationProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    // Récupérer les points et niveau
    const pointsQuery = `
      SELECT * FROM user_points WHERE user_id = ?
    `;
    const [pointsResult] = await pool.execute(pointsQuery, [userId]);

    // Récupérer les badges
    const badgesQuery = `
      SELECT 
        b.*,
        ub.earned_at,
        ub.points_earned
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `;
    const [badges] = await pool.execute(badgesQuery, [userId]);

    // Récupérer les activités récentes
    const activitiesQuery = `
      SELECT 
        activity_type,
        points_earned,
        description,
        created_at
      FROM user_activities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 10
    `;
    const [activities] = await pool.execute(activitiesQuery, [userId]);

    // Calculer les statistiques
    const statsQuery = `
      SELECT 
        COUNT(DISTINCT activity_type) as activity_types,
        SUM(points_earned) as total_points_earned,
        COUNT(*) as total_activities
      FROM user_activities
      WHERE user_id = ?
    `;
    const [stats] = await pool.execute(statsQuery, [userId]);

    const userPoints = pointsResult[0] || {
      points: 0,
      level: 1,
      total_points_earned: 0
    };

    // Déterminer le niveau suivant
    const nextLevel = getNextLevel(userPoints.level);
    const pointsToNextLevel = nextLevel.points_required - userPoints.points;

    res.json({
      success: true,
      data: {
        points: userPoints,
        badges,
        activities,
        statistics: stats[0],
        next_level: {
          level: nextLevel.level,
          points_required: nextLevel.points_required,
          points_needed: pointsToNextLevel,
          progress_percentage: Math.min(100, (userPoints.points / nextLevel.points_required) * 100)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du profil gamification:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil gamification'
    });
  }
};

// Récupérer le leaderboard
const getLeaderboard = async (req, res) => {
  try {
    const { period = 'all', limit = 50 } = req.query;
    const userId = req.user.userId;

    // Pour l'instant, on ignore le filtrage par période car user_activities n'existe pas
    // TODO: Implémenter le filtrage par période quand user_activities sera créée

    const query = `
      SELECT 
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        COALESCE(up.points, 0) as total_points,
        COALESCE(up.level, 1) as level,
        COUNT(DISTINCT ub.badge_id) as badges_count,
        ROW_NUMBER() OVER (ORDER BY COALESCE(up.points, 0) DESC) as rank
      FROM users u
      LEFT JOIN user_points up ON u.id = up.user_id
      LEFT JOIN user_badges ub ON u.id = ub.user_id
      WHERE u.is_active = TRUE
      GROUP BY u.id, u.first_name, u.last_name, u.email, up.points, up.level
      ORDER BY total_points DESC, badges_count DESC
      LIMIT ?
    `;

    const [leaderboard] = await pool.execute(query, [parseInt(limit)]);

    // Trouver la position de l'utilisateur actuel
    const userRankQuery = `
      SELECT 
        COUNT(*) + 1 as user_rank
      FROM users u
      LEFT JOIN user_points up ON u.id = up.user_id
      WHERE u.is_active = TRUE AND COALESCE(up.points, 0) > (
        SELECT COALESCE(up2.points, 0) 
        FROM user_points up2 
        WHERE up2.user_id = ?
      )
    `;
    const [userRankResult] = await pool.execute(userRankQuery, [userId]);
    const userRank = userRankResult[0].user_rank;

    res.json({
      success: true,
      data: {
        leaderboard,
        user_rank: userRank,
        period,
        total_users: leaderboard.length
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du leaderboard:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du leaderboard',
      error: error.message
    });
  }
};

// Récupérer tous les badges disponibles
const getAllBadges = async (req, res) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT 
        b.*,
        CASE WHEN ub.user_id IS NOT NULL THEN TRUE ELSE FALSE END as is_earned,
        ub.earned_at
      FROM badges b
      LEFT JOIN user_badges ub ON b.id = ub.badge_id AND ub.user_id = ?
      WHERE b.is_active = TRUE
      ORDER BY b.points_required ASC, b.name ASC
    `;

    const [badges] = await pool.execute(query, [userId]);

    res.json({
      success: true,
      data: badges
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des badges:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des badges',
      error: error.message
    });
  }
};

// Récupérer les activités de l'utilisateur
const getUserActivities = async (req, res) => {
  try {
    const userId = req.user.id;
    const { limit = 50, offset = 0 } = req.query;

    const query = `
      SELECT 
        activity_type,
        points_earned,
        description,
        metadata,
        created_at
      FROM user_activities
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    const [activities] = await pool.execute(query, [userId, parseInt(limit), parseInt(offset)]);

    // Compter le total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM user_activities
      WHERE user_id = ?
    `;
    const [countResult] = await pool.execute(countQuery, [userId]);

    res.json({
      success: true,
      data: {
        activities,
        pagination: {
          total: countResult[0].total,
          limit: parseInt(limit),
          offset: parseInt(offset),
          pages: Math.ceil(countResult[0].total / limit)
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des activités:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des activités'
    });
  }
};

// Enregistrer une activité (utilisé en interne)
const recordActivity = async (userId, activityType, pointsEarned, description, metadata = {}) => {
  try {
    const query = `
      INSERT INTO user_activities (user_id, activity_type, points_earned, description, metadata)
      VALUES (?, ?, ?, ?, ?)
    `;

    await pool.execute(query, [userId, activityType, pointsEarned, description, JSON.stringify(metadata)]);

    // Vérifier les badges
    await checkAndAwardBadges(userId);

  } catch (error) {
    console.error('Erreur lors de l\'enregistrement de l\'activité:', error);
  }
};

// Vérifier et attribuer des badges
const checkAndAwardBadges = async (userId) => {
  try {
    // Récupérer tous les badges non encore gagnés
    const badgesQuery = `
      SELECT b.* FROM badges b
      WHERE b.is_active = TRUE
      AND b.id NOT IN (
        SELECT badge_id FROM user_badges WHERE user_id = ?
      )
    `;
    const [badges] = await pool.execute(badgesQuery, [userId]);

    for (const badge of badges) {
      const criteria = JSON.parse(badge.criteria || '{}');
      let shouldAward = false;

      switch (criteria.action) {
        case 'first_login':
          const loginCount = await getUserActivityCount(userId, 'login');
          shouldAward = loginCount >= 1;
          break;

        case 'course_completed':
          const completedCourses = await getUserCompletedCourses(userId);
          shouldAward = completedCourses >= (criteria.count || 1);
          break;

        case 'daily_login':
          const loginStreak = await getUserLoginStreak(userId);
          shouldAward = loginStreak >= (criteria.streak || 7);
          break;

        case 'leaderboard_top':
          const userRank = await getUserLeaderboardRank(userId);
          shouldAward = userRank <= (criteria.position || 10);
          break;

        case 'total_points':
          const userPoints = await getUserTotalPoints(userId);
          shouldAward = userPoints >= (criteria.points || 5000);
          break;

        case 'quiz_perfect':
          const perfectQuizPercentage = await getUserPerfectQuizPercentage(userId);
          shouldAward = perfectQuizPercentage >= (criteria.percentage || 100);
          break;

        case 'forum_posts':
          const forumPosts = await getUserForumPosts(userId);
          shouldAward = forumPosts >= (criteria.count || 10);
          break;
      }

      if (shouldAward) {
        await awardBadgeInternal(userId, badge.id, badge.points_required);
      }
    }

  } catch (error) {
    console.error('Erreur lors de la vérification des badges:', error);
  }
};

// Attribuer un badge
const awardBadgeInternal = async (userId, badgeId, points) => {
  try {
    const query = `
      INSERT INTO user_badges (user_id, badge_id, points_earned)
      VALUES (?, ?, ?)
    `;

    await pool.execute(query, [userId, badgeId, points]);

    // Enregistrer l'activité
    await recordActivity(
      userId,
      'badge_earned',
      points,
      `Badge gagné: ${badgeId}`,
      { badge_id: badgeId }
    );

    // Créer une notification
    await createNotification(
      userId,
      '🏆 Nouveau Badge !',
      `Félicitations ! Vous avez gagné un nouveau badge.`,
      'badge'
    );

  } catch (error) {
    console.error('Erreur lors de l\'attribution du badge:', error);
  }
};

// Fonctions utilitaires pour les critères de badges
const getUserActivityCount = async (userId, activityType) => {
  const query = 'SELECT COUNT(*) as count FROM user_activities WHERE user_id = ? AND activity_type = ?';
  const [result] = await pool.execute(query, [userId, activityType]);
  return result[0].count;
};

const getUserCompletedCourses = async (userId) => {
  const query = 'SELECT COUNT(*) as count FROM enrollments WHERE user_id = ? AND completed_at IS NOT NULL';
  const [result] = await pool.execute(query, [userId]);
  return result[0].count;
};

const getUserLoginStreak = async (userId) => {
  // Logique pour calculer la série de connexions quotidiennes
  const query = `
    SELECT COUNT(*) as streak
    FROM (
      SELECT DATE(created_at) as login_date
      FROM user_activities
      WHERE user_id = ? AND activity_type = 'login'
      GROUP BY DATE(created_at)
      ORDER BY login_date DESC
    ) as daily_logins
  `;
  const [result] = await pool.execute(query, [userId]);
  return result[0].streak;
};

const getUserLeaderboardRank = async (userId) => {
  const query = `
    SELECT COUNT(*) + 1 as rank
    FROM user_points up1
    WHERE up1.points > (
      SELECT COALESCE(up2.points, 0) 
      FROM user_points up2 
      WHERE up2.user_id = ?
    )
  `;
  const [result] = await pool.execute(query, [userId]);
  return result[0].rank;
};

const getUserTotalPoints = async (userId) => {
  const query = 'SELECT COALESCE(points, 0) as points FROM user_points WHERE user_id = ?';
  const [result] = await pool.execute(query, [userId]);
  return result[0].points;
};

const getUserPerfectQuizPercentage = async (userId) => {
  const query = `
    SELECT 
      CASE 
        WHEN COUNT(*) = 0 THEN 0
        ELSE (COUNT(CASE WHEN percentage = 100 THEN 1 END) / COUNT(*)) * 100
      END as perfect_percentage
    FROM quiz_attempts
    WHERE user_id = ? AND completed_at IS NOT NULL
  `;
  const [result] = await pool.execute(query, [userId]);
  return result[0].perfect_percentage;
};

const getUserForumPosts = async (userId) => {
  const query = `
    SELECT COUNT(*) as count
    FROM forum_replies fr
    JOIN forum_discussions fd ON fr.discussion_id = fd.id
    WHERE fr.user_id = ?
  `;
  const [result] = await pool.execute(query, [userId]);
  return result[0].count;
};

const getNextLevel = (currentLevel) => {
  const levels = [
    { level: 1, name: 'Novice', points_required: 0 },
    { level: 2, name: 'Débutant', points_required: 1000 },
    { level: 3, name: 'Intermédiaire', points_required: 3000 },
    { level: 4, name: 'Avancé', points_required: 6000 },
    { level: 5, name: 'Expert', points_required: 10000 }
  ];

  const nextLevel = levels.find(l => l.level > currentLevel);
  return nextLevel || levels[levels.length - 1];
};

const createNotification = async (userId, title, message, type) => {
  try {
    const query = `
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `;
    await pool.execute(query, [userId, title, message, type]);
  } catch (error) {
    console.error('Erreur lors de la création de la notification:', error);
  }
};

// Récupérer la progression d'un utilisateur spécifique
const getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Vérifier que l'utilisateur existe
    const userQuery = `SELECT id, first_name, last_name, email FROM users WHERE id = ?`;
    const [users] = await pool.execute(userQuery, [userId]);
    
    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = users[0];

    // Récupérer les points et niveau
    const pointsQuery = `
      SELECT 
        points,
        level,
        total_points_earned,
        updated_at
      FROM user_points 
      WHERE user_id = ?
    `;
    const [pointsResult] = await pool.execute(pointsQuery, [userId]);

    // Récupérer les badges
    const badgesQuery = `
      SELECT 
        b.id,
        b.name,
        b.description,
        b.icon,
        b.points_required,
        ub.earned_at
      FROM user_badges ub
      JOIN badges b ON ub.badge_id = b.id
      WHERE ub.user_id = ?
      ORDER BY ub.earned_at DESC
    `;
    const [badges] = await pool.execute(badgesQuery, [userId]);

    // Pour l'instant, pas d'activités car la table n'existe pas
    const activities = [];
    const stats = [{
      total_activities: 0,
      total_points_earned: 0,
      activity_types: 0,
      active_days: 0
    }];

    // Récupérer la progression des cours
    const coursesQuery = `
      SELECT 
        c.id,
        c.title,
        c.thumbnail_url,
        e.progress_percentage,
        e.enrolled_at,
        e.completed_at,
        e.is_active
      FROM enrollments e
      JOIN courses c ON e.course_id = c.id
      WHERE e.user_id = ? AND e.is_active = TRUE
      ORDER BY e.enrolled_at DESC
    `;
    const [courses] = await pool.execute(coursesQuery, [userId]);

    // Récupérer les points et niveau
    const points = pointsResult[0]?.points || 0;
    const level = pointsResult[0]?.level || 1;
    const pointsToNextLevel = 100 - (points % 100);

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          name: `${user.first_name} ${user.last_name}`,
          email: user.email
        },
        points: {
          total: points,
          current_level: level,
          points_to_next_level: pointsToNextLevel,
          percentage_to_next_level: ((points % 100) / 100) * 100
        },
        badges: badges.map(badge => ({
          id: badge.id,
          name: badge.name,
          description: badge.description,
          icon: badge.icon,
          points_required: badge.points_required,
          earned_at: badge.earned_at
        })),
        activities: activities.map(activity => ({
          type: activity.activity_type,
          points_earned: activity.points_earned,
          description: activity.description,
          date: activity.created_at
        })),
        courses: courses.map(course => ({
          id: course.id,
          title: course.title,
          thumbnail: course.thumbnail_url,
          progress_percentage: course.progress_percentage,
          enrolled_at: course.enrolled_at,
          completed_at: course.completed_at,
          is_active: course.is_active
        })),
        statistics: {
          total_activities: stats[0]?.total_activities || 0,
          total_points_earned: stats[0]?.total_points_earned || 0,
          activity_types: stats[0]?.activity_types || 0,
          active_days: stats[0]?.active_days || 0,
          courses_enrolled: courses.length,
          courses_completed: courses.filter(c => c.completed_at).length
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la récupération de la progression:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération de la progression',
      error: error.message
    });
  }
};

// Créer un badge personnalisé (instructeur)
const createCustomBadge = async (req, res) => {
  try {
    const { name, description, icon, color, points_required, criteria } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'utilisateur est instructeur
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les instructeurs peuvent créer des badges personnalisés'
      });
    }

    // Vérifier que le nom n'est pas déjà utilisé
    const existingQuery = 'SELECT id FROM badges WHERE name = ?';
    const [existing] = await pool.execute(existingQuery, [name]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un badge avec ce nom existe déjà'
      });
    }

    // Insérer le badge
    const insertQuery = `
      INSERT INTO badges (
        name, description, icon, color, points_required, 
        criteria, is_active, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, TRUE, NOW())
    `;

    const [result] = await pool.execute(insertQuery, [
      name, description, icon, color, points_required,
      JSON.stringify(criteria)
    ]);

    res.status(201).json({
      success: true,
      message: 'Badge personnalisé créé avec succès',
      data: {
        id: result.insertId,
        name,
        description,
        icon,
        color,
        points_required,
        criteria
      }
    });

  } catch (error) {
    console.error('Erreur lors de la création du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du badge'
    });
  }
};

// Modifier un badge personnalisé (instructeur)
const updateCustomBadge = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const { name, description, icon, color, points_required, criteria, is_active } = req.body;
    const instructorId = req.user.userId;

    // Vérifier que l'utilisateur est instructeur
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les instructeurs peuvent modifier des badges'
      });
    }

    // Vérifier que le badge existe
    const badgeQuery = 'SELECT id FROM badges WHERE id = ?';
    const [badges] = await pool.execute(badgeQuery, [badgeId]);

    if (badges.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Badge non trouvé'
      });
    }

    // Vérifier que le nom n'est pas déjà utilisé par un autre badge
    if (name) {
      const existingQuery = 'SELECT id FROM badges WHERE name = ? AND id != ?';
      const [existing] = await pool.execute(existingQuery, [name, badgeId]);

      if (existing.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Un badge avec ce nom existe déjà'
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
    if (icon !== undefined) {
      updates.push('icon = ?');
      values.push(icon);
    }
    if (color !== undefined) {
      updates.push('color = ?');
      values.push(color);
    }
    if (points_required !== undefined) {
      updates.push('points_required = ?');
      values.push(points_required);
    }
    if (criteria !== undefined) {
      updates.push('criteria = ?');
      values.push(JSON.stringify(criteria));
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

    values.push(badgeId);

    const updateQuery = `UPDATE badges SET ${updates.join(', ')} WHERE id = ?`;
    await pool.execute(updateQuery, values);

    res.json({
      success: true,
      message: 'Badge modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la modification du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la modification du badge'
    });
  }
};

// Supprimer un badge personnalisé (instructeur)
const deleteCustomBadge = async (req, res) => {
  try {
    const { badgeId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'utilisateur est instructeur
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les instructeurs peuvent supprimer des badges'
      });
    }

    // Vérifier que le badge existe
    const badgeQuery = 'SELECT id FROM badges WHERE id = ?';
    const [badges] = await pool.execute(badgeQuery, [badgeId]);

    if (badges.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Badge non trouvé'
      });
    }

    // Vérifier qu'aucun utilisateur n'a ce badge
    const userBadgesQuery = 'SELECT COUNT(*) as count FROM user_badges WHERE badge_id = ?';
    const [userBadges] = await pool.execute(userBadgesQuery, [badgeId]);

    if (userBadges[0].count > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer ce badge car des utilisateurs l\'ont déjà obtenu'
      });
    }

    // Supprimer le badge
    await pool.execute('DELETE FROM badges WHERE id = ?', [badgeId]);

    res.json({
      success: true,
      message: 'Badge supprimé avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de la suppression du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression du badge'
    });
  }
};

// Attribuer un badge à un utilisateur (instructeur)
const awardBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.params;
    const instructorId = req.user.userId;

    // Vérifier que l'utilisateur est instructeur
    if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les instructeurs peuvent attribuer des badges'
      });
    }

    // Vérifier que le badge existe
    const badgeQuery = 'SELECT id FROM badges WHERE id = ?';
    const [badges] = await pool.execute(badgeQuery, [badgeId]);

    if (badges.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Badge non trouvé'
      });
    }

    // Vérifier que l'utilisateur existe
    const userQuery = 'SELECT id FROM users WHERE id = ?';
    const [users] = await pool.execute(userQuery, [userId]);

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Vérifier que l'utilisateur n'a pas déjà ce badge
    const existingQuery = 'SELECT id FROM user_badges WHERE user_id = ? AND badge_id = ?';
    const [existing] = await pool.execute(existingQuery, [userId, badgeId]);

    if (existing.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'L\'utilisateur a déjà ce badge'
      });
    }

    // Attribuer le badge
    const insertQuery = `
      INSERT INTO user_badges (user_id, badge_id, awarded_by, awarded_at)
      VALUES (?, ?, ?, NOW())
    `;

    await pool.execute(insertQuery, [userId, badgeId, instructorId]);

    res.json({
      success: true,
      message: 'Badge attribué avec succès'
    });

  } catch (error) {
    console.error('Erreur lors de l\'attribution du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'attribution du badge'
    });
  }
};

module.exports = {
  getUserGamificationProfile,
  getLeaderboard,
  getAllBadges,
  getUserActivities,
  recordActivity,
  createCustomBadge,
  updateCustomBadge,
  deleteCustomBadge,
  awardBadge,
  checkAndAwardBadges,
  getUserProgress
};
