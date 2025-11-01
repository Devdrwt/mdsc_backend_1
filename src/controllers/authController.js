const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const crypto = require('crypto');
const { pool } = require('../config/database');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../services/emailService');

// Générer un token JWT
const generateToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_SECRET || 'mdsc_secret_key_2024_super_secure_change_in_production',
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );
};

// Générer un refresh token
const generateRefreshToken = (userId, email, role) => {
  return jwt.sign(
    { userId, email, role },
    process.env.JWT_REFRESH_SECRET || 'mdsc_refresh_secret_key_2024_super_secure_change_in_production',
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

// Inscription
exports.register = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { 
      email, 
      password, 
      firstName, 
      lastName, 
      npi, 
      phone, 
      organization, 
      country,
      role
    } = req.body;

    // Valider le rôle (student, instructor ou admin)
    const validRoles = ['student', 'instructor', 'admin'];
    const userRole = validRoles.includes(role) ? role : 'student';

    // Vérifier si l'utilisateur existe déjà
    const [existingUsers] = await connection.query(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );

    if (existingUsers.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Un compte existe déjà avec cette adresse email'
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12);

    // Créer l'utilisateur
    const [result] = await connection.query(
      'INSERT INTO users (email, password, first_name, last_name, phone, organization, country, role) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [email, hashedPassword, firstName, lastName, phone, organization, country, userRole]
    );

    const userId = result.insertId;

    // Générer un token de vérification d'email (hashé en base et envoyé en hash)
    const verificationToken = uuidv4();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.EMAIL_VERIFICATION_EXPIRE || 24));

    await connection.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [userId, verificationTokenHash, expiresAt]
    );

    // Envoyer l'email de vérification (optionnel - ne fait pas échouer l'inscription si erreur)
    try {
      await sendVerificationEmail(email, firstName, verificationTokenHash);
      console.log('✅ Email de vérification envoyé à:', email);
    } catch (emailError) {
      console.error('❌ Erreur envoi email de vérification:', emailError.message);
      console.log('⚠️  L\'utilisateur devra vérifier son email manuellement');
      console.log('📧 Token de vérification (hash):', verificationTokenHash);
      console.log('🔗 Lien de vérification:', `${process.env.VERIFY_EMAIL_URL}?token=${verificationTokenHash}`);
    }

    res.status(201).json({
      success: true,
      message: 'Inscription réussie ! Veuillez vérifier votre email pour activer votre compte.',
      data: {
        userId,
        email,
        firstName,
        lastName,
        npi,
        phone,
        organization,
        country,
        verificationToken: process.env.NODE_ENV === 'development' ? verificationToken : undefined
      }
    });

  } catch (error) {
    console.error('Erreur inscription:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'inscription',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    connection.release();
  }
};

// Vérification d'email
exports.verifyEmail = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    // Le token peut venir de req.query (GET) ou req.body (POST)
    const token = req.query.token || req.body.token;
    
    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification requis'
      });
    }

    // Le token dans l'email est déjà un hash SHA-256, pas besoin de le re-hasher
    const tokenHash = String(token).trim();

    // Vérifier que c'est bien un hash SHA-256 (64 caractères hexadécimaux)
    if (!/^[a-f0-9]{64}$/i.test(tokenHash)) {
      return res.status(400).json({
        success: false,
        message: 'Format de token invalide'
      });
    }

    // Vérifier le token
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at FROM email_verification_tokens WHERE token = ?',
      [tokenHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de vérification invalide'
      });
    }

    const { user_id, expires_at } = tokens[0];

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      await connection.query('DELETE FROM email_verification_tokens WHERE token = ?', [tokenHash]);
      return res.status(400).json({
        success: false,
        message: 'Le token de vérification a expiré. Veuillez demander un nouveau lien.'
      });
    }

    // Mettre à jour l'utilisateur
    await connection.query(
      'UPDATE users SET is_email_verified = TRUE, email_verified_at = NOW() WHERE id = ?',
      [user_id]
    );

    // Supprimer le token utilisé
    await connection.query('DELETE FROM email_verification_tokens WHERE token = ?', [tokenHash]);

    res.json({
      success: true,
      message: 'Email vérifié avec succès ! Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    console.error('Erreur vérification email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification de l\'email'
    });
  } finally {
    connection.release();
  }
};

