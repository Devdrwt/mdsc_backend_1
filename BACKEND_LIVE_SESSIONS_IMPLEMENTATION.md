# ✅ Implémentation Backend - Cours en Live avec Jitsi Meet

## 📋 Vue d'ensemble

Ce document récapitule l'implémentation complète du backend pour les cours en live avec intégration Jitsi Meet.

---

## ✅ Fichiers Créés

### 1. Migration SQL

**`database/migrations/016_create_live_sessions_tables.sql`**
- ✅ Table `live_sessions` : Gestion des sessions live
- ✅ Table `live_session_participants` : Participants aux sessions
- ✅ Table `live_session_chat` : Chat pendant les sessions (optionnel)
- ✅ Colonnes ajoutées à `courses` : `course_type`, `max_students`, `enrollment_deadline`, `course_start_date`, `course_end_date`

### 2. Service Jitsi

**`src/services/jitsiService.js`**
- ✅ `generateRoomName()` : Génération de noms de salle sécurisés
- ✅ `generateRoomPassword()` : Génération de mots de passe
- ✅ `generateJWT()` : Génération de JWT pour authentification Jitsi
- ✅ `generateJoinUrl()` : Génération d'URLs de connexion avec JWT
- ✅ `verifyJWT()` : Vérification de JWT

### 3. Contrôleur

**`src/controllers/liveSessionController.js`**
- ✅ `createSession` : Créer une session live
- ✅ `getCourseSessions` : Lister les sessions d'un cours
- ✅ `getSessionById` : Détails d'une session
- ✅ `updateSession` : Mettre à jour une session
- ✅ `deleteSession` : Supprimer une session
- ✅ `startSession` : Démarrer une session (instructeur)
- ✅ `endSession` : Terminer une session (instructeur)
- ✅ `getParticipants` : Liste des participants
- ✅ `joinSession` : Rejoindre une session (étudiant)
- ✅ `leaveSession` : Quitter une session
- ✅ `getStudentSessions` : Sessions de l'étudiant (upcoming, live, past)
- ✅ `getJitsiToken` : Générer un JWT pour Jitsi
- ✅ `getCalendarSessions` : Sessions pour le calendrier

### 4. Routes

**`src/routes/liveSessionRoutes.js`**
- ✅ Toutes les routes documentées implémentées
- ✅ Protection par authentification
- ✅ Autorisation pour instructeurs/admins

### 5. Intégration Calendrier

**`src/controllers/calendarController.js`**
- ✅ Modification de `getEvents()` pour inclure les sessions live
- ✅ Fusion automatique des événements et sessions live
- ✅ Filtrage par dates et statut

### 6. Intégration Serveur

**`src/server.js`**
- ✅ Import de `liveSessionRoutes`
- ✅ Route `/api` pour les sessions live

---

## 🔌 Endpoints API Disponibles

### Gestion des Sessions

```
POST   /api/courses/:courseId/live-sessions          Créer une session
GET    /api/courses/:courseId/live-sessions          Lister les sessions
GET    /api/live-sessions/:sessionId                 Détails d'une session
PUT    /api/live-sessions/:sessionId                 Mettre à jour
DELETE /api/live-sessions/:sessionId                 Supprimer
POST   /api/live-sessions/:sessionId/start           Démarrer (instructeur)
POST   /api/live-sessions/:sessionId/end             Terminer (instructeur)
```

### Participants

```
GET    /api/live-sessions/:sessionId/participants     Liste des participants
POST   /api/live-sessions/:sessionId/join             Rejoindre
POST   /api/live-sessions/:sessionId/leave            Quitter
```

### Étudiant

```
GET    /api/student/live-sessions                     Sessions de l'étudiant
GET    /api/student/calendar/live-sessions            Sessions pour calendrier
```

### Jitsi

```
POST   /api/live-sessions/:sessionId/jitsi-token      Générer JWT Jitsi
```

---

## 🔐 Sécurité

### ✅ Authentification
- Toutes les routes protégées par `authenticateToken`
- Vérification de l'utilisateur dans chaque endpoint

### ✅ Autorisation
- Instructeurs peuvent créer/modifier/supprimer leurs sessions
- Admins ont accès complet
- Étudiants peuvent rejoindre uniquement s'ils sont inscrits

### ✅ Validation
- Dates de début/fin validées
- Nombre maximum de participants vérifié
- Vérification d'inscription avant de rejoindre

### ✅ Génération Sécurisée
- Noms de salle Jitsi uniques et sécurisés (hash SHA256)
- Mots de passe générés aléatoirement
- JWT signés avec clé secrète

---

## 📊 Structure Base de Données

### Table `live_sessions`
- Informations de la session
- Configuration Jitsi (room_name, server_url, password)
- Statut (scheduled, live, ended, cancelled)
- Dates (scheduled, actual)

