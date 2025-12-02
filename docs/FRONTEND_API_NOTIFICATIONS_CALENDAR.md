# Guide API Frontend : Notifications, Rappels et Calendrier

Ce document explique comment le frontend doit récupérer les notifications, rappels et événements du calendrier depuis l'API backend.

---

## 📧 1. NOTIFICATIONS ET RAPPELS

### 1.1. Récupérer toutes les notifications

**Endpoint :** `GET /api/notifications`

**Authentification :** Requis (token JWT dans les headers)

**Paramètres de requête :**
- `page` (optionnel) : Numéro de page (défaut: 1)
- `limit` (optionnel) : Nombre d'éléments par page (défaut: 20, max: 100)
- `type` (optionnel) : Filtrer par type (`info`, `success`, `warning`, `error`, `course`, `reminder`, etc.)
- `is_read` (optionnel) : Filtrer par statut de lecture (`true` ou `false`)

**Exemple de requête :**
```javascript
// Récupérer toutes les notifications non lues
const response = await fetch('/api/notifications?is_read=false&limit=20', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});

const data = await response.json();
// data.data.notifications contient la liste des notifications
// data.data.pagination contient les infos de pagination
```

**Exemple de réponse :**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": 1,
        "title": "Rappel de cours",
        "message": "Vous n'avez pas accédé à votre cours depuis 3 jours",
        "type": "reminder",
        "is_read": false,
        "action_url": "/learn/123",
        "metadata": {
          "courseId": 123,
          "courseTitle": "Nom du cours",
          "daysInactive": 3
        },
        "created_at": "2025-12-02T08:00:00.000Z",
        "read_at": null,
        "expires_at": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 5,
      "pages": 1
    }
  }
}
```

### 1.2. Marquer une notification comme lue

**Endpoint :** `PUT /api/notifications/:id/read`

**Exemple :**
```javascript
await fetch(`/api/notifications/${notificationId}/read`, {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Réponse :**
```json
{
  "success": true,
  "message": "Notification marquée comme lue"
}
```

### 1.3. Marquer toutes les notifications comme lues

**Endpoint :** `PUT /api/notifications/read-all`

**Exemple :**
```javascript
await fetch('/api/notifications/read-all', {
  method: 'PUT',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

### 1.4. Supprimer une notification

**Endpoint :** `DELETE /api/notifications/:id`

**Exemple :**
```javascript
await fetch(`/api/notifications/${notificationId}`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

---

## 📅 2. ÉVÉNEMENTS DU CALENDRIER

### 2.1. Récupérer tous les événements

**Endpoint :** `GET /api/calendar`

**Authentification :** Requis (token JWT dans les headers)

**Paramètres de requête :**
- `start` (optionnel) : Date de début (ISO 8601) - Filtrer les événements à partir de cette date
- `end` (optionnel) : Date de fin (ISO 8601) - Filtrer les événements jusqu'à cette date
- `type` (optionnel) : Filtrer par type d'événement
- `upcoming` (optionnel) : `true` pour les événements à venir uniquement, `false` pour les événements passés

**Exemple de requête :**
```javascript
// Récupérer tous les événements du mois en cours
const startDate = new Date(2025, 11, 1).toISOString(); // 1er décembre 2025
const endDate = new Date(2025, 11, 31).toISOString(); // 31 décembre 2025

const response = await fetch(
  `/api/calendar?start=${startDate}&end=${endDate}`,
  {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  }
);

const data = await response.json();
// data.data contient un tableau d'événements
```

**Exemple de réponse :**
```json
{
  "success": true,
  "data": [
    {
      "id": "event-1",
      "title": "Session de formation",
      "description": "Description de l'événement",
      "event_type": "workshop",
      "start_date": "2025-12-15T10:00:00.000Z",
      "end_date": "2025-12-15T12:00:00.000Z",
      "is_all_day": false,
      "location": "Salle de conférence A",
      "is_public": true,
      "type": "event",
      "course": {
        "id": 123,
        "title": "Nom du cours",
        "slug": "nom-du-cours"
      },
      "created_by": {
        "id": 5,
        "first_name": "Jean",
        "last_name": "Dupont",
        "email": "jean.dupont@example.com",
        "role": "instructor"
      },
      "created_at": "2025-12-01T08:00:00.000Z",
      "updated_at": "2025-12-01T08:00:00.000Z"
    },
    {
      "id": "live-session-2",
      "title": "Session Live : Introduction",
      "description": "Session en direct pour le cours",
      "event_type": "live_session",
      "start_date": "2025-12-20T14:00:00.000Z",
      "end_date": "2025-12-20T16:00:00.000Z",
      "is_all_day": false,
      "location": null,
      "is_public": false,
      "type": "live_session",
      "status": "scheduled",
      "course": {
        "id": 456,
        "title": "Autre cours",
        "slug": "autre-cours"
      },
      "instructor": {
        "first_name": "Marie",
        "last_name": "Martin",
        "email": "marie.martin@example.com"
      },
      "url": "/courses/456/live-sessions/2"
    }
  ]
}
```

**Types d'événements retournés :**
- **`event`** : Événements généraux créés par les administrateurs/instructeurs
- **`live_session`** : Sessions en direct liées à un cours

### 2.2. Récupérer un événement spécifique

**Endpoint :** `GET /api/calendar/:id`

**Note :** L'ID doit être l'ID numérique sans le préfixe `event-` ou `live-session-`

**Exemple :**
```javascript
// Pour récupérer l'événement avec id="event-1", utiliser :
const response = await fetch('/api/calendar/1', {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

**Réponse :**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "title": "Session de formation",
    "description": "Description de l'événement",
    "event_type": "workshop",
    "start_date": "2025-12-15T10:00:00.000Z",
    "end_date": "2025-12-15T12:00:00.000Z",
    "is_all_day": false,
    "location": "Salle de conférence A",
    "is_public": true,
    "course": {
      "id": 123,
      "title": "Nom du cours",
      "slug": "nom-du-cours"
    },
    "created_by": {
      "id": 5,
      "first_name": "Jean",
      "last_name": "Dupont",
      "email": "jean.dupont@example.com",
      "role": "instructor"
    },
    "created_at": "2025-12-01T08:00:00.000Z",
    "updated_at": "2025-12-01T08:00:00.000Z"
  }
}
```

---

## 🔐 3. AUTHENTIFICATION

Toutes les routes nécessitent une authentification via token JWT. Le token doit être inclus dans le header `Authorization` :

```javascript
headers: {
  'Authorization': `Bearer ${token}`,
  'Content-Type': 'application/json'
}
```

---

## 📝 4. EXEMPLES D'UTILISATION COMPLETS

### 4.1. Service React pour les notifications

```javascript
// services/notificationService.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const notificationService = {
  // Récupérer les notifications
  async getNotifications(filters = {}) {
    const { page = 1, limit = 20, type, is_read } = filters;
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
      ...(type && { type }),
      ...(is_read !== undefined && { is_read: is_read.toString() })
    });

    const response = await fetch(`${API_BASE_URL}/notifications?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des notifications');
    }

    return response.json();
  },

  // Marquer comme lue
  async markAsRead(notificationId) {
    const response = await fetch(
      `${API_BASE_URL}/notifications/${notificationId}/read`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors du marquage de la notification');
    }

    return response.json();
  },

  // Marquer toutes comme lues
  async markAllAsRead() {
    const response = await fetch(`${API_BASE_URL}/notifications/read-all`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors du marquage des notifications');
    }

    return response.json();
  },

  // Supprimer une notification
  async deleteNotification(notificationId) {
    const response = await fetch(
      `${API_BASE_URL}/notifications/${notificationId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Erreur lors de la suppression de la notification');
    }

    return response.json();
  }
};
```

### 4.2. Service React pour le calendrier

```javascript
// services/calendarService.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export const calendarService = {
  // Récupérer les événements
  async getEvents(filters = {}) {
    const { start, end, type, upcoming } = filters;
    const params = new URLSearchParams();
    
    if (start) params.append('start', start);
    if (end) params.append('end', end);
    if (type) params.append('type', type);
    if (upcoming !== undefined) params.append('upcoming', upcoming.toString());

    const response = await fetch(`${API_BASE_URL}/calendar?${params}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération des événements');
    }

    return response.json();
  },

  // Récupérer un événement spécifique
  async getEventById(eventId) {
    // Extraire l'ID numérique si nécessaire
    const numericId = eventId.replace(/^(event-|live-session-)/, '');
    
    const response = await fetch(`${API_BASE_URL}/calendar/${numericId}`, {
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Erreur lors de la récupération de l\'événement');
    }

    return response.json();
  }
};
```

### 4.3. Hook React pour les notifications

```javascript
// hooks/useNotifications.js
import { useState, useEffect } from 'react';
import { notificationService } from '../services/notificationService';

