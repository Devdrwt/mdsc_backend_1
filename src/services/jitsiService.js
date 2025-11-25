const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Service pour gérer l'intégration Jitsi Meet
 */
class JitsiService {
  /**
   * Générer un nom de salle Jitsi unique et sécurisé
   * @param {number} courseId - ID du cours
   * @param {number} sessionId - ID de la session
   * @returns {string} - Nom de la salle Jitsi
   */
  static generateRoomName(courseId, sessionId) {
    const prefix = 'mdsc';
    const hash = crypto
      .createHash('sha256')
      .update(`${courseId}-${sessionId}-${Date.now()}`)
      .digest('hex')
      .substring(0, 8);
    
    return `${prefix}-course-${courseId}-session-${sessionId}-${hash}`;
  }

  /**
   * Générer un mot de passe pour la salle (optionnel)
   * @returns {string} - Mot de passe généré
   */
  static generateRoomPassword() {
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Générer un JWT pour Jitsi Meet
   * @param {Object} options - Options pour le JWT
   * @param {string} options.roomName - Nom de la salle
   * @param {number} options.userId - ID de l'utilisateur
   * @param {string} options.userName - Nom de l'utilisateur
   * @param {string} options.userEmail - Email de l'utilisateur
   * @param {string} options.role - Rôle (instructor, participant, moderator)
   * @param {Date} options.expiresAt - Date d'expiration
   * @returns {string} - JWT signé
   */
  static generateJWT({
    roomName,
    userId,
    userName,
    userEmail,
    role = 'participant',
    expiresAt
  }) {
    const JITSI_APP_ID = process.env.JITSI_APP_ID || 'mdsc-app';
    const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || process.env.JWT_SECRET || 'your-secret-key';

    const payload = {
      context: {
        user: {
          id: userId.toString(),
          name: userName,
          email: userEmail,
          avatar: null
        },
        group: roomName
      },
      aud: JITSI_APP_ID,
      iss: JITSI_APP_ID,
      sub: process.env.JITSI_DOMAIN || 'meet.jit.si',
      room: roomName,
      exp: Math.floor(expiresAt.getTime() / 1000),
      nbf: Math.floor(Date.now() / 1000) - 10
    };

    // Ajouter les permissions selon le rôle
    if (role === 'instructor' || role === 'moderator') {
      payload.moderator = true;
      payload.permissions = {
        'audio': true,
        'video': true,
        'screen': true,
        'chat': true
      };
    }

    return jwt.sign(payload, JITSI_APP_SECRET, {
      algorithm: 'HS256'
    });
  }

  /**
   * Générer l'URL de connexion Jitsi avec JWT
   * @param {Object} options - Options pour l'URL
   * @param {string} options.roomName - Nom de la salle
   * @param {string} options.jwt - JWT généré
   * @param {string} options.serverUrl - URL du serveur Jitsi
   * @param {string} options.password - Mot de passe de la salle (optionnel)
   * @returns {string} - URL complète de connexion
   */
  static generateJoinUrl({
    roomName,
    jwt: jwtToken,
    serverUrl = 'https://meet.jit.si',
    password = null
  }) {
    let url = `${serverUrl}/${roomName}`;
    const params = new URLSearchParams();

    if (jwtToken) {
      params.append('jwt', jwtToken);
    }

    if (password) {
      params.append('password', password);
    }

    // Options de configuration
    params.append('config.startWithAudioMuted', 'false');
    params.append('config.startWithVideoMuted', 'false');
    params.append('config.enableWelcomePage', 'false');
    params.append('config.enableClosePage', 'false');

    if (params.toString()) {
      url += `?${params.toString()}`;
    }

    return url;
  }

  /**
   * Vérifier si un JWT Jitsi est valide
   * @param {string} token - JWT à vérifier
   * @returns {Object|null} - Payload décodé ou null si invalide
   */
  static verifyJWT(token) {
    try {
      const JITSI_APP_SECRET = process.env.JITSI_APP_SECRET || process.env.JWT_SECRET || 'your-secret-key';
      return jwt.verify(token, JITSI_APP_SECRET);
    } catch (error) {
      console.error('Erreur vérification JWT Jitsi:', error);
      return null;
    }
  }
}

module.exports = JitsiService;

