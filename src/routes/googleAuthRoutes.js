const express = require('express');
const router = express.Router();
const passport = require('../config/passport');
const jwt = require('jsonwebtoken');

// Vérifier si Google OAuth est configuré
const isGoogleOAuthConfigured = process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET;

// Route pour initier l'authentification Google
router.get('/google', 
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Google OAuth non configuré'
      });
    }
    // Stocker le rôle dans la session pour l'utiliser après le callback
    if (req.query.role) {
      req.session.userRole = req.query.role;
    } else {
      req.session.userRole = 'student';
    }
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email']
  })
);

// Route de callback Google OAuth
router.get('/google/callback',
  (req, res, next) => {
    if (!isGoogleOAuthConfigured) {
      return res.status(503).json({
        success: false,
        message: 'Google OAuth non configuré'
      });
    }
    next();
  },
  passport.authenticate('google', { 
    failureRedirect: false,
    session: false
  }),
  async (req, res) => {
    try {
      console.log('✅ [Google OAuth] Callback reçu');
      
      // Récupérer l'URL du frontend depuis la variable d'environnement ou utiliser localhost:3000 par défaut
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      
      // Récupérer l'URL de callback depuis la query string ou utiliser la valeur par défaut
      const callbackUrl = req.query.callback || `${frontendUrl}/auth/google/callback`;
      
      // Vérifier si l'authentification a réussi
      if (!req.user) {
        console.error('❌ [Google OAuth] Authentification échouée - req.user est null');
        const errorUrl = `${callbackUrl}?error=${encodeURIComponent('L\'authentification Google a échoué. Veuillez réessayer.')}`;
        return res.redirect(errorUrl);
      }

      const user = req.user;
      console.log('✅ [Google OAuth] User authenticated:', user.email);

      // Générer le token JWT
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: user.role
        },
        process.env.JWT_SECRET || 'mdsc_secret_key_2024',
        { expiresIn: '7d' }
      );

      // Préparer les données utilisateur (sans le mot de passe)
      const userData = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: user.role,
        profilePicture: user.profile_picture || null,
        emailVerified: user.is_email_verified === 1 || user.is_email_verified === true,
        isActive: user.is_active !== 0 && user.is_active !== false,
        organization: user.organization || '',
        phone: user.phone || '',
        country: user.country || ''
      };

      // Encoder les données utilisateur en JSON
      const userJson = JSON.stringify(userData);
      
      // Construire l'URL de redirection avec les données
      const redirectUrl = `${callbackUrl}?token=${encodeURIComponent(token)}&user=${encodeURIComponent(userJson)}`;
      
      console.log('🔄 [Google OAuth] Redirection vers:', callbackUrl);
      console.log('📤 [Google OAuth] Token généré pour user:', user.email);
      
      // Rediriger vers le frontend
      res.redirect(redirectUrl);
      
    } catch (error) {
      console.error('❌ [Google OAuth] Erreur dans le callback:', error);
      
      // En cas d'erreur, rediriger vers le frontend avec un message d'erreur
      const frontendUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').trim();
      const callbackUrl = req.query.callback || `${frontendUrl}/auth/google/callback`;
      const errorMessage = error.message || 'Une erreur est survenue lors de l\'authentification.';
      const errorUrl = `${callbackUrl}?error=${encodeURIComponent(errorMessage)}`;
      
      res.redirect(errorUrl);
    }
  }
);

module.exports = router;