### Table `live_session_participants`
- Participants avec leur rôle
- Durée de présence
- Statut (is_present)

### Table `live_session_chat`
- Messages du chat (optionnel)
- Types : text, question, answer

---

## 🚀 Installation

### 1. Exécuter la migration

```bash
mysql -u root -p mdsc_auth < database/migrations/016_create_live_sessions_tables.sql
```

Ou via PowerShell :
```powershell
Get-Content database/migrations/016_create_live_sessions_tables.sql | C:\xampp\mysql\bin\mysql.exe -u root mdsc_auth
```

### 2. Variables d'environnement (optionnel)

Ajouter dans `.env` :
```env
# Jitsi Configuration (optionnel)
JITSI_SERVER_URL=https://meet.jit.si
JITSI_APP_ID=mdsc-app
JITSI_APP_SECRET=your-secret-key
JITSI_DOMAIN=meet.jit.si
```

**Note** : Si non configuré, utilise les valeurs par défaut (meet.jit.si gratuit)

### 3. Redémarrer le serveur

```bash
npm start
# ou
npm run dev
```

---

## 📝 Exemples d'Utilisation

### Créer une session live

```http
POST /api/courses/123/live-sessions
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "Session 1: Introduction",
  "description": "Première session du cours",
  "scheduled_start_at": "2024-03-15T10:00:00Z",
  "scheduled_end_at": "2024-03-15T12:00:00Z",
  "max_participants": 50,
  "is_recording_enabled": true
}
```

### Rejoindre une session

```http
POST /api/live-sessions/1/join
Authorization: Bearer <token>
Content-Type: application/json

{
  "enrollment_id": 456
}
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "jitsi_join_url": "https://meet.jit.si/mdsc-course-123-session-1-abc123?jwt=...",
    "jitsi_room_password": "secure-password",
    "joined_at": "2024-03-15T10:05:00Z"
  }
}
```

### Obtenir les sessions de l'étudiant

```http
GET /api/student/live-sessions
Authorization: Bearer <token>
```

**Réponse** :
```json
{
  "success": true,
  "data": {
    "upcoming": [...],
    "live": [...],
    "past": [...]
  }
}
```

---

## 🔄 Synchronisation Calendrier

Les sessions live sont automatiquement incluses dans le calendrier via :

```
GET /api/calendar/events?start=2024-03-01&end=2024-03-31
```

Les sessions apparaissent avec `type: 'live_session'` et incluent :
- Titre de la session
- Titre du cours
- Dates de début/fin
- Statut (scheduled, live, ended)
- URL vers la page de la session

---

## ✅ Fonctionnalités Implémentées

### ✅ Backend Complet
- [x] CRUD des sessions live
- [x] Gestion des participants
- [x] Génération JWT Jitsi
- [x] URLs de connexion sécurisées
- [x] Vérifications de sécurité
- [x] Synchronisation calendrier
- [x] Sessions étudiant (upcoming, live, past)

### ✅ Intégration
- [x] Routes intégrées dans server.js
- [x] Calendrier mis à jour
- [x] Service Jitsi fonctionnel

---

## 🎯 Prochaines Étapes (Frontend)

1. Créer les types TypeScript (`src/types/liveSession.ts`)
2. Créer le service API (`src/lib/services/liveSessionService.ts`)
3. Créer les composants React
4. Intégrer Jitsi Meet SDK
5. Créer les pages Next.js

---

## 📚 Configuration Jitsi

### Serveur par défaut (gratuit)
- URL : `https://meet.jit.si`
- Pas de configuration requise
- Limite : ~75 participants simultanés

### Serveur self-hosted (production)
- Nécessite installation Jitsi Meet
- Configuration dans `.env`
- Pas de limite de participants

---

## ⚠️ Notes Importantes

1. **JWT Jitsi** : Nécessite `JITSI_APP_SECRET` dans `.env` (ou utilise `JWT_SECRET` par défaut)

2. **Permissions** : Les instructeurs ont automatiquement le rôle `instructor` dans Jitsi (modérateur)

3. **Participants** : Vérification automatique de l'inscription au cours

4. **Calendrier** : Les sessions live sont automatiquement synchronisées

5. **Statuts** : 
   - `scheduled` : Planifiée
   - `live` : En cours
   - `ended` : Terminée
   - `cancelled` : Annulée

---

## 🧪 Tests Recommandés

1. ✅ Créer une session live
2. ✅ Rejoindre une session (étudiant)
3. ✅ Démarrer/terminer une session (instructeur)
4. ✅ Vérifier le calendrier (sessions incluses)
5. ✅ Générer un JWT Jitsi
6. ✅ Vérifier les permissions (instructeur vs participant)

---

*Document créé le : 2025-01-XX*
*Backend implémenté et prêt ✅*

