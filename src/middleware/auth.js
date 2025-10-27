const jwt = require('jsonwebtoken');

// Middleware pour vérifier le token JWT
exports.authenticateToken = async (req, res, next) => {
  try {
    let token;

    // Récupérer le token depuis le header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    // Log pour débogage
    console.log(`🔐 Auth check for ${req.method} ${req.path}:`, {
      hasAuth: !!req.headers.authorization,
      tokenLength: token ? token.length : 0,
      userAgent: req.get('user-agent')?.substring(0, 50)
    });

    if (!token) {
      console.log('❌ No token provided');
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Token manquant'
      });
    }

    // Vérifier le token
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
      console.log('✅ Token valid for user:', decoded.email);
      next();
    } catch (error) {
      console.log('❌ Token invalid:', error.message);
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Token invalide ou expiré'
      });
    }

  } catch (error) {
    console.error('Erreur middleware auth:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur d\'authentification'
    });
  }
};

// Alias pour compatibilité
exports.protect = exports.authenticateToken;

// Middleware pour vérifier le rôle de l'utilisateur
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: 'Accès interdit - Permissions insuffisantes'
      });
    }

    next();
  };
};

