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
    req.session.userRole = req.query.role || 'student';
    next();
  },
  passport.authenticate('google', { 
    scope: ['profile', 'email'],
    session: false
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
    failureRedirect: '/login?error=google_auth_failed',
    session: false
  }),
  async (req, res) => {
    try {
      const user = req.user;

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
        profilePicture: user.profile_picture,
        emailVerified: user.is_email_verified === 1,
        organization: user.organization,
        phone: user.phone,
        country: user.country
      };

      // Rediriger vers la page de succès avec les données
      // On utilise une page HTML intermédiaire pour envoyer les données au parent
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Authentification Google réussie</title>
          </head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_SUCCESS',
                user: ${JSON.stringify(userData)},
                token: '${token}'
              }, window.location.origin);
              window.close();
            </script>
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Authentification réussie !</h2>
              <p>Cette fenêtre va se fermer automatiquement...</p>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      console.error('Google callback error:', error);
      res.send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Erreur d'authentification</title>
          </head>
          <body>
            <script>
              window.opener.postMessage({
                type: 'GOOGLE_AUTH_ERROR',
                error: 'Une erreur est survenue lors de l\'authentification.'
              }, window.location.origin);
              window.close();
            </script>
            <div style="font-family: Arial, sans-serif; text-align: center; padding: 50px;">
              <h2>Erreur d'authentification</h2>
              <p>Cette fenêtre va se fermer automatiquement...</p>
            </div>
          </body>
        </html>
      `);
    }
  }
);

module.exports = router;

