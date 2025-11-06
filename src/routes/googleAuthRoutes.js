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
    
    // Valider et stocker le rôle dans la session
    const validRoles = ['student', 'instructor', 'apprenant', 'formateur'];
    let userRole = 'student'; // Par défaut
    
    if (req.query.role) {
      const requestedRole = req.query.role.toLowerCase();
      
      // Mapper les rôles français vers anglais
      if (requestedRole === 'apprenant') {
        userRole = 'student';
      } else if (requestedRole === 'formateur') {
        userRole = 'instructor';
      } else if (validRoles.includes(requestedRole)) {
        userRole = requestedRole;
      } else {
        console.warn(`⚠️  [Google OAuth] Rôle invalide reçu: ${req.query.role}, utilisation du rôle par défaut: student`);
      }
    }
    
    // Stocker le rôle dans la session pour l'utiliser après le callback
    req.session.userRole = userRole;
    
    console.log(`🔐 [Google OAuth] Rôle sélectionné: ${userRole} (paramètre reçu: ${req.query.role || 'aucun'})`);
    
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
  (req, res, next) => {
    // Middleware pour capturer les erreurs Passport
    passport.authenticate('google', { 
      failureRedirect: false,
      session: false
    })(req, res, (err) => {
      // Si erreur ou utilisateur non authentifié, stocker l'info dans req
      if (err || !req.user) {
        // L'info d'erreur est dans req.authInfo (si fournie par done(null, false, info))
        if (req.authInfo) {
          req.authError = req.authInfo;
        } else if (err) {
          req.authError = { message: err.message, code: 'AUTH_ERROR' };
        } else {
          req.authError = { message: 'Authentification échouée', code: 'AUTH_FAILED' };
        }
      }
      next();
    });
  },
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
        
        // Récupérer l'erreur depuis req.authError (capturée par le middleware)
        const authError = req.authError || {};
        const errorMessage = authError.message || 'L\'authentification Google a échoué. Veuillez réessayer.';
        const errorCode = authError.code;
        const email = authError.email;
        
        // Si c'est une erreur de rôle requis, rediriger vers /select-role
        if (errorCode === 'ROLE_REQUIRED' || errorCode === 'INVALID_ROLE') {
          console.log('🔄 [Google OAuth] Redirection vers /select-role (rôle requis)');
          const selectRoleUrl = `${frontendUrl}/select-role?from=google${email ? `&email=${encodeURIComponent(email)}` : ''}&message=${encodeURIComponent(errorMessage)}`;
          return res.redirect(selectRoleUrl);
        }
        
        // Autre erreur - rediriger vers le callback avec l'erreur
        const errorUrl = `${callbackUrl}?error=${encodeURIComponent(errorMessage)}`;
        return res.redirect(errorUrl);
      }

      const user = req.user;
      console.log('✅ [Google OAuth] User authenticated:', user.email);
      console.log('👤 [Google OAuth] Rôle de l\'utilisateur:', user.role);

      // Le rôle retourné est celui de l'utilisateur en base de données
      // Pour les nouveaux utilisateurs, c'est le rôle choisi lors de l'inscription
      // Pour les utilisateurs existants, c'est leur rôle actuel
      const userRole = user.role || 'student';

      // Générer le token JWT avec le rôle de l'utilisateur
      const token = jwt.sign(
        { 
          userId: user.id,
          email: user.email,
          role: userRole
        },
        process.env.JWT_SECRET || 'mdsc_secret_key_2024',
        { expiresIn: '7d' }
      );

      // Préparer les données utilisateur (sans le mot de passe)
      // Le rôle retourné est celui de l'utilisateur en base de données
      const userData = {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: userRole, // Utiliser le rôle validé
        profilePicture: user.profile_picture || null,
        emailVerified: user.is_email_verified === 1 || user.is_email_verified === true,
        isActive: user.is_active !== 0 && user.is_active !== false,
        organization: user.organization || '',
        phone: user.phone || '',
        country: user.country || ''
      };
      
      console.log('📤 [Google OAuth] Données utilisateur retournées:', {
        id: userData.id,
        email: userData.email,
        role: userData.role
      });

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

