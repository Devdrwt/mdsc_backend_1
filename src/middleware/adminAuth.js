const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');
const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Middleware pour vérifier token admin
 * Vérifie que le token est valide et que l'utilisateur est admin
 * Supporte les tokens admin (type: 'admin') et les tokens utilisateur normaux si l'utilisateur est admin
 */
const authenticateAdminToken = async (req, res, next) => {
  // Essayer de récupérer le token depuis plusieurs sources
  let token = null;
  
  // 1. Depuis Authorization header
  const authHeader = req.headers['authorization'];
  if (authHeader) {
    token = authHeader.split(' ')[1];
  }
  
  // 2. Depuis les cookies (si pas trouvé dans header)
  if (!token && req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  
  // 3. Depuis query params (pour développement)
  if (!token && req.query && req.query.token) {
    token = req.query.token;
  }

  if (!token || token === 'undefined' || token.length < 10) {
    console.error('❌ [ADMIN AUTH] Token manquant ou invalide:', {
      hasAuthHeader: !!authHeader,
      hasCookie: !!req.cookies?.token,
      hasQueryToken: !!req.query?.token,
      tokenValue: token ? `${token.substring(0, 20)}...` : 'null'
    });
    return res.status(401).json({
      success: false,
      message: 'Token manquant'
    });
  }

  jwt.verify(token, JWT_SECRET, async (err, decoded) => {
    if (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(403).json({
          success: false,
          message: 'Token expiré'
        });
      }
      console.error('❌ [ADMIN AUTH] Token verification error:', err.message);
      return res.status(403).json({
        success: false,
        message: 'Token invalide'
      });
    }

    console.log('🔍 [ADMIN AUTH] Token decoded:', {
      userId: decoded.userId || decoded.id,
      email: decoded.email,
      role: decoded.role,
      type: decoded.type
    });

    // Si c'est un token admin (avec type: 'admin'), l'accepter directement
    if (decoded.role === 'admin' && decoded.type === 'admin') {
      console.log('✅ [ADMIN AUTH] Token admin valide');
      req.user = decoded;
      return next();
    }

    // Si c'est un token utilisateur normal, vérifier que l'utilisateur est admin dans la DB
    if (decoded.role === 'admin') {
      try {
        const userId = decoded.userId || decoded.id;
        console.log('🔍 [ADMIN AUTH] Vérification en DB pour userId:', userId);
        
        const [users] = await pool.execute(
          'SELECT id, email, role FROM users WHERE id = ? AND role = "admin" AND is_active = TRUE',
          [userId]
        );

        if (users.length > 0) {
          console.log('✅ [ADMIN AUTH] Utilisateur admin confirmé en DB');
          // Accepter le token même s'il n'a pas type: 'admin'
          req.user = {
            ...decoded,
            type: 'admin' // Ajouter le type pour compatibilité
          };
          return next();
        } else {
          console.log('❌ [ADMIN AUTH] Utilisateur non admin en DB');
        }
      } catch (dbError) {
        console.error('❌ [ADMIN AUTH] Database error:', dbError);
      }
    }

    console.log('❌ [ADMIN AUTH] Accès refusé - role:', decoded.role, 'type:', decoded.type);
    return res.status(403).json({
      success: false,
      message: 'Accès admin requis'
    });
  });
};

module.exports = {
  authenticateAdminToken
};