// Connexion
exports.login = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, email, password, first_name, last_name, is_email_verified, is_active, role FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    const user = users[0];

    // Vérifier le mot de passe
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Vérifier si l'email est vérifié
    if (!user.is_email_verified) {
      return res.status(403).json({
        success: false,
        message: 'Veuillez vérifier votre email avant de vous connecter',
        emailNotVerified: true
      });
    }

    // Vérifier si le compte est actif
    if (!user.is_active) {
      return res.status(403).json({
        success: false,
        message: 'Votre compte a été désactivé. Contactez l\'administrateur.'
      });
    }

    // Générer les tokens
    const token = generateToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    // Stocker le refresh token
    const refreshExpiresAt = new Date();
    refreshExpiresAt.setDate(refreshExpiresAt.getDate() + 30);

    await connection.query(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?)',
      [user.id, refreshToken, refreshExpiresAt, req.ip, req.get('user-agent')]
    );

    // Mettre à jour la dernière connexion
    await connection.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    // Enregistrer la session
    await connection.query(
      'INSERT INTO user_sessions (user_id, ip_address, user_agent, login_at) VALUES (?, ?, ?, NOW())',
      [user.id, req.ip, req.get('user-agent')]
    );

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user.id,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name,
          role: user.role
        },
        token,
        refreshToken
      }
    });

  } catch (error) {
    console.error('Erreur connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion'
    });
  } finally {
    connection.release();
  }
};

// Renvoyer l'email de vérification
exports.resendVerificationEmail = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { email } = req.body;

    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, first_name, is_email_verified FROM users WHERE email = ?',
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aucun compte trouvé avec cette adresse email'
      });
    }

    const user = users[0];

    if (user.is_email_verified) {
      return res.status(400).json({
        success: false,
        message: 'Cet email est déjà vérifié'
      });
    }

    // Supprimer les anciens tokens
    await connection.query('DELETE FROM email_verification_tokens WHERE user_id = ?', [user.id]);

    // Générer un nouveau token (hashé)
    const verificationToken = uuidv4();
    const verificationTokenHash = crypto.createHash('sha256').update(verificationToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.EMAIL_VERIFICATION_EXPIRE || 24));

    await connection.query(
      'INSERT INTO email_verification_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, verificationTokenHash, expiresAt]
    );

    // Envoyer l'email
    await sendVerificationEmail(email, user.first_name, verificationTokenHash);

    res.json({
      success: true,
      message: 'Email de vérification renvoyé avec succès'
    });

  } catch (error) {
    console.error('Erreur renvoi email:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du renvoi de l\'email de vérification'
    });
  } finally {
    connection.release();
  }
};

