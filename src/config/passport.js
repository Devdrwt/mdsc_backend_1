const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const { pool } = require('./database');
const bcrypt = require('bcryptjs');
const { sanitizeValue } = require('../utils/sanitize');

// Configuration de la stratégie Google OAuth (optionnel)
const GOOGLE_CLIENT_ID = (process.env.GOOGLE_CLIENT_ID || '').trim();
const GOOGLE_CLIENT_SECRET = (process.env.GOOGLE_CLIENT_SECRET || '').trim();
const API_URL = (process.env.API_URL || 'http://localhost:5000').trim();

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
      clientID: GOOGLE_CLIENT_ID,
      clientSecret: GOOGLE_CLIENT_SECRET,
      callbackURL: `${API_URL}/api/auth/google/callback`,
      passReqToCallback: true
    },
  async function(request, accessToken, refreshToken, profile, done) {
    try {
      // Extraire et sanitiser les données du profil Google
      const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null;
      // Fournir des valeurs par défaut si les noms ne sont pas fournis (contrainte NOT NULL dans la base)
      const firstName = (profile.name && profile.name.givenName) ? profile.name.givenName : '';
      const lastName = (profile.name && profile.name.familyName) ? profile.name.familyName : '';
      const googleId = profile.id || null;
      const profilePicture = (profile.photos && profile.photos[0] && profile.photos[0].value) ? profile.photos[0].value : null;

      // Vérifier que l'email est présent (requis)
      if (!email) {
        console.error('❌ [Google OAuth] Email manquant dans le profil Google');
        return done(null, false, { 
          message: 'Email non fourni par Google. Veuillez réessayer.',
          code: 'EMAIL_MISSING'
        });
      }

      // Sanitiser toutes les valeurs pour éviter undefined dans SQL
      // Note: firstName et lastName sont déjà des chaînes vides si non fournis (contrainte NOT NULL)
      const sanitizedEmail = sanitizeValue(email);
      const sanitizedFirstName = firstName || ''; // Assurer une chaîne vide si null/undefined
      const sanitizedLastName = lastName || ''; // Assurer une chaîne vide si null/undefined
      const sanitizedGoogleId = sanitizeValue(googleId);
      const sanitizedProfilePicture = sanitizeValue(profilePicture);

      // Vérifier si l'utilisateur existe déjà
      const [existingUsers] = await pool.execute(
        'SELECT * FROM users WHERE email = ? OR google_id = ?',
        [sanitizedEmail, sanitizedGoogleId]
      );

      let user;

      if (existingUsers.length > 0) {
        // L'utilisateur existe déjà
        user = existingUsers[0];

        // Mettre à jour le google_id si ce n'est pas déjà fait
        if (!user.google_id) {
          await pool.execute(
            'UPDATE users SET google_id = ?, profile_picture = ?, is_email_verified = 1, email_verified_at = NOW() WHERE id = ?',
            [sanitizedGoogleId, sanitizedProfilePicture, user.id]
          );
          user.google_id = sanitizedGoogleId;
          user.profile_picture = sanitizedProfilePicture;
          user.is_email_verified = 1;
        }
        
        console.log(`✅ [Google OAuth] Utilisateur existant connecté: ${user.email} (rôle: ${user.role})`);
      } else {
        // Créer un nouveau compte utilisateur
        // Générer un mot de passe aléatoire (car l'utilisateur utilise Google pour se connecter)
        const randomPassword = Math.random().toString(36).slice(-12) + Math.random().toString(36).slice(-12);
        const hashedPassword = await bcrypt.hash(randomPassword, 10);

        // Récupérer le rôle de la session (passé lors de l'authentification Google)
        // Le rôle peut aussi être passé via state dans certains cas, mais on privilégie la session
        let userRole = null;
        
        if (request.session && request.session.userRole) {
          userRole = request.session.userRole;
          console.log(`✅ [Google OAuth] Rôle récupéré de la session: ${userRole}`);
        } else {
          // Si aucun rôle n'est fourni, on ne peut pas créer le compte
          // Le frontend doit rediriger vers /select-role
          console.warn(`⚠️  [Google OAuth] Aucun rôle trouvé dans la session pour le nouvel utilisateur`);
          return done(null, false, { 
            message: 'Rôle non spécifié. Veuillez sélectionner votre rôle.',
            code: 'ROLE_REQUIRED',
            email: sanitizedEmail
          });
        }
        
        // Valider le rôle avant insertion
        const validRoles = ['student', 'instructor', 'admin'];
        if (!validRoles.includes(userRole)) {
          console.warn(`⚠️  [Google OAuth] Rôle invalide: ${userRole}`);
          return done(null, false, { 
            message: 'Rôle invalide. Veuillez sélectionner un rôle valide.',
            code: 'INVALID_ROLE',
            email: sanitizedEmail
          });
        }

        // Sanitiser le rôle également
        const sanitizedUserRole = sanitizeValue(userRole);
        const sanitizedHashedPassword = sanitizeValue(hashedPassword);

        // Log des valeurs avant insertion pour débogage
        console.log('🔍 [Google OAuth] Valeurs avant insertion:', {
          email: sanitizedEmail,
          firstName: sanitizedFirstName,
          lastName: sanitizedLastName,
          googleId: sanitizedGoogleId,
          profilePicture: sanitizedProfilePicture ? 'présent' : 'null',
          role: sanitizedUserRole,
          hasPassword: !!sanitizedHashedPassword
        });

        const [result] = await pool.execute(
          `INSERT INTO users (
            email, 
            password, 
            first_name, 
            last_name, 
            google_id, 
            profile_picture,
            is_email_verified,
            email_verified_at,
            role,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, 1, NOW(), ?, NOW())`,
          [
            sanitizedEmail, 
            sanitizedHashedPassword, 
            sanitizedFirstName, 
            sanitizedLastName, 
            sanitizedGoogleId, 
            sanitizedProfilePicture, 
            sanitizedUserRole
          ]
        );

        // Récupérer l'utilisateur créé
        const [newUsers] = await pool.execute(
          'SELECT * FROM users WHERE id = ?',
          [result.insertId]
        );

        user = newUsers[0];
        console.log(`✅ [Google OAuth] Nouvel utilisateur créé avec le rôle: ${user.role}`);
      }

      // Vérifier si le compte est actif
      if (!user.is_active) {
        return done(null, false, { message: 'Votre compte a été désactivé.' });
      }

      return done(null, user);
    } catch (error) {
      console.error('Google OAuth error:', error);
      return done(error, null);
    }
  }
  ));
  console.log('✅ Google OAuth configuré');
} else {
  console.log('⚠️  Google OAuth non configuré - GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis');
}

// Sérialisation de l'utilisateur
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Désérialisation de l'utilisateur
passport.deserializeUser(async (id, done) => {
  try {
    const [users] = await pool.execute('SELECT * FROM users WHERE id = ?', [id]);
    if (users.length > 0) {
      done(null, users[0]);
    } else {
      done(new Error('User not found'), null);
    }
  } catch (error) {
    done(error, null);
  }
});

module.exports = passport;