export const useNotifications = (filters = {}) => {
  const [notifications, setNotifications] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        setLoading(true);
        const response = await notificationService.getNotifications(filters);
        setNotifications(response.data.notifications);
        setPagination(response.data.pagination);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchNotifications();
  }, [filters]);

  const markAsRead = async (notificationId) => {
    try {
      await notificationService.markAsRead(notificationId);
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
      );
    } catch (err) {
      console.error('Erreur lors du marquage:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (err) {
      console.error('Erreur lors du marquage:', err);
    }
  };

  return {
    notifications,
    pagination,
    loading,
    error,
    markAsRead,
    markAllAsRead
  };
};
```

### 4.4. Hook React pour le calendrier

```javascript
// hooks/useCalendar.js
import { useState, useEffect } from 'react';
import { calendarService } from '../services/calendarService';

export const useCalendar = (filters = {}) => {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchEvents = async () => {
      try {
        setLoading(true);
        const response = await calendarService.getEvents(filters);
        setEvents(response.data);
        setError(null);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchEvents();
  }, [filters]);

  return { events, loading, error };
};
```

---

## ⚠️ 5. NOTES IMPORTANTES

### Rappels automatiques

Les rappels de cours sont actuellement envoyés uniquement par **email** via le scheduler automatique. Ils sont enregistrés dans la table `course_reminder_logs` mais **ne créent pas automatiquement de notifications** dans la table `notifications`.

Si vous souhaitez afficher les rappels dans l'interface utilisateur, deux options :

1. **Modifier le service de rappels** pour créer des notifications lors de l'envoi
2. **Créer un endpoint spécifique** qui récupère les rappels depuis `course_reminder_logs`

### Permissions des événements

Les événements retournés incluent :
- Les événements publics (`is_public = true`)
- Les événements créés par l'utilisateur connecté
- Les événements liés aux cours auxquels l'utilisateur est inscrit

### Format des dates

Toutes les dates sont retournées au format ISO 8601 (ex: `2025-12-15T10:00:00.000Z`).

---

## 🔗 6. RÉFÉRENCES

- Routes de notifications : `src/routes/notificationRoutes.js`
- Contrôleur de notifications : `src/controllers/notificationController.js`
- Routes du calendrier : `src/routes/calendarRoutes.js`
- Contrôleur du calendrier : `src/controllers/calendarController.js`

