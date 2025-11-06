const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { sanitizeValue } = require('../utils/sanitize');
const { send2FACodeEmail } = require('../services/emailService');

// Configuration
const ADMIN_EMAIL_DOMAIN = process.env.ADMIN_EMAIL_DOMAIN || '@mdsc.org';
const ADMIN_EMAIL_WHITELIST = process.env.ADMIN_EMAIL_WHITELIST?.split(',') || [];
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = '30m'; // 30 minutes pour admin

/**
 * Connexion admin (étape 1 : email/password)
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    console.log('🔐 [Admin Login] Tentative de connexion:', { email, hasPassword: !!password });

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email et mot de passe requis'
      });
    }

    // Récupérer l'utilisateur avec rôle admin
    // On vérifie d'abord en base si l'utilisateur a le rôle admin (plus flexible)
    const [users] = await pool.execute(
      'SELECT * FROM users WHERE email = ? AND role = "admin" AND is_active = TRUE',
      [email]
    );

    // Si l'utilisateur n'existe pas ou n'a pas le rôle admin
    if (users.length === 0) {
      // Vérifier aussi si l'email correspond aux critères de domaine/whitelist
      // (pour les nouveaux comptes qui n'ont pas encore le rôle admin)
      const isAdminEmail = email.endsWith(ADMIN_EMAIL_DOMAIN) || 
                          ADMIN_EMAIL_WHITELIST.includes(email);
      
      if (!isAdminEmail) {
        // Logger l'échec
        await pool.execute(
          'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success, failure_reason) VALUES (NULL, ?, ?, FALSE, ?)',
          [req.ip, req.get('user-agent') || '', 'Email non autorisé pour accès admin']
        ).catch(() => {}); // Ignorer les erreurs si la table n'existe pas encore

        return res.status(403).json({
          success: false,
          message: 'Accès admin uniquement'
        });
      }
      
      // Si l'email est dans le domaine/whitelist mais n'a pas le rôle admin en base
      // Logger l'échec
      await pool.execute(
        'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success, failure_reason) VALUES (NULL, ?, ?, FALSE, ?)',
        [req.ip, req.get('user-agent') || '', 'Utilisateur non trouvé ou n\'a pas le rôle admin']
      ).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      // Logger l'échec
      await pool.execute(
        'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success, failure_reason) VALUES (?, ?, ?, FALSE, ?)',
        [user.id, req.ip, req.get('user-agent') || '', 'Mot de passe invalide']
      ).catch(() => {});

      return res.status(401).json({
        success: false,
        message: 'Identifiants invalides'
      });
    }

    // Générer code 2FA
    const code2FA = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Stocker le code
    await pool.execute(
      'INSERT INTO admin_2fa_codes (admin_id, code, expires_at) VALUES (?, ?, ?)',
      [user.id, code2FA, expiresAt]
    ).catch(() => {
      // Si la table n'existe pas encore, on continue sans 2FA pour le moment
      console.warn('⚠️ Table admin_2fa_codes non trouvée. 2FA désactivé temporairement.');
    });

    // Envoyer le code 2FA par email
    const firstName = user.first_name || 'Administrateur';
    const emailSent = await send2FACodeEmail(user.email, firstName, code2FA).catch((error) => {
      console.error('❌ Erreur lors de l\'envoi du code 2FA par email:', error.message);
      return false;
    });

    // En développement, afficher aussi dans les logs si l'email n'a pas été envoyé
    if (process.env.NODE_ENV === 'development') {
      if (!emailSent) {
        console.log(`🔐 [DEV] Code 2FA pour ${email}: ${code2FA} (email non envoyé - configuration manquante)`);
      } else {
        console.log(`✅ [DEV] Code 2FA envoyé par email à ${email}`);
      }
    }

    // Logger la tentative
    await pool.execute(
      'INSERT INTO admin_login_logs (admin_id, ip_address, user_agent, success) VALUES (?, ?, ?, TRUE)',
      [user.id, req.ip, req.get('user-agent') || '']
    ).catch(() => {});

    res.json({
      success: true,
      message: 'Code 2FA envoyé par email',
      data: {
        admin_id: user.id,
        email: user.email,
        // En développement, retourner le code
        ...(process.env.NODE_ENV === 'development' && { code_2fa: code2FA })
      }
    });

  } catch (error) {
    console.error('Erreur lors de la connexion admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  }
};

/**
 * Vérification 2FA (étape 2)
 */
const verify2FA = async (req, res) => {
  try {
    // Support pour les deux formats : admin_id ou adminId
    const admin_id = req.body.admin_id || req.body.adminId;
    const code = req.body.code;

    if (!admin_id || !code) {
      return res.status(400).json({
        success: false,
        message: 'ID admin et code 2FA requis',
        received: {
          admin_id: req.body.admin_id,
          adminId: req.body.adminId,
          code: req.body.code ? 'present' : 'missing'
        }
      });
    }

    // Vérifier le code
    const [codes] = await pool.execute(
      'SELECT * FROM admin_2fa_codes WHERE admin_id = ? AND code = ? AND used = FALSE AND expires_at > NOW() ORDER BY created_at DESC LIMIT 1',
      [admin_id, code]
    ).catch(() => {
      // Si la table n'existe pas, permettre la connexion sans 2FA en développement
      if (process.env.NODE_ENV === 'development') {
        return [[]];
      }
      throw new Error('Table admin_2fa_codes non trouvée');
    });

    if (codes.length === 0 && process.env.NODE_ENV !== 'development') {
      return res.status(401).json({
        success: false,
        message: 'Code 2FA invalide ou expiré'
      });
    }

    // Si code valide, marquer comme utilisé
    if (codes.length > 0) {
      await pool.execute(
        'UPDATE admin_2fa_codes SET used = TRUE WHERE id = ?',
        [codes[0].id]
      ).catch(() => {});
    }

    // Récupérer l'admin
    const [users] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND role = "admin"',
      [admin_id]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin non trouvé'
      });
    }

    const admin = users[0];

    // Générer JWT
    const token = jwt.sign(
      { 
        userId: admin.id, 
        email: admin.email, 
        role: 'admin',
        type: 'admin'
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          first_name: admin.first_name,
          last_name: admin.last_name,
          role: admin.role
        }
      }
    });

  } catch (error) {
    console.error('Erreur lors de la vérification 2FA:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification'
    });
  }
};

/**
 * Déconnexion
 */
const logout = async (req, res) => {
  try {
    // Pour JWT, la déconnexion se fait côté client
    // On peut logger la déconnexion si nécessaire
    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });
  } catch (error) {
    console.error('Erreur lors de la déconnexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  }
};

/**
 * Récupérer l'admin connecté
 */
const getMe = async (req, res) => {
  try {
    const adminId = req.user.userId;

    const [admins] = await pool.execute(
      'SELECT id, email, first_name, last_name, role FROM users WHERE id = ? AND role = "admin"',
      [adminId]
    );

    if (admins.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Admin non trouvé'
      });
    }

    res.json({
      success: true,
      data: admins[0]
    });

  } catch (error) {
    console.error('Erreur lors de la récupération:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération'
    });
  }
};

module.exports = {
  login,
  verify2FA,
  logout,
  getMe
};

