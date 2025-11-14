# 📋 Briefing Frontend : Intégration Synchronisation Calendrier ↔ Progression

## 🎯 Vue d'Ensemble

Ce document décrit comment intégrer la fonctionnalité de synchronisation automatique entre le suivi de progression des cours et le calendrier de l'étudiant.

**Fonctionnalités principales** :
- ✅ Génération automatique du planning lors de l'inscription
- ✅ Synchronisation bidirectionnelle progression ↔ calendrier
- ✅ Détection automatique des retards
- ✅ Création automatique de milestones (fin de module)

---

## 🔌 Endpoints API Disponibles

### 1. Récupérer le Planning d'un Cours

**Endpoint** : `GET /api/student/schedule/:courseId`

**Authentification** : Requise (Token JWT)

**Paramètres** :
- `courseId` (path) : ID du cours

**Réponse Succès (200)** :
```json
{
  "success": true,
  "data": {
    "enrollment_id": 123,
    "course_id": 45,
    "schedule": [
      {
        "id": 1,
        "type": "lesson",
        "title": "Introduction à React",
        "scheduled_date": "2025-11-14T09:00:00.000Z",
        "duration_minutes": 30,
        "priority": "medium",
        "status": "pending",
        "completed_at": null,
        "event_id": 10,
        "lesson_id": 101,
        "quiz_id": null,
        "module_id": 3,
        "metadata": {
          "module_order": 1,
          "lesson_order": 1
        }
      },
      {
        "id": 2,
        "type": "quiz",
        "title": "Quiz Module 1",
        "scheduled_date": "2025-11-20T10:00:00.000Z",
        "duration_minutes": 20,
        "priority": "high",
        "status": "pending",
        "completed_at": null,
        "event_id": 11,
        "lesson_id": null,
        "quiz_id": 5,
        "module_id": 3,
        "metadata": {
          "module_order": 1,
          "passing_score": 70
        }
      },
      {
        "id": 3,
        "type": "milestone",
        "title": "Module 1",
        "scheduled_date": "2025-11-21T09:00:00.000Z",
        "duration_minutes": 0,
        "priority": "medium",
        "status": "completed",
        "completed_at": "2025-11-20T15:30:00.000Z",
        "event_id": 12,
        "lesson_id": null,
        "quiz_id": null,
        "module_id": 3,
        "metadata": {
          "milestone_type": "module_completion",
          "module_title": "Introduction",
          "auto_created": true
        }
      }
    ]
  }
}
```

**Types de statuts** :
- `pending` : En attente
- `in_progress` : En cours
- `completed` : Complété
- `skipped` : Ignoré
- `overdue` : En retard

**Types d'items** :
- `lesson` : Session d'apprentissage
- `quiz` : Quiz à passer
- `deadline` : Date limite
- `reminder` : Rappel
- `milestone` : Étape importante (fin de module, etc.)

**Priorités** :
- `low` : Faible
- `medium` : Moyenne
- `high` : Élevée
- `urgent` : Urgente

---

### 2. Récupérer les Événements du Calendrier

**Endpoint** : `GET /api/calendar`

**Authentification** : Requise (Token JWT)

**Query Parameters** :
- `start` (optionnel) : Date de début (ISO 8601)
- `end` (optionnel) : Date de fin (ISO 8601)
- `type` (optionnel) : Type d'événement
- `upcoming` (optionnel) : `true` pour seulement les événements à venir

**Réponse** :
```json
{
  "success": true,
  "data": [
    {
      "id": 10,
      "title": "📚 Introduction à React",
      "description": "Session d'apprentissage : Introduction à React\nDurée estimée : 30 minutes",
      "event_type": "course_start",
      "start_date": "2025-11-14T09:00:00.000Z",
      "end_date": "2025-11-14T09:30:00.000Z",
      "is_all_day": false,
      "location": null,
      "is_public": false,
      "course": {
        "id": 45,
        "title": "Marketing Digital",
        "slug": "marketing-digital"
      },
      "created_by": {
        "id": 1,
        "first_name": "System",
        "last_name": "Auto",
        "email": "system@mdsc.com",
        "role": "admin"
      },
      "created_at": "2025-11-13T10:00:00.000Z",
      "updated_at": "2025-11-13T10:00:00.000Z"
    }
  ]
}
```