// Demande de réinitialisation de mot de passe
exports.forgotPassword = async (req, res) => {
  console.log('\n🔔 FORGOT_PASSWORD: ========== DÉBUT ==========');
  console.log('🔔 FORGOT_PASSWORD: Controller appelé !');
  console.log('🔔 FORGOT_PASSWORD: Email reçu:', req.body?.email);
  console.log('🔔 FORGOT_PASSWORD: Body complet:', JSON.stringify(req.body));
  console.log('🔔 FORGOT_PASSWORD: Headers Origin:', req.headers.origin);
  console.log('🔔 FORGOT_PASSWORD: Content-Type:', req.headers['content-type']);
  console.log('🔔 FORGOT_PASSWORD: IP:', req.ip);
  
  const connection = await pool.getConnection();
  
  try {
    const { email } = req.body;

    if (!email) {
      console.error('❌ FORGOT_PASSWORD: Email manquant');
      return res.status(400).json({
        success: false,
        message: 'Email requis'
      });
    }

    console.log('🔔 FORGOT_PASSWORD: Recherche de l\'utilisateur...');
    // Récupérer l'utilisateur
    const [users] = await connection.query(
      'SELECT id, first_name, is_email_verified FROM users WHERE email = ?',
      [email]
    );

    console.log('🔔 FORGOT_PASSWORD: Utilisateurs trouvés:', users.length);

    // Pour des raisons de sécurité, on renvoie toujours un message de succès
    if (users.length === 0) {
      console.log('⚠️  FORGOT_PASSWORD: Aucun utilisateur trouvé - réponse sécurisée');
      return res.json({
        success: true,
        message: 'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.'
      });
    }

    const user = users[0];
    console.log('🔔 FORGOT_PASSWORD: Utilisateur trouvé - ID:', user.id, 'Email vérifié:', user.is_email_verified);

    if (!user.is_email_verified) {
      console.log('❌ FORGOT_PASSWORD: Email non vérifié');
      return res.status(403).json({
        success: false,
        message: 'Veuillez d\'abord vérifier votre email'
      });
    }

    console.log('🔔 FORGOT_PASSWORD: Suppression des anciens tokens...');
    // Supprimer les anciens tokens non utilisés
    await connection.query(
      'DELETE FROM password_reset_tokens WHERE user_id = ? AND used_at IS NULL',
      [user.id]
    );

    console.log('🔔 FORGOT_PASSWORD: Génération du nouveau token...');
    // Générer un nouveau token (hashé)
    const resetToken = uuidv4();
    const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + parseInt(process.env.PASSWORD_RESET_EXPIRE || 1));

    console.log('🔔 FORGOT_PASSWORD: Insertion du token en base...');
    await connection.query(
      'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES (?, ?, ?)',
      [user.id, resetTokenHash, expiresAt]
    );
    console.log('✅ FORGOT_PASSWORD: Token inséré en base - Hash:', resetTokenHash.substring(0, 16) + '...');

    console.log('🔔 FORGOT_PASSWORD: Tentative d\'envoi de l\'email...');
    // Envoyer l'email (avec gestion d'erreur séparée pour ne pas bloquer la réponse)
    try {
      await sendPasswordResetEmail(email, user.first_name, resetTokenHash);
      console.log('✅ FORGOT_PASSWORD: Email envoyé avec succès');
    } catch (emailError) {
      // Log détaillé de l'erreur email mais continuer quand même
      console.error('\n❌ FORGOT_PASSWORD: ERREUR ENVOI EMAIL');
      console.error('   Message:', emailError.message);
      console.error('   Code:', emailError.code);
      console.error('   Stack:', emailError.stack);
      console.log('⚠️  FORGOT_PASSWORD: L\'email n\'a pas pu être envoyé, mais le token a été créé');
      console.log('📧 FORGOT_PASSWORD: Token de réinitialisation:', resetTokenHash);
      
      // En développement, on peut logger l'URL complète pour faciliter le debug
      if (process.env.NODE_ENV === 'development') {
        const resetUrl = `${process.env.RESET_PASSWORD_URL || process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetTokenHash}`;
        console.log('🔗 FORGOT_PASSWORD: URL de réinitialisation:', resetUrl);
      }
    }

    console.log('✅ FORGOT_PASSWORD: Retour 200 - Succès');
    res.json({
      success: true,
      message: 'Si un compte existe avec cette adresse email, vous recevrez un lien de réinitialisation.'
    });

  } catch (error) {
    console.error('\n❌ FORGOT_PASSWORD: ERREUR CRITIQUE');
    console.error('   Message:', error.message);
    console.error('   Code:', error.code);
    console.error('   Stack:', error.stack);
    console.error('❌ FORGOT_PASSWORD: RETOUR 500');
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la demande de réinitialisation'
    });
  } finally {
    connection.release();
    console.log('🔔 FORGOT_PASSWORD: ========== FIN ==========\n');
  }
};

// Réinitialisation du mot de passe
exports.resetPassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { token, newPassword } = req.body;
    
    // Le token dans l'email est déjà un hash SHA-256, pas besoin de le re-hasher
    const tokenHash = String(token).trim();

    // Vérifier que c'est bien un hash SHA-256 (64 caractères hexadécimaux)
    if (!/^[a-f0-9]{64}$/i.test(tokenHash)) {
      return res.status(400).json({
        success: false,
        message: 'Format de token invalide'
      });
    }

    // Vérifier le token
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at, used_at FROM password_reset_tokens WHERE token = ?',
      [tokenHash]
    );

    if (tokens.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Token de réinitialisation invalide'
      });
    }

    const { user_id, expires_at, used_at } = tokens[0];

    // Vérifier si le token a déjà été utilisé
    if (used_at) {
      return res.status(400).json({
        success: false,
        message: 'Ce token a déjà été utilisé'
      });
    }

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      await connection.query('DELETE FROM password_reset_tokens WHERE token = ?', [tokenHash]);
      return res.status(400).json({
        success: false,
        message: 'Le token de réinitialisation a expiré. Veuillez faire une nouvelle demande.'
      });
    }

    // Hasher le nouveau mot de passe
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Mettre à jour le mot de passe
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedPassword, user_id]
    );

    // Marquer le token comme utilisé
    await connection.query(
      'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = ?',
      [tokenHash]
    );

    // Révoquer tous les refresh tokens de l'utilisateur (sécurité)
    await connection.query(
      'UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL',
      [user_id]
    );

    res.json({
      success: true,
      message: 'Mot de passe réinitialisé avec succès. Vous pouvez maintenant vous connecter.'
    });

  } catch (error) {
    console.error('Erreur reset password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réinitialisation du mot de passe'
    });
  } finally {
    connection.release();
  }
};

