# Guide de Résolution des Problèmes - Authentification Google OAuth

## 🔍 Problèmes Courants et Solutions

### 1. Vérifier la Configuration dans `.env`

Assurez-vous que les variables suivantes sont définies dans votre fichier `.env` :

```env
GOOGLE_CLIENT_ID=votre_client_id_google
GOOGLE_CLIENT_SECRET=votre_client_secret_google
API_URL=http://localhost:5000
FRONTEND_URL=http://localhost:3000
```

### 2. Configuration dans Google Cloud Console

#### Étape 1 : Créer un Projet Google Cloud
1. Allez sur [Google Cloud Console](https://console.cloud.google.com/)
2. Créez un nouveau projet ou sélectionnez un projet existant

#### Étape 2 : Activer l'API Google+
1. Allez dans "APIs & Services" > "Library"
2. Recherchez "Google+ API" et activez-la

#### Étape 3 : Créer les Identifiants OAuth 2.0
1. Allez dans "APIs & Services" > "Credentials"
2. Cliquez sur "Create Credentials" > "OAuth client ID"
3. Sélectionnez "Web application"
4. Configurez :

**Authorized JavaScript origins:**
```
http://localhost:5000
http://localhost:3000
```

**Authorized redirect URIs:**
```
http://localhost:5000/api/auth/google/callback
```

⚠️ **IMPORTANT** : L'URL de callback DOIT correspondre exactement à celle configurée dans `passport.js` :
```javascript
callbackURL: `${API_URL}/api/auth/google/callback`
```

### 3. Vérifier la Base de Données

Assurez-vous que la colonne `google_id` existe dans la table `users` :

```sql
-- Vérifier si la colonne existe
DESCRIBE users;

-- Si elle n'existe pas, l'ajouter :
ALTER TABLE users ADD COLUMN google_id VARCHAR(255) NULL UNIQUE;
ALTER TABLE users ADD COLUMN profile_picture VARCHAR(500) NULL;
```

### 4. Vérifier que le Serveur Backend Démarré

Le serveur doit être démarré et afficher :
```
✅ Google OAuth configuré
```

Si vous voyez :
```
⚠️  Google OAuth non configuré - GOOGLE_CLIENT_ID et GOOGLE_CLIENT_SECRET requis
```

Cela signifie que les variables d'environnement ne sont pas correctement chargées.

### 5. Tester l'Endpoint de Démarrage

Testez l'endpoint de démarrage Google OAuth :

```bash
curl http://localhost:5000/api/auth/google
```

**Si tout est correct**, vous devriez être redirigé vers Google.

**Si vous obtenez une erreur 503**, vérifiez que :
- `GOOGLE_CLIENT_ID` est défini
- `GOOGLE_CLIENT_SECRET` est défini
- Le serveur a été redémarré après avoir modifié `.env`

### 6. Problèmes Courants

#### Erreur : "redirect_uri_mismatch"
**Cause** : L'URL de callback dans Google Cloud Console ne correspond pas à celle du code.

**Solution** :
1. Vérifiez l'URL dans Google Cloud Console : `http://localhost:5000/api/auth/google/callback`
2. Vérifiez la variable `API_URL` dans `.env` : `API_URL=http://localhost:5000`
3. Redémarrez le serveur backend

#### Erreur : "invalid_client"
**Cause** : `GOOGLE_CLIENT_ID` ou `GOOGLE_CLIENT_SECRET` incorrect.

**Solution** :
1. Vérifiez que les valeurs dans `.env` correspondent exactement à celles de Google Cloud Console
2. Pas d'espaces avant/après les valeurs
3. Redémarrez le serveur

#### Erreur : "Access blocked: This app's request is invalid"
**Cause** : L'application Google OAuth n'est pas en mode "Testing" ou l'utilisateur n'est pas dans la liste des testeurs.

**Solution** :
1. Dans Google Cloud Console, allez dans "APIs & Services" > "OAuth consent screen"
2. Assurez-vous que l'application est en mode "Testing"
3. Ajoutez votre email Google dans "Test users"

#### La fenêtre popup se ferme sans authentifier
**Cause** : Problème de communication entre la fenêtre popup et la page parent.

**Solution** :
1. Vérifiez que le frontend écoute les messages `postMessage` :
```javascript
window.addEventListener('message', (event) => {
  if (event.origin !== 'http://localhost:5000') return;
  
  if (event.data.type === 'GOOGLE_AUTH_SUCCESS') {
    // Traiter la connexion réussie
    console.log('User:', event.data.user);
    console.log('Token:', event.data.token);
  } else if (event.data.type === 'GOOGLE_AUTH_ERROR') {
    // Traiter l'erreur
    console.error('Error:', event.data.error);
  }
});
```

### 7. Vérification Complète

Testez la configuration complète :

1. **Vérifier les variables d'environnement** :
```bash
# Dans PowerShell
Get-Content .env | Select-String "GOOGLE"
```

2. **Vérifier que le serveur charge les variables** :
   - Le serveur doit afficher `✅ Google OAuth configuré` au démarrage

3. **Tester l'endpoint** :
```bash
curl http://localhost:5000/api/auth/google
```

4. **Vérifier les logs du serveur** :
   - Ouvrez la console du serveur backend
   - Essayez de vous connecter avec Google
   - Vérifiez les erreurs dans les logs

### 8. Debug Mode

Pour activer le mode debug, ajoutez dans `src/config/passport.js` :

```javascript
passport.use(new GoogleStrategy({
    clientID: GOOGLE_CLIENT_ID,
    clientSecret: GOOGLE_CLIENT_SECRET,
    callbackURL: `${API_URL}/api/auth/google/callback`,
    passReqToCallback: true
  },
  async function(request, accessToken, refreshToken, profile, done) {
    console.log('🔍 Google Profile:', JSON.stringify(profile, null, 2));
    console.log('🔍 Access Token:', accessToken);
    // ... reste du code
  }
));
```

## 📝 Checklist de Configuration

- [ ] `GOOGLE_CLIENT_ID` défini dans `.env`
- [ ] `GOOGLE_CLIENT_SECRET` défini dans `.env`
- [ ] `API_URL` défini dans `.env` (ex: `http://localhost:5000`)
- [ ] Projet créé dans Google Cloud Console
- [ ] Google+ API activée
- [ ] OAuth 2.0 Client ID créé
- [ ] Authorized JavaScript origins configurés
- [ ] Authorized redirect URIs configurés (`http://localhost:5000/api/auth/google/callback`)
- [ ] Colonne `google_id` existe dans la table `users`
- [ ] Serveur backend démarré et affiche `✅ Google OAuth configuré`
- [ ] Frontend écoute les messages `postMessage`

## 🆘 Support

Si le problème persiste après avoir suivi ce guide :
1. Vérifiez les logs du serveur backend (console)
2. Vérifiez la console du navigateur (F12)
3. Vérifiez les logs de Google Cloud Console
4. Partagez les messages d'erreur exacts pour un diagnostic plus précis