**Note** : Les événements générés automatiquement ont `auto_sync: true` (non exposé dans l'API mais présent en base).

---

## 🔄 Flux d'Intégration

### 1. Lors de l'Inscription à un Cours

**Déclencheur** : L'utilisateur s'inscrit à un cours via `POST /api/enrollments/enroll`

**Comportement Backend** :
- ✅ Inscription créée
- ✅ Planning automatique généré
- ✅ Événements calendrier créés automatiquement

**Action Frontend** :
- Afficher un message de confirmation
- Optionnel : Rediriger vers la page du cours
- Optionnel : Afficher une notification "Planning généré"

**Exemple de Code** :
```typescript
// Après inscription réussie
const handleEnrollment = async (courseId: number) => {
  try {
    const response = await api.post('/api/enrollments/enroll', { courseId });
    
    if (response.data.success) {
      // Afficher notification
      showNotification({
        type: 'success',
        title: 'Inscription réussie',
        message: 'Votre planning d\'apprentissage a été généré automatiquement !'
      });
      
      // Optionnel : Récupérer le planning
      const schedule = await api.get(`/api/student/schedule/${courseId}`);
      // Afficher le planning dans l'interface
    }
  } catch (error) {
    // Gérer l'erreur
  }
};
```

---

### 2. Affichage du Planning dans le Calendrier

**Recommandation** : Utiliser une bibliothèque de calendrier (ex: FullCalendar, React Big Calendar, etc.)

**Données à afficher** :
- Tous les événements du calendrier (via `/api/calendar`)
- Filtrer par cours si nécessaire
- Différencier visuellement les types d'événements

**Exemple avec FullCalendar** :
```typescript
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';

const CalendarView = () => {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    fetchEvents();
  }, []);
  
  const fetchEvents = async () => {
    const response = await api.get('/api/calendar', {
      params: {
        start: startDate,
        end: endDate
      }
    });
    
    const formattedEvents = response.data.data.map(event => ({
      id: event.id,
      title: event.title,
      start: event.start_date,
      end: event.end_date,
      backgroundColor: getEventColor(event.event_type),
      borderColor: getEventColor(event.event_type),
      extendedProps: {
        type: event.event_type,
        course: event.course,
        status: event.status // Si disponible
      }
    }));
    
    setEvents(formattedEvents);
  };
  
  const getEventColor = (eventType: string) => {
    const colors = {
      'course_start': '#3B82F6',      // Bleu pour les leçons
      'quiz_scheduled': '#F59E0B',    // Orange pour les quiz
      'announcement': '#10B981',       // Vert pour les milestones
      'deadline': '#EF4444'            // Rouge pour les deadlines
    };
    return colors[eventType] || '#6B7280';
  };
  
  return (
    <FullCalendar
      plugins={[dayGridPlugin, timeGridPlugin]}
      initialView="timeGridWeek"
      events={events}
      eventClick={(info) => handleEventClick(info)}
    />
  );
};
```

---

### 3. Affichage du Planning dans la Vue Cours

**Recommandation** : Afficher une section "Planning" dans la page de détail du cours

**Exemple de Composant** :
```typescript
const CourseSchedule = ({ courseId }: { courseId: number }) => {
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchSchedule();
  }, [courseId]);
  
  const fetchSchedule = async () => {
    try {
      const response = await api.get(`/api/student/schedule/${courseId}`);
      setSchedule(response.data.data.schedule);
    } catch (error) {
      console.error('Erreur récupération planning:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) return <LoadingSpinner />;
  
  return (
    <div className="course-schedule">
      <h3>📅 Planning d'Apprentissage</h3>
      
      <div className="schedule-stats">
        <StatCard 
          label="Total" 
          value={schedule.length} 
        />
        <StatCard 
          label="Complétés" 
          value={schedule.filter(s => s.status === 'completed').length} 
        />
        <StatCard 
          label="En retard" 
          value={schedule.filter(s => s.status === 'overdue').length}
          variant="error"
        />
      </div>
      
      <div className="schedule-list">
        {schedule.map((item) => (
          <ScheduleItem 
            key={item.id} 
            item={item}
            onComplete={() => fetchSchedule()} // Rafraîchir après complétion
          />
        ))}
      </div>
    </div>
  );
};

const ScheduleItem = ({ item, onComplete }) => {
  const getStatusBadge = (status: string) => {
    const badges = {
      'pending': { label: 'En attente', color: 'gray' },
      'in_progress': { label: 'En cours', color: 'blue' },
      'completed': { label: 'Complété', color: 'green' },
      'overdue': { label: 'En retard', color: 'red' },
      'skipped': { label: 'Ignoré', color: 'gray' }
    };
    return badges[status] || badges.pending;
  };
  
  const getTypeIcon = (type: string) => {
    const icons = {
      'lesson': '📚',
      'quiz': '📝',
      'deadline': '⏰',
      'reminder': '🔔',
      'milestone': '🎯'
    };
    return icons[type] || '📅';
  };
  
  const badge = getStatusBadge(item.status);
  
  return (
    <div className={`schedule-item ${item.status}`}>
      <div className="schedule-item-header">
        <span className="schedule-item-icon">{getTypeIcon(item.type)}</span>
        <h4>{item.title}</h4>
        <Badge color={badge.color}>{badge.label}</Badge>
      </div>
      
      <div className="schedule-item-details">
        <p>
          <CalendarIcon /> 
          {format(new Date(item.scheduled_date), 'dd/MM/yyyy à HH:mm')}
        </p>
        {item.duration_minutes > 0 && (
          <p>
            <ClockIcon /> 
            {item.duration_minutes} minutes
          </p>
        )}
        {item.priority === 'high' || item.priority === 'urgent' && (
          <p className="priority-high">⚠️ Priorité {item.priority}</p>
        )}
      </div>
      
      {item.status === 'pending' && item.type === 'lesson' && (
        <button 
          onClick={() => navigateToLesson(item.lesson_id)}
          className="btn-primary"
        >
          Commencer la leçon
        </button>
      )}
      
      {item.status === 'overdue' && (
        <div className="overdue-warning">
          ⚠️ Cet élément est en retard. Voulez-vous le replanifier ?
        </div>
      )}
    </div>
  );
};
```

---

### 4. Synchronisation lors de la Complétion d'une Leçon

**Déclencheur** : L'utilisateur complète une leçon

**Comportement Backend** :
- ✅ Leçon marquée comme complétée
- ✅ Schedule item mis à jour automatiquement
- ✅ Événement calendrier mis à jour
- ✅ Milestone créé si module terminé

**Action Frontend** :
- Rafraîchir le planning après complétion
- Afficher une notification de succès
- Mettre à jour la progression du cours

**Exemple de Code** :
```typescript
const completeLesson = async (enrollmentId: number, lessonId: number) => {
  try {
    // Marquer la leçon comme complétée
    await api.post(`/api/progress/${enrollmentId}/lessons/${lessonId}/complete`, {
      time_spent: timeSpentInSeconds
    });
    
    // Rafraîchir le planning
    const scheduleResponse = await api.get(`/api/student/schedule/${courseId}`);
    setSchedule(scheduleResponse.data.data.schedule);
    
    // Afficher notification
    showNotification({
      type: 'success',
      title: 'Leçon terminée !',
      message: 'Votre planning a été mis à jour automatiquement.'
    });
    
    // Vérifier si un milestone a été créé
    const newMilestones = scheduleResponse.data.data.schedule.filter(
      item => item.type === 'milestone' && 
              item.status === 'completed' && 
              new Date(item.completed_at) > new Date(Date.now() - 5000) // Créé dans les 5 dernières secondes
    );
    
    if (newMilestones.length > 0) {
      showNotification({
        type: 'success',
        title: '🎯 Milestone atteint !',
        message: `Félicitations ! Vous avez terminé le module "${newMilestones[0].metadata.module_title}"`
      });
    }
  } catch (error) {
    console.error('Erreur complétion leçon:', error);
  }
};
```

---

## 🎨 Recommandations UI/UX

### 1. Indicateurs Visuels

**Couleurs par Type** :
- 📚 **Leçons** : Bleu (`#3B82F6`)
- 📝 **Quiz** : Orange (`#F59E0B`)
- ⏰ **Deadlines** : Rouge (`#EF4444`)
- 🔔 **Rappels** : Jaune (`#FCD34D`)
- 🎯 **Milestones** : Vert (`#10B981`)

**Badges de Statut** :
- `pending` : Gris clair
- `in_progress` : Bleu
- `completed` : Vert avec checkmark ✓
- `overdue` : Rouge avec icône d'alerte ⚠️
- `skipped` : Gris avec icône barrée

### 2. Affichage dans le Calendrier

**Recommandations** :
- Afficher les événements avec leur couleur respective
- Afficher un indicateur si l'événement est en retard
- Permettre le clic pour voir les détails
- Afficher la progression (% complété) si disponible

**Exemple de Tooltip** :
```typescript
const EventTooltip = ({ event }) => (
  <div className="event-tooltip">
    <h4>{event.title}</h4>
    <p>{event.description}</p>
    {event.course && (
      <p className="course-name">📚 {event.course.title}</p>
    )}
    {event.status === 'overdue' && (
      <p className="overdue-alert">⚠️ En retard</p>
    )}
    {event.status === 'completed' && (
      <p className="completed-badge">✅ Complété</p>
    )}
  </div>
);
```

### 3. Notifications

**Moments clés pour afficher des notifications** :
- ✅ Planning généré après inscription
- ✅ Leçon complétée → Planning mis à jour
- ⚠️ Élément en retard détecté
- 🎯 Milestone atteint (fin de module)
- 📝 Rappel 24h avant un quiz

---

## 📊 Exemples de Données

### Structure d'un Schedule Item

```typescript
interface ScheduleItem {
  id: number;
  type: 'lesson' | 'quiz' | 'deadline' | 'reminder' | 'milestone';
  title: string;
  scheduled_date: string; // ISO 8601
  duration_minutes: number;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'skipped' | 'overdue';
  completed_at: string | null; // ISO 8601
  event_id: number | null;
  lesson_id: number | null;
  quiz_id: number | null;
  module_id: number | null;
  metadata: {
    module_order?: number;
    lesson_order?: number;
    passing_score?: number;
    milestone_type?: string;
    module_title?: string;
    auto_created?: boolean;
  } | null;
}
```

### Structure d'un Événement Calendrier

```typescript
interface CalendarEvent {
  id: number;
  title: string;
  description: string;
  event_type: 'course_start' | 'quiz_scheduled' | 'announcement' | 'deadline';
  start_date: string; // ISO 8601
  end_date: string; // ISO 8601
  is_all_day: boolean;
  location: string | null;
  is_public: boolean;
  course: {
    id: number;
    title: string;
    slug: string;
  } | null;
  created_by: {
    id: number;
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  } | null;
  created_at: string;
  updated_at: string;
}
```

---

## 🔍 Cas d'Usage Spécifiques

### 1. Vue Dashboard Étudiant

**Affichage recommandé** :
- Section "Planning de la Semaine" avec les prochains événements
- Section "Éléments en Retard" (si présents)
- Section "Prochaines Sessions" (3-5 prochaines leçons)

```typescript
const StudentDashboard = () => {
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [overdueItems, setOverdueItems] = useState([]);
  
  useEffect(() => {
    fetchUpcomingEvents();
    fetchOverdueItems();
  }, []);
  
  const fetchUpcomingEvents = async () => {
    const response = await api.get('/api/calendar', {
      params: {
        upcoming: true,
        start: new Date().toISOString(),
        end: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    });
    setUpcomingEvents(response.data.data);
  };
  
  const fetchOverdueItems = async () => {
    // Récupérer tous les cours de l'étudiant
    const coursesResponse = await api.get('/api/student/courses');
    const courses = coursesResponse.data.data;
    
    // Pour chaque cours, récupérer le planning et filtrer les items en retard
    const overdue = [];
    for (const course of courses) {
      const scheduleResponse = await api.get(`/api/student/schedule/${course.course_id}`);
      const overdueItems = scheduleResponse.data.data.schedule.filter(
        item => item.status === 'overdue'
      );
      overdue.push(...overdueItems.map(item => ({ ...item, course })));
    }
    setOverdueItems(overdue);
  };
  
  return (
    <div className="student-dashboard">
      {overdueItems.length > 0 && (
        <Alert variant="warning">
          <h4>⚠️ {overdueItems.length} élément(s) en retard</h4>
          <ul>
            {overdueItems.map(item => (
              <li key={item.id}>
                {item.title} - {item.course.title}
              </li>
            ))}
          </ul>
        </Alert>
      )}
      
      <section className="upcoming-events">
        <h3>📅 Prochaines Sessions</h3>
        <EventList events={upcomingEvents} />
      </section>
    </div>
  );
};
```

### 2. Vue Détail Cours

**Affichage recommandé** :
- Onglet "Planning" avec la liste complète des items
- Indicateur de progression globale
- Graphique de progression (optionnel)

### 3. Vue Calendrier Global

**Affichage recommandé** :
- Vue mensuelle/semaine/jour
- Filtres par cours
- Filtres par type d'événement
- Légende des couleurs

---

## ⚠️ Points d'Attention

### 1. Gestion des Erreurs

```typescript
const fetchSchedule = async (courseId: number) => {
  try {
    const response = await api.get(`/api/student/schedule/${courseId}`);
    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      // L'étudiant n'est pas inscrit ou le planning n'existe pas encore
      console.warn('Planning non disponible');
      return null;
    }
    throw error;
  }
};
```

### 2. Rafraîchissement des Données

**Recommandation** : Rafraîchir le planning après :
- Complétion d'une leçon
- Complétion d'un quiz
- Modification manuelle d'un événement (si implémenté)

### 3. Performance

**Optimisation** :
- Mettre en cache le planning (5-10 minutes)
- Utiliser la pagination si le planning est très long
- Charger les événements du calendrier par période (mois/semaine)

### 4. Timezone

**Important** : Les dates sont en UTC. Convertir selon le timezone de l'utilisateur :

```typescript
import { format, parseISO } from 'date-fns';
import { utcToZonedTime } from 'date-fns-tz';

const formatDateForUser = (utcDate: string, timezone: string) => {
  const zonedDate = utcToZonedTime(parseISO(utcDate), timezone);
  return format(zonedDate, 'dd/MM/yyyy à HH:mm');
};
```

---

## 🧪 Tests Recommandés

### Scénarios à Tester

1. **Inscription à un cours** :
   - Vérifier que le planning est généré
   - Vérifier que les événements apparaissent dans le calendrier

2. **Complétion d'une leçon** :
   - Vérifier que l'item est marqué comme complété
   - Vérifier que l'événement calendrier est mis à jour
   - Vérifier la création d'un milestone si module terminé

3. **Détection de retard** :
   - Vérifier que les items en retard sont détectés
   - Vérifier l'affichage des notifications

4. **Affichage calendrier** :
   - Vérifier que tous les types d'événements s'affichent
   - Vérifier les couleurs et icônes
   - Vérifier les tooltips et détails

---

## 📚 Ressources Utiles

### Bibliothèques Recommandées

- **Calendrier** :
  - [FullCalendar](https://fullcalendar.io/) (React, Vue, Angular)
  - [React Big Calendar](http://jquense.github.io/react-big-calendar/)
  - [Calendarize](https://calendarize.it/) (React)

- **Dates** :
  - [date-fns](https://date-fns.org/) (Formatage de dates)
  - [date-fns-tz](https://github.com/marnusw/date-fns-tz) (Gestion timezone)

- **Notifications** :
  - [react-toastify](https://fkhadra.github.io/react-toastify/)
  - [react-hot-toast](https://react-hot-toast.com/)

---

## ✅ Checklist d'Intégration

- [ ] Endpoint `/api/student/schedule/:courseId` intégré
- [ ] Endpoint `/api/calendar` intégré
- [ ] Affichage du planning dans la vue cours
- [ ] Affichage des événements dans le calendrier
- [ ] Synchronisation après complétion de leçon
- [ ] Gestion des items en retard
- [ ] Notifications pour les milestones
- [ ] Gestion des erreurs
- [ ] Tests des scénarios principaux
- [ ] Optimisation des performances

---

## 📞 Support

Pour toute question ou problème d'intégration, contacter l'équipe backend.

**Documentation API complète** : Voir `/docs/api` (si disponible)

**Exemples de code** : Voir `/docs/examples` (si disponible)