// Rafraîchir le token
exports.refreshToken = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token manquant'
      });
    }

    // Vérifier le refresh token dans la base de données
    const [tokens] = await connection.query(
      'SELECT user_id, expires_at, revoked_at FROM refresh_tokens WHERE token = ?',
      [refreshToken]
    );

    if (tokens.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide'
      });
    }

    const { user_id, expires_at, revoked_at } = tokens[0];

    // Vérifier si le token a été révoqué
    if (revoked_at) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token révoqué'
      });
    }

    // Vérifier l'expiration
    if (new Date() > new Date(expires_at)) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token expiré'
      });
    }

    // Vérifier le JWT
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Refresh token invalide'
      });
    }

    // Récupérer les infos utilisateur
    const [users] = await connection.query(
      'SELECT email, role FROM users WHERE id = ?',
      [user_id]
    );

    if (users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const user = users[0];

    // Générer un nouveau token
    const newToken = generateToken(user_id, user.email, user.role);

    res.json({
      success: true,
      data: {
        token: newToken
      }
    });

  } catch (error) {
    console.error('Erreur refresh token:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du rafraîchissement du token'
    });
  } finally {
    connection.release();
  }
};

// Déconnexion
exports.logout = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Révoquer le refresh token
      await connection.query(
        'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?',
        [refreshToken]
      );
    }

    // Mettre à jour la session
    if (req.user) {
      await connection.query(
        'UPDATE user_sessions SET logout_at = NOW() WHERE user_id = ? AND logout_at IS NULL ORDER BY login_at DESC LIMIT 1',
        [req.user.userId]
      );
    }

    res.json({
      success: true,
      message: 'Déconnexion réussie'
    });

  } catch (error) {
    console.error('Erreur logout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la déconnexion'
    });
  } finally {
    connection.release();
  }
};

// Récupérer le profil utilisateur (nécessite authentification)
exports.getProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const userId = req.user?.id ?? req.user?.userId;

    const [users] = await connection.query(
      'SELECT id, email, first_name, last_name, role, is_email_verified, created_at, last_login_at FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    // Récupérer le dernier avatar depuis user_files
    const [avatarRows] = await connection.query(
      `SELECT file_name
       FROM user_files
       WHERE user_id = ? AND file_type = 'profile_picture'
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
    const avatarUrl = avatarRows.length && avatarRows[0].file_name
      ? `${apiUrl}/uploads/profiles/${avatarRows[0].file_name}`
      : null;

    res.json({
      success: true,
      data: {
        user: {
          id: users[0].id,
          email: users[0].email,
          firstName: users[0].first_name,
          lastName: users[0].last_name,
          role: users[0].role,
          isEmailVerified: users[0].is_email_verified,
          createdAt: users[0].created_at,
          lastLoginAt: users[0].last_login_at,
          avatarUrl
        }
      }
    });

  } catch (error) {
    console.error('Erreur get profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du profil'
    });
  } finally {
    connection.release();
  }
};

// Modifier le profil utilisateur
exports.updateProfile = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { firstName, lastName, email } = req.body;
    const userId = req.user.userId;

    // Vérifier que l'email n'est pas déjà utilisé par un autre utilisateur
    if (email) {
      const [existingUsers] = await connection.query(
        'SELECT id FROM users WHERE email = ? AND id != ?',
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Cette adresse email est déjà utilisée'
        });
      }
    }

    // Construire la requête de mise à jour dynamiquement
    const updates = [];
    const values = [];

    if (firstName !== undefined) {
      updates.push('first_name = ?');
      values.push(firstName);
    }
    if (lastName !== undefined) {
      updates.push('last_name = ?');
      values.push(lastName);
    }
    if (email !== undefined) {
      updates.push('email = ?');
      values.push(email);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(userId);

    const updateQuery = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await connection.query(updateQuery, values);

    res.json({
      success: true,
      message: 'Profil mis à jour avec succès'
    });

  } catch (error) {
    console.error('Erreur update profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour du profil'
    });
  } finally {
    connection.release();
  }
};

// Changer le mot de passe
exports.changePassword = async (req, res) => {
  const connection = await pool.getConnection();
  
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.userId;

    // Vérifier le mot de passe actuel
    const [users] = await connection.query(
      'SELECT password FROM users WHERE id = ?',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, users[0].password);
    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Mot de passe actuel incorrect'
      });
    }

    // Hacher le nouveau mot de passe
    const saltRounds = 12;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Mettre à jour le mot de passe
    await connection.query(
      'UPDATE users SET password = ? WHERE id = ?',
      [hashedNewPassword, userId]
    );

    res.json({
      success: true,
      message: 'Mot de passe modifié avec succès'
    });

  } catch (error) {
    console.error('Erreur change password:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du changement de mot de passe'
    });
  } finally {
    connection.release();
  }
};

