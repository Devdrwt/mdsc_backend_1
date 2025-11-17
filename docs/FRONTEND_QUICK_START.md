# 🚀 Quick Start : Intégration Calendrier/Progression

## Installation Rapide

### 1. Récupérer le Planning d'un Cours

```typescript
// Exemple avec React + Axios
import { useEffect, useState } from 'react';
import api from '@/lib/api';

const CourseSchedule = ({ courseId }) => {
  const [schedule, setSchedule] = useState([]);
  
  useEffect(() => {
    api.get(`/api/student/schedule/${courseId}`)
      .then(res => setSchedule(res.data.data.schedule))
      .catch(err => console.error(err));
  }, [courseId]);
  
  return (
    <div>
      {schedule.map(item => (
        <div key={item.id}>
          {item.title} - {new Date(item.scheduled_date).toLocaleDateString()}
        </div>
      ))}
    </div>
  );
};
```

### 2. Afficher les Événements dans le Calendrier

```typescript
// Exemple avec FullCalendar
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';

const MyCalendar = () => {
  const [events, setEvents] = useState([]);
  
  useEffect(() => {
    api.get('/api/calendar')
      .then(res => {
        const formatted = res.data.data.map(e => ({
          id: e.id,
          title: e.title,
          start: e.start_date,
          end: e.end_date
        }));
        setEvents(formatted);
      });
  }, []);
  
  return <FullCalendar plugins={[dayGridPlugin]} events={events} />;
};
```

### 3. Rafraîchir après Complétion

```typescript
const completeLesson = async (enrollmentId, lessonId) => {
  await api.post(`/api/progress/${enrollmentId}/lessons/${lessonId}/complete`);
  
  // Le backend met à jour automatiquement le planning
  // Rafraîchir l'affichage
  window.location.reload(); // Ou mieux : mettre à jour l'état
};
```

## 🎨 Couleurs par Type

```typescript
const getEventColor = (type) => {
  const colors = {
    'course_start': '#3B82F6',    // Bleu
    'quiz_scheduled': '#F59E0B',  // Orange
    'announcement': '#10B981',     // Vert
    'deadline': '#EF4444'         // Rouge
  };
  return colors[type] || '#6B7280';
};
```

## 📱 Composant Réutilisable

```typescript
// components/ScheduleItem.tsx
export const ScheduleItem = ({ item }) => {
  const statusColors = {
    pending: 'gray',
    completed: 'green',
    overdue: 'red'
  };
  
  return (
    <div className={`schedule-item ${item.status}`}>
      <h4>{item.title}</h4>
      <p>{new Date(item.scheduled_date).toLocaleString()}</p>
      <Badge color={statusColors[item.status]}>
        {item.status}
      </Badge>
    </div>
  );
};
```


