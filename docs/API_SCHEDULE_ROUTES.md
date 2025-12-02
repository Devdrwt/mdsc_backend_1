# Routes API pour le Planning (Schedule)

## 📍 Routes disponibles

### 1. Récupérer le planning d'un cours

**Endpoint :** `GET /api/courses/:courseId/schedule`

**Authentification :** Requis (token JWT)

**Paramètres :**
- `courseId` (dans l'URL) : ID du cours

**Description :** Retourne le planning d'un cours incluant les sessions live programmées et les événements du calendrier liés au cours.

**Réponse succès (200) :**
```json
{
  "success": true,
  "data": {
    "course_id": 66,
    "course_title": "Introduction à JavaScript",
    "schedule": [
      {
        "id": 1,
        "title": "Session Live : Introduction",
        "description": "Première session en direct",
        "type": "live_session",
        "start_date": "2025-12-15T10:00:00.000Z",
        "end_date": "2025-12-15T12:00:00.000Z",
        "status": "scheduled",
        "max_participants": 50,
        "is_recording_enabled": true,
        "instructor": {
          "first_name": "Jean",
          "last_name": "Dupont",
          "email": "jean.dupont@example.com"
        }
      },
      {
        "id": 2,
        "title": "Atelier pratique",
        "description": "Atelier de codage",
        "type": "event",
        "event_type": "workshop",
        "start_date": "2025-12-20T14:00:00.000Z",
        "end_date": "2025-12-20T17:00:00.000Z",
        "is_all_day": false,
        "location": "Salle de conférence A",
        "is_public": true,
        "created_by": {
          "first_name": "Marie",
          "last_name": "Martin"
        }
      }
    ],
    "live_sessions": [
      {
        "id": 1,
        "title": "Session Live : Introduction",
        "type": "live_session",
        "start_date": "2025-12-15T10:00:00.000Z",
        "end_date": "2025-12-15T12:00:00.000Z",
        "status": "scheduled"
      }
    ],
    "events": [
      {
        "id": 2,
        "title": "Atelier pratique",
        "type": "event",
        "start_date": "2025-12-20T14:00:00.000Z",
        "end_date": "2025-12-20T17:00:00.000Z"
      }
    ]
  }
}
```

**Réponses d'erreur :**
- `401` : Non authentifié
- `404` : Cours non trouvé
- `500` : Erreur serveur

---

### 2. Récupérer le planning d'un étudiant pour un cours

**Endpoint :** `GET /api/student/schedule/:courseId`

**Authentification :** Requis (token JWT, rôle étudiant ou admin)

**Paramètres :**
- `courseId` (dans l'URL) : ID du cours

**Description :** Retourne le planning d'un étudiant pour un cours spécifique. Inclut les sessions live avec les informations de participation de l'étudiant (si présent, date de connexion, etc.) et les événements du calendrier.

**Réponse succès (200) :**
```json
{
  "success": true,
  "data": {
    "course_id": 66,
    "course_title": "Introduction à JavaScript",
    "schedule": [
      {
        "id": 1,
        "title": "Session Live : Introduction",
        "description": "Première session en direct",
        "type": "live_session",
        "start_date": "2025-12-15T10:00:00.000Z",
        "end_date": "2025-12-15T12:00:00.000Z",
        "status": "scheduled",
        "max_participants": 50,
        "is_recording_enabled": true,
        "joined_at": "2025-12-15T10:05:00.000Z",
        "is_present": true,
        "instructor": {
          "first_name": "Jean",
          "last_name": "Dupont",
          "email": "jean.dupont@example.com"
        }
      }
    ],
    "live_sessions": [...],
    "events": [...]
  }
}
```

**Réponses d'erreur :**
- `400` : Identifiant de cours invalide
- `401` : Non authentifié
- `403` : Accès réservé aux étudiants
- `404` : Vous n'êtes pas inscrit à ce cours
- `500` : Erreur serveur

---

## 📝 Exemples d'utilisation

### JavaScript/Fetch

```javascript
// Récupérer le planning d'un cours
const getCourseSchedule = async (courseId) => {
  const response = await fetch(`/api/courses/${courseId}/schedule`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};

// Récupérer le planning d'un étudiant pour un cours
const getStudentSchedule = async (courseId) => {
  const response = await fetch(`/api/student/schedule/${courseId}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
};
```

### Axios

```javascript
import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

// Planning d'un cours
const courseSchedule = await api.get(`/courses/${courseId}/schedule`);

// Planning d'un étudiant
const studentSchedule = await api.get(`/student/schedule/${courseId}`);
```

---

## 📊 Structure des données

### Live Session
```typescript
{
  id: number;
  title: string;
  description: string;
  type: "live_session";
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  status: "scheduled" | "live" | "ended" | "cancelled";
  max_participants: number;
  is_recording_enabled: boolean;
  instructor: {
    first_name: string;
    last_name: string;
    email: string;
  };
  // Pour /api/student/schedule/:courseId uniquement :
  joined_at?: string; // ISO 8601
  is_present?: boolean;
}
```

### Event
```typescript
{
  id: number;
  title: string;
  description: string;
  type: "event";
  event_type: string;
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  is_all_day: boolean;
  location: string | null;
  is_public: boolean;
  created_by: {
    first_name: string;
    last_name: string;
  } | null;
}
```

---

## ⚠️ Notes importantes

1. **Ordre des routes** : La route `/:courseId/schedule` est placée avant la route `/:id` dans `courseRoutes.js` pour éviter les conflits de routage.

2. **Filtrage des événements** : 
   - Pour `/api/courses/:courseId/schedule` : Retourne les événements publics ou créés par l'utilisateur connecté
   - Pour `/api/student/schedule/:courseId` : Retourne les événements publics ou créés par l'étudiant

3. **Sessions live** : Seules les sessions avec le statut `scheduled` ou `live` sont retournées.

4. **Tri** : Le tableau `schedule` est trié par date de début croissante.

---

## 🔗 Fichiers concernés

- Routes : 
  - `src/routes/courseRoutes.js` (route `/api/courses/:courseId/schedule`)
  - `src/routes/studentDashboardRoutes.js` (route `/api/student/schedule/:courseId`)
- Contrôleurs : 
  - `src/controllers/courseController.js` (fonction `getCourseSchedule`)
  - `src/controllers/studentDashboardController.js` (fonction `getStudentSchedule`)

