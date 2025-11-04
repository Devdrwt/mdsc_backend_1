const jwt = require('jsonwebtoken');

// Middleware pour vérifier le token JWT
exports.authenticateToken = async (req, res, next) => {
  try {
    let token;

    // Récupérer le token depuis le header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }
    
    // Fallback: chercher le token dans les cookies (pour compatibilité)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }
    
    // Fallback: chercher le token dans les query params (pour développement uniquement)
    if (!token && req.query.token && process.env.NODE_ENV !== 'production') {
      token = req.query.token;
    }

    // Log pour débogage
    console.log(`🔐 Auth check for ${req.method} ${req.path}:`, {
      hasAuth: !!req.headers.authorization,
      hasCookie: !!(req.cookies && req.cookies.token),
      hasQueryToken: !!req.query.token,
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

    // Vérifier que le token ressemble à un JWT (format: xxx.xxx.xxx)
    if (!token.includes('.')) {
      console.log('❌ Token format invalid (not a JWT):', token.substring(0, 20) + '...');
      return res.status(401).json({
        success: false,
        message: 'Non autorisé - Format de token invalide. Utilisez un token JWT.'
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
      let errorMessage = 'Non autorisé - Token invalide ou expiré';
      
      if (error.name === 'TokenExpiredError') {
        errorMessage = 'Non autorisé - Token expiré';
      } else if (error.name === 'JsonWebTokenError') {
        errorMessage = 'Non autorisé - Token invalide';
      }
      
      return res.status(401).json({
        success: false,
        message: errorMessage
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

// Middleware d'authentification optionnelle (ne retourne pas d'erreur si pas de token)
exports.optionalAuth = async (req, res, next) => {
  try {
    let token;

    // Récupérer le token depuis le header Authorization
    if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        req.user = decoded;
        console.log('✅ Optional auth: Token valid for user:', decoded.email);
      } catch (error) {
        console.log('⚠️ Optional auth: Token invalid, continuing without auth:', error.message);
        // Ne pas bloquer, continuer sans authentification
      }
    } else {
      console.log('ℹ️ Optional auth: No token provided, continuing without auth');
    }

    next();
  } catch (error) {
    console.error('Erreur middleware optional auth:', error);
    // En cas d'erreur, continuer sans authentification
    next();
  }
};

// Middleware pour vérifier le rôle de l'utilisateur
exports.authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Non autorisé'
      });
    }

    const allowedRoles = Array.isArray(roles[0]) ? roles[0] : roles;
    const userRole = req.user.role;
    console.log(`🔐 Authorization check: user role="${userRole}", allowed roles=[${allowedRoles.join(', ')}]`);
    
    if (!allowedRoles.includes(userRole)) {
      console.log(`❌ Access denied: user role "${userRole}" not in allowed roles [${allowedRoles.join(', ')}]`);
      return res.status(403).json({
        success: false,
        message: 'Accès interdit - Permissions insuffisantes'
      });
    }

    console.log(`✅ Access granted for role "${userRole}"`);
    next();
  };
};

