const BadgeService = require('../services/badges.service');

/**
 * Contrôleur pour la gestion des badges
 */

// Récupérer tous les badges
const getAllBadges = async (req, res) => {
  try {
    const badges = await BadgeService.getAllBadges();

    res.json({
      success: true,
      data: badges
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des badges:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des badges'
    });
  }
};

// Récupérer un badge par ID
const getBadgeById = async (req, res) => {
  try {
    const { id } = req.params;

    const badge = await BadgeService.getBadgeById(id);

    if (!badge) {
      return res.status(404).json({
        success: false,
        message: 'Badge non trouvé'
      });
    }

    res.json({
      success: true,
      data: badge
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du badge'
    });
  }
};

// Récupérer les badges d'un utilisateur
const getUserBadges = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const badges = await BadgeService.getUserBadges(userId);

    res.json({
      success: true,
      data: badges
    });

  } catch (error) {
    console.error('Erreur lors de la récupération des badges utilisateur:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des badges'
    });
  }
};

// Vérifier l'éligibilité pour un badge
const checkBadgeEligibility = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id ?? req.user?.userId;

    const eligibility = await BadgeService.checkBadgeEligibility(userId, id);

    res.json({
      success: true,
      data: eligibility
    });

  } catch (error) {
    console.error('Erreur lors de la vérification d\'éligibilité:', error);
    
    if (error.message === 'Badge non trouvé') {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification d\'éligibilité'
    });
  }
};

// Attribuer un badge manuellement (Admin uniquement)
const awardBadge = async (req, res) => {
  try {
    const { userId, badgeId } = req.body;

    if (req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Seuls les administrateurs peuvent attribuer des badges manuellement'
      });
    }

    if (!userId || !badgeId) {
      return res.status(400).json({
        success: false,
        message: 'userId et badgeId sont requis'
      });
    }

    const result = await BadgeService.awardBadge(userId, badgeId);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }

    res.json({
      success: true,
      message: result.message
    });

  } catch (error) {
    console.error('Erreur lors de l\'attribution du badge:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'attribution du badge'
    });
  }
};

// Vérifier et attribuer automatiquement les badges éligibles
const checkAndAwardBadges = async (req, res) => {
  try {
    const userId = req.user?.id ?? req.user?.userId;

    const awarded = await BadgeService.checkAndAwardBadges(userId);

    res.json({
      success: true,
      message: `${awarded.length} badge(s) attribué(s)`,
      data: awarded
    });

  } catch (error) {
    console.error('Erreur lors de la vérification des badges:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des badges'
    });
  }
};

module.exports = {
  getAllBadges,
  getBadgeById,
  getUserBadges,
  checkBadgeEligibility,
  awardBadge,
  checkAndAwardBadges
};

