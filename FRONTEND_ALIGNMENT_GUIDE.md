# 🎯 Guide d'Alignement Frontend - Architecture Cours MdSC

## 📋 Vue d'Ensemble

Ce document détaille **TOUTES les modifications nécessaires** côté frontend pour qu'il s'aligne parfaitement avec le nouveau backend implémenté selon l'architecture des cours.

---

## 🆕 Nouvelles Routes API Disponibles

### **Modules**
```typescript
GET    /api/modules/courses/:courseId/modules
GET    /api/modules/:id
POST   /api/modules/courses/:courseId/modules
PUT    /api/modules/:id
DELETE /api/modules/:id
POST   /api/modules/:id/unlock (Admin)
GET    /api/modules/courses/:courseId/unlock-status
```

### **Médias & Upload**
```typescript
POST   /api/media/upload (multipart/form-data)
POST   /api/media/upload-bulk
GET    /api/media/:id
GET    /api/media/lesson/:lessonId
GET    /api/media/course/:courseId
GET    /api/media/:id/download
DELETE /api/media/:id
```

### **Badges**
```typescript
GET    /api/badges
GET    /api/badges/:id
GET    /api/badges/user/my-badges
GET    /api/badges/:id/check-eligibility
POST   /api/badges/check-and-award
POST   /api/badges/award (Admin)
```

### **Progression**
```typescript
GET    /api/progress/enrollment/:enrollmentId
GET    /api/progress/course/:courseId
GET    /api/progress/lesson/:lessonId
PUT    /api/progress/enrollment/:enrollmentId/lesson/:lessonId
POST   /api/progress/enrollment/:enrollmentId/lesson/:lessonId/complete
```

### **Cours (Nouvelles Routes)**
```typescript
GET    /api/courses/slug/:slug
GET    /api/courses/popular
GET    /api/courses/recommended
GET    /api/courses/:id/check-enrollment
```

### **Certificats (Nouvelle Route)**
```typescript
GET    /api/certificates/verify/:code (PUBLIQUE - pas besoin d'auth)
```

### **Inscriptions (Mis à Jour)**
```typescript
POST   /api/enrollments - Maintenant vérifie les prérequis automatiquement
```

### **Quizzes (Mis à Jour)**
```typescript
POST   /api/quizzes/:id/attempt
PUT    /api/quizzes/attempts/:attemptId - Accepte maintenant JSON answers
```

---

## 📦 Types & Interfaces TypeScript

### **À Créer/Mettre à Jour**

#### `types/course.ts`
```typescript
export interface Course {
  id: number;
  title: string;
  slug: string; // NOUVEAU
  description: string;
  category_id: number;
  category_name?: string;
  category_color?: string;
  level: 'debutant' | 'intermediaire' | 'avance';
  duration_minutes: number;
  language: string;
  thumbnail_url?: string;
  instructor_id: number;
  instructor_first_name?: string;
  instructor_last_name?: string;
  prerequisite_course_id?: number; // NOUVEAU
  prerequisite_title?: string; // NOUVEAU
  is_published: boolean;
  enrollment_count: number;
  rating: number;
  average_rating?: number;
  review_count?: number;
  created_at: string;
  updated_at: string;
  modules?: Module[]; // NOUVEAU
}

export interface Module {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  order_index: number;
  is_unlocked: boolean;
  created_at: string;
  updated_at: string;
  lessons_count?: number;
  lessons?: Lesson[];
}
```

#### `types/lesson.ts`
```typescript
export interface Lesson {
  id: number;
  course_id: number;
  module_id?: number; // NOUVEAU
  title: string;
  content_type: 'video' | 'text' | 'quiz' | 'h5p' | 'forum' | 'assignment' | 'document' | 'audio' | 'presentation'; // NOUVEAU
  media_file_id?: number; // NOUVEAU
  content_url?: string; // NOUVEAU
  content_text?: string; // NOUVEAU
  description?: string;
  content?: string; // Pour type 'text'
  video_url?: string; // Déprécié, utiliser content_url
  duration_minutes: number;
  order_index: number;
  is_required: boolean; // NOUVEAU
  is_published: boolean;
  created_at: string;
  updated_at: string;
  module_title?: string;
  module_order?: number;
  media_url?: string;
  thumbnail_url?: string;
  file_category?: string;
  quiz_id?: number;
}
```

#### `types/enrollment.ts`
```typescript
export interface Enrollment {
  id: number;
  user_id: number;
  course_id: number;
  status: 'enrolled' | 'in_progress' | 'completed' | 'certified'; // NOUVEAU
  progress_percentage: number;
  enrolled_at: string;
  started_at?: string; // NOUVEAU
  completed_at?: string;
  course_title?: string;
}
```

#### `types/progress.ts` (NOUVEAU)
```typescript
export interface Progress {
  id: number;
  enrollment_id: number;
  lesson_id: number;
  status: 'not_started' | 'in_progress' | 'completed';
  completion_percentage: number;
  time_spent: number; // en secondes
  completed_at?: string;
}

export interface CourseProgressStats {
  progress_percentage: number;
  enrollment_status: string;
  total_lessons: number;
  completed_lessons: number;
}
```

#### `types/media.ts` (NOUVEAU)
```typescript
export interface MediaFile {
  id: number;
  lesson_id?: number;
  course_id?: number;
  filename: string;
  original_filename: string;
  file_type: string; // MIME type
  file_category: 'video' | 'document' | 'audio' | 'image' | 'presentation' | 'h5p' | 'other';
  file_size: number; // en bytes
  storage_type: 'minio' | 's3' | 'local';
  storage_path: string;
  url: string;
  thumbnail_url?: string;
  duration?: number; // Pour vidéos/audio (secondes)
  metadata?: Record<string, any>;
  uploaded_by: number;
  uploaded_at: string;
}
```

#### `types/badge.ts` (NOUVEAU)
```typescript
export interface Badge {
  id: number;
  name: string;
  description?: string;
  icon_url?: string;
  category?: string;
  criteria: {
    type: string;
    [key: string]: any;
  };
  created_at: string;
}

export interface UserBadge extends Badge {
  earned_at: string;
}
```

#### `types/certificate.ts` (MIS À JOUR)
```typescript
export interface Certificate {
  id: number;
  user_id: number;
  course_id: number;
  certificate_code: string; // NOUVEAU - Pour QR code
  certificate_number: string;
  pdf_url?: string;
  qr_code_url?: string; // NOUVEAU
  issued_at: string;
  expires_at?: string; // NOUVEAU
  verified?: boolean; // NOUVEAU
  is_valid: boolean;
  course_title?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}
```

#### `types/quiz.ts` (MIS À JOUR)
```typescript
export interface Quiz {
  id: number;
  course_id?: number;
  lesson_id?: number;
  title: string;
  description?: string;
  passing_score: number;
  max_attempts: number;
  time_limit_minutes?: number;
  is_final: boolean; // NOUVEAU
  is_published: boolean;
  created_at: string;
  question_count?: number;
  best_score?: number;
  is_passed?: boolean;
}

export interface QuizAttempt {
  id: number;
  user_id: number;
  quiz_id: number;
  answers: Record<string, any>; // NOUVEAU - Format JSON {questionId: answer}
  score?: number;
  total_points?: number;
  percentage?: number;
  is_passed: boolean;
  completed_at?: string;
  time_spent_minutes?: number;
}
```

---

## 🔧 Services API Frontend

### **1. Service Modules (`services/moduleService.ts`) - NOUVEAU**

```typescript
import api from './api';

export const moduleService = {
  // Récupérer tous les modules d'un cours
  getCourseModules: async (courseId: number) => {
    const response = await api.get(`/modules/courses/${courseId}/modules`);
    return response.data;
  },

  // Récupérer un module par ID
  getModule: async (moduleId: number) => {
    const response = await api.get(`/modules/${moduleId}`);
    return response.data;
  },

  // Créer un module
  createModule: async (courseId: number, data: {
    title: string;
    description?: string;
    order_index: number;
  }) => {
    const response = await api.post(`/modules/courses/${courseId}/modules`, data);
    return response.data;
  },

  // Mettre à jour un module
  updateModule: async (moduleId: number, data: {
    title?: string;
    description?: string;
    order_index?: number;
    is_unlocked?: boolean;
  }) => {
    const response = await api.put(`/modules/${moduleId}`, data);
    return response.data;
  },

  // Supprimer un module
  deleteModule: async (moduleId: number) => {
    const response = await api.delete(`/modules/${moduleId}`);
    return response.data;
  },

  // Déverrouiller un module (Admin)
  unlockModule: async (moduleId: number) => {
    const response = await api.post(`/modules/${moduleId}/unlock`);
    return response.data;
  },

  // Obtenir le statut de déverrouillage des modules d'un cours
  getModulesUnlockStatus: async (courseId: number) => {
    const response = await api.get(`/modules/courses/${courseId}/unlock-status`);
    return response.data;
  }
};
```

### **2. Service Médias (`services/mediaService.ts`) - NOUVEAU**

```typescript
import api from './api';

export const mediaService = {
  // Upload un fichier
  uploadFile: async (
    file: File,
    options: {
      lesson_id?: number;
      course_id?: number;
      file_category: 'video' | 'document' | 'audio' | 'image' | 'presentation' | 'h5p' | 'other';
    }
  ) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('file_category', options.file_category);
    if (options.lesson_id) formData.append('lesson_id', options.lesson_id.toString());
    if (options.course_id) formData.append('course_id', options.course_id.toString());

    const response = await api.post('/media/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  // Upload multiple fichiers
  uploadBulkFiles: async (files: File[], options: {...}) => {
    const formData = new FormData();
    files.forEach((file, index) => {
      formData.append(`files[${index}]`, file);
    });
    // ... autres options

    const response = await api.post('/media/upload-bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
  },

  // Récupérer un fichier média
  getMediaFile: async (mediaId: number) => {
    const response = await api.get(`/media/${mediaId}`);
    return response.data;
  },

  // Récupérer les fichiers d'une leçon
  getLessonMediaFiles: async (lessonId: number) => {
    const response = await api.get(`/media/lesson/${lessonId}`);
    return response.data;
  },

  // Récupérer les fichiers d'un cours
  getCourseMediaFiles: async (courseId: number) => {
    const response = await api.get(`/media/course/${courseId}`);
    return response.data;
  },

  // Télécharger un fichier
  downloadMediaFile: async (mediaId: number, filename?: string) => {
    const response = await api.get(`/media/${mediaId}/download`, {
      responseType: 'blob',
    });
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename || 'file');
    document.body.appendChild(link);
    link.click();
    link.remove();
  },

  // Supprimer un fichier
  deleteMediaFile: async (mediaId: number) => {
    const response = await api.delete(`/media/${mediaId}`);
    return response.data;
  }
};
```

### **3. Service Badges (`services/badgeService.ts`) - NOUVEAU**

```typescript
import api from './api';

export const badgeService = {
  // Récupérer tous les badges
  getAllBadges: async () => {
    const response = await api.get('/badges');
    return response.data;
  },

  // Récupérer un badge par ID
  getBadge: async (badgeId: number) => {
    const response = await api.get(`/badges/${badgeId}`);
    return response.data;
  },

  // Récupérer les badges de l'utilisateur
  getUserBadges: async () => {
    const response = await api.get('/badges/user/my-badges');
    return response.data;
  },

  // Vérifier l'éligibilité à un badge
  checkBadgeEligibility: async (badgeId: number) => {
    const response = await api.get(`/badges/${badgeId}/check-eligibility`);
    return response.data;
  },

  // Vérifier et attribuer automatiquement les badges
  checkAndAwardBadges: async () => {
    const response = await api.post('/badges/check-and-award');
    return response.data;
  }
};
```

### **4. Service Progression (`services/progressService.ts`) - NOUVEAU**

```typescript
import api from './api';

export const progressService = {
  // Récupérer la progression d'une inscription
  getEnrollmentProgress: async (enrollmentId: number) => {
    const response = await api.get(`/progress/enrollment/${enrollmentId}`);
    return response.data;
  },

  // Récupérer la progression d'un cours
  getCourseProgress: async (courseId: number) => {
    const response = await api.get(`/progress/course/${courseId}`);
    return response.data;
  },

  // Récupérer la progression d'une leçon
  getLessonProgress: async (lessonId: number) => {
    const response = await api.get(`/progress/lesson/${lessonId}`);
    return response.data;
  },

  // Mettre à jour la progression d'une leçon
  updateLessonProgress: async (
    enrollmentId: number,
    lessonId: number,
    data: {
      status: 'not_started' | 'in_progress' | 'completed';
      completion_percentage: number;
      time_spent: number;
    }
  ) => {
    const response = await api.put(
      `/progress/enrollment/${enrollmentId}/lesson/${lessonId}`,
      data
    );
    return response.data;
  },

  // Marquer une leçon comme complétée
  markLessonCompleted: async (
    enrollmentId: number,
    lessonId: number,
    timeSpent?: number
  ) => {
    const response = await api.post(
      `/progress/enrollment/${enrollmentId}/lesson/${lessonId}/complete`,
      { timeSpent }
    );
    return response.data;
  }
};
```

### **5. Service Cours (`services/courseService.ts`) - MIS À JOUR**

```typescript
// Ajouter ces nouvelles méthodes :

// Récupérer un cours par slug
getCourseBySlug: async (slug: string) => {
  const response = await api.get(`/courses/slug/${slug}`);
  return response.data;
},

// Récupérer les cours populaires
getPopularCourses: async (limit = 10) => {
  const response = await api.get(`/courses/popular?limit=${limit}`);
  return response.data;
},

// Récupérer les cours recommandés
getRecommendedCourses: async (limit = 10) => {
  const response = await api.get(`/courses/recommended?limit=${limit}`);
  return response.data;
},

// Vérifier si l'utilisateur est inscrit
checkEnrollment: async (courseId: number) => {
  const response = await api.get(`/courses/${courseId}/check-enrollment`);
  return response.data;
},
```

### **6. Service Certificats (`services/certificateService.ts`) - MIS À JOUR**

```typescript
// Ajouter cette méthode :

// Vérifier un certificat par code (PUBLIQUE - pas besoin d'auth)
verifyCertificate: async (code: string) => {
  const response = await api.get(`/certificates/verify/${code}`);
  return response.data;
},
```

### **7. Service Inscriptions (`services/enrollmentService.ts`) - MIS À JOUR**

```typescript
// Modifier la méthode d'inscription pour gérer les prérequis :

enrollInCourse: async (courseId: number) => {
  try {
    const response = await api.post('/enrollments', { course_id: courseId });
    return response.data;
  } catch (error: any) {
    // Si erreur 400 avec prerequisite_course_id, afficher message
    if (error.response?.status === 400 && error.response?.data?.prerequisite_course_id) {
      throw {
        ...error,
        prerequisite_course_id: error.response.data.prerequisite_course_id,
        message: error.response.data.message
      };
    }
    throw error;
  }
},
```

### **8. Service Quizzes (`services/quizService.ts`) - MIS À JOUR**

```typescript
// Modifier submitQuizAttempt pour envoyer JSON answers :

submitQuizAttempt: async (attemptId: number, answers: Record<number, any>) => {
  // Convertir en format {questionId: answer}
  const answersFormat: Record<string, any> = {};
  Object.keys(answers).forEach(questionId => {
    answersFormat[questionId] = answers[questionId];
  });

  const response = await api.put(`/quizzes/attempts/${attemptId}`, {
    answers: answersFormat
  });
  return response.data;
},
```

---

## 🎨 Composants Frontend à Créer/Mettre à Jour

### **1. Composant CourseCard** (MIS À JOUR)
- Afficher le `slug` au lieu de l'ID pour les liens
- Afficher les prérequis si `prerequisite_title` existe
- Utiliser `/courses/[slug]` au lieu de `/courses/[id]`

### **2. Composant CourseDetail** (MIS À JOUR)
- Utiliser `getCourseBySlug` au lieu de `getCourseById`
- Afficher la structure modulaire (`modules` → `lessons`)
- Vérifier les prérequis avant l'inscription
- Afficher le statut de déverrouillage des modules

### **3. Composant ModuleList** (NOUVEAU)
```typescript
// Affiche la liste des modules avec leur statut de déverrouillage
interface ModuleListProps {
  courseId: number;
  modules: Module[];
  enrollmentId?: number;
}
```

### **4. Composant LessonPlayer** (MIS À JOUR)
- Gérer tous les `content_type` :
  - `video` : Lire depuis `content_url` ou `media_url`
  - `text` : Afficher `content_text` ou `content`
  - `document` : Télécharger ou afficher PDF
  - `quiz` : Afficher le quiz associé
  - `h5p` : Intégrer le contenu H5P
  - etc.
- Envoyer la progression automatiquement
- Marquer comme complété à la fin

### **5. Composant MediaUploader** (NOUVEAU)
```typescript
// Permet l'upload de fichiers médias
interface MediaUploaderProps {
  lessonId?: number;
  courseId?: number;
  fileCategory: 'video' | 'document' | 'audio' | 'image' | 'presentation' | 'h5p';
  onUploadSuccess: (mediaFile: MediaFile) => void;
  onUploadError: (error: Error) => void;
}
```

### **6. Composant BadgeDisplay** (NOUVEAU)
```typescript
// Affiche les badges de l'utilisateur
interface BadgeDisplayProps {
  userId: number;
  showEarnedOnly?: boolean;
}
```

### **7. Composant ProgressBar** (MIS À JOUR)
- Utiliser `progressService.getCourseProgress` pour la progression d'un cours
- Afficher la progression par module

### **8. Composant CertificateDisplay** (MIS À JOUR)
- Afficher le QR code si `qr_code_url` existe
- Permettre la vérification publique via `certificate_code`

### **9. Composant QuizAttempt** (MIS À JOUR)
- Envoyer les réponses au format JSON : `{questionId: answer}`
- Gérer `is_final` pour les quiz finaux
- Afficher la génération automatique du certificat après quiz final réussi

---

## 📄 Pages/Routes Frontend à Créer/Mettre à Jour

### **1. `/courses/[slug]`** (MIS À JOUR)
- Utiliser le slug au lieu de l'ID
- Afficher la structure modulaire
- Vérifier l'inscription avec `checkEnrollment`

### **2. `/learn/[courseId]`** (MIS À JOUR)
- Afficher les modules et leçons dans l'ordre
- Gérer le déverrouillage progressif
- Suivre la progression en temps réel

### **3. `/learn/[courseId]/module/[moduleId]`** (NOUVEAU)
- Page dédiée à un module
- Afficher toutes les leçons du module
- Indicateur de progression du module

### **4. `/learn/[courseId]/lesson/[lessonId]`** (MIS À JOUR)
- Gérer tous les types de contenu (`content_type`)
- Player vidéo si `content_type === 'video'`
- Lecteur PDF si `content_type === 'document'`
- Editeur texte si `content_type === 'text'`
- Quiz intégré si `content_type === 'quiz'`

### **5. `/badges`** (NOUVEAU)
- Liste de tous les badges disponibles
- Badges obtenus par l'utilisateur
- Critères d'obtention

### **6. `/profile/badges`** (NOUVEAU)
- Mes badges
- Badges manquants
- Statistiques

### **7. `/verify-certificate/[code]`** (NOUVEAU)
- Page publique de vérification de certificat
- Afficher les détails du certificat vérifié
- QR code scannable

### **8. `/instructor/courses/[courseId]/modules`** (NOUVEAU)
- Gestion des modules d'un cours (CRUD)
- Réorganisation par drag & drop

### **9. `/instructor/courses/[courseId]/lessons/[lessonId]/media`** (NOUVEAU)
- Upload de fichiers médias pour une leçon
- Gestion des fichiers existants

---

## 🔄 Logique Métier Frontend

### **1. Déverrouillage Progressif des Modules**

```typescript
// Dans un hook personnalisé
const useModuleUnlock = (courseId: number, enrollmentId: number) => {
  const [modules, setModules] = useState<Module[]>([]);

  useEffect(() => {
    const checkUnlocks = async () => {
      // Récupérer la progression
      const progress = await progressService.getEnrollmentProgress(enrollmentId);
      
      // Vérifier quels modules doivent être déverrouillés
      const updatedModules = modules.map(module => {
        if (module.order_index === 0) {
          return { ...module, is_unlocked: true };
        }
        
        // Vérifier si le module précédent est complété
        const prevModule = modules.find(m => m.order_index === module.order_index - 1);
        if (prevModule) {
          const prevModuleLessons = progress.filter(p => 
            lessons.find(l => l.module_id === prevModule.id && l.id === p.lesson_id)
          );
          const allCompleted = prevModuleLessons.every(p => p.status === 'completed');
          return { ...module, is_unlocked: allCompleted };
        }
        
        return module;
      });
      
      setModules(updatedModules);
    };

    if (enrollmentId) checkUnlocks();
  }, [enrollmentId, modules]);

  return modules;
};
```

### **2. Gestion des Prérequis**

```typescript
// Avant l'inscription
const handleEnroll = async (course: Course) => {
  if (course.prerequisite_course_id) {
    // Vérifier si le prérequis est complété
    const prerequisiteCheck = await enrollmentService.checkEnrollment(
      course.prerequisite_course_id
    );
    
    if (!prerequisiteCheck.is_enrolled || 
        prerequisiteCheck.enrollment.status !== 'completed') {
      // Afficher message + rediriger vers le prérequis
      toast.error(
        `Vous devez d'abord compléter: ${course.prerequisite_title}`
      );
      router.push(`/courses/${course.prerequisite_slug}`);
      return;
    }
  }
  
  // Procéder à l'inscription
  try {
    await enrollmentService.enrollInCourse(course.id);
  } catch (error: any) {
    if (error.prerequisite_course_id) {
      toast.error(error.message);
    }
  }
};
```

### **3. Suivi de Progression Automatique**

```typescript
// Dans LessonPlayer
useEffect(() => {
  const trackProgress = async () => {
    if (!enrollmentId || !lessonId) return;
    
    // Mettre à jour toutes les 10 secondes
    const interval = setInterval(async () => {
      await progressService.updateLessonProgress(enrollmentId, lessonId, {
        status: 'in_progress',
        completion_percentage: currentProgress,
        time_spent: timeSpent
      });
    }, 10000);
    
    return () => clearInterval(interval);
  };
  
  trackProgress();
}, [enrollmentId, lessonId]);

// À la fin de la leçon
const handleLessonComplete = async () => {
  await progressService.markLessonCompleted(enrollmentId, lessonId, timeSpent);
  // Déverrouiller le module suivant si nécessaire
};
```

### **4. Attribution Automatique de Badges**

```typescript
// Après certaines actions importantes
const checkForBadges = async () => {
  await badgeService.checkAndAwardBadges();
  
  // Écouter les nouveaux badges (via WebSocket ou polling)
  const userBadges = await badgeService.getUserBadges();
  // Afficher notification si nouveau badge
};
```

### **5. Upload de Fichiers avec Validation**

```typescript
const handleFileUpload = async (
  file: File,
  category: 'video' | 'document' | 'audio' | 'image' | 'presentation' | 'h5p'
) => {
  // Validation de taille
  const maxSizes = {
    video: 500 * 1024 * 1024, // 500MB
    document: 50 * 1024 * 1024, // 50MB
    audio: 100 * 1024 * 1024, // 100MB
    presentation: 100 * 1024 * 1024,
    h5p: 200 * 1024 * 1024,
    image: 10 * 1024 * 1024 // 10MB
  };
  
  if (file.size > maxSizes[category]) {
    throw new Error(`Fichier trop volumineux. Maximum: ${maxSizes[category] / 1024 / 1024}MB`);
  }
  
  // Validation MIME type
  const allowedTypes = {
    video: ['video/mp4', 'video/webm', 'video/quicktime'],
    document: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
    // ... etc
  };
  
  if (!allowedTypes[category].includes(file.type)) {
    throw new Error(`Type de fichier non autorisé pour ${category}`);
  }
  
  // Upload
  const result = await mediaService.uploadFile(file, {
    lesson_id,
    course_id,
    file_category: category
  });
  
  return result;
};
```

### **6. Affichage des Certificats avec QR Code**

```typescript
// Composant CertificateCard
const CertificateCard = ({ certificate }: { certificate: Certificate }) => {
  return (
    <div>
      <h3>{certificate.course_title}</h3>
      {certificate.qr_code_url && (
        <img 
          src={`${API_URL}${certificate.qr_code_url}`} 
          alt="QR Code"
        />
      )}
      <p>Code: {certificate.certificate_code}</p>
      <Link href={`/verify-certificate/${certificate.certificate_code}`}>
        Vérifier le certificat
      </Link>
    </div>
  );
};
```

---

## 📊 Nouvelles Fonctionnalités Frontend

### **1. Dashboard Instructeur - Gestion Modules**
- Créer/modifier/supprimer des modules
- Réorganiser par drag & drop (`order_index`)
- Déverrouiller manuellement des modules (admin)

### **2. Dashboard Instructeur - Upload Médias**
- Upload de vidéos pour les leçons
- Upload de documents PDF
- Upload de présentations
- Prévisualisation avant upload

### **3. Dashboard Étudiant - Progression**
- Vue d'ensemble de la progression par cours
- Progression détaillée par module
- Temps passé par leçon
- Statistiques globales

### **4. Système de Badges**
- Affichage des badges obtenus
- Notification quand un badge est gagné
- Page de tous les badges disponibles
- Critères d'obtention visibles

### **5. Prérequis de Cours**
- Affichage du prérequis sur la carte cours
- Blocage de l'inscription si prérequis non complété
- Message clair pour l'utilisateur
- Lien direct vers le cours prérequis

### **6. Certificats avec QR Code**
- Affichage du QR code sur le certificat
- Page de vérification publique
- Partage du lien de vérification

### **7. Quiz avec JSON Answers**
- Envoi des réponses au format JSON
- Gestion du quiz final
- Génération automatique du certificat après quiz final réussi

---

## ⚠️ Points d'Attention

### **1. Routes avec Slug**
- Remplacer toutes les routes `/courses/:id` par `/courses/:slug`
- Mettre à jour tous les liens dans les composants

### **2. Structure Modulaire**
- Les cours ont maintenant une structure: `Course → Modules → Lessons`
- Mettre à jour l'affichage pour refléter cette hiérarchie

### **3. Statut d'Inscription**
- Utiliser `status: 'enrolled' | 'in_progress' | 'completed' | 'certified'`
- Mettre à jour les badges de statut dans l'UI

### **4. Upload de Fichiers**
- Utiliser `FormData` pour l'upload
- Gérer la progression d'upload pour les gros fichiers
- Afficher une prévisualisation avant upload

### **5. Types de Contenu**
- Adapter le player selon le `content_type`
- Gérer tous les cas: video, text, document, quiz, h5p, etc.

### **6. Déverrouillage Progressif**
- Implémenter la logique de déverrouillage
- Afficher les modules verrouillés différemment
- Message clair pour déverrouiller un module

---

## ✅ Checklist Frontend

- [ ] Créer types TypeScript pour: Module, MediaFile, Badge, Progress
- [ ] Mettre à jour types: Course, Lesson, Enrollment, Certificate, Quiz
- [ ] Créer services: moduleService, mediaService, badgeService, progressService
- [ ] Mettre à jour services: courseService, enrollmentService, certificateService, quizService
- [ ] Créer composants: ModuleList, MediaUploader, BadgeDisplay
- [ ] Mettre à jour composants: CourseCard, CourseDetail, LessonPlayer, ProgressBar, CertificateDisplay, QuizAttempt
- [ ] Mettre à jour route: `/courses/[slug]`
- [ ] Mettre à jour route: `/learn/[courseId]`
- [ ] Créer route: `/learn/[courseId]/module/[moduleId]`
- [ ] Mettre à jour route: `/learn/[courseId]/lesson/[lessonId]`
- [ ] Créer route: `/badges`
- [ ] Créer route: `/profile/badges`
- [ ] Créer route: `/verify-certificate/[code]`
- [ ] Créer route: `/instructor/courses/[courseId]/modules`
- [ ] Créer route: `/instructor/courses/[courseId]/lessons/[lessonId]/media`
- [ ] Implémenter logique de déverrouillage progressif
- [ ] Implémenter gestion des prérequis
- [ ] Implémenter suivi de progression automatique
- [ ] Implémenter attribution automatique de badges
- [ ] Implémenter upload de fichiers avec validation
- [ ] Implémenter affichage certificats avec QR code
- [ ] Tester toutes les nouvelles fonctionnalités

---

## 🎯 Prochaines Étapes

1. **Phase 1 - Types & Services** (Priorité HAUTE)
   - Créer/mettre à jour tous les types TypeScript
   - Créer tous les services API

2. **Phase 2 - Composants de Base** (Priorité HAUTE)
   - ModuleList
   - MediaUploader
   - Mettre à jour CourseCard, CourseDetail

3. **Phase 3 - Pages Principales** (Priorité MOYENNE)
   - Mettre à jour `/courses/[slug]`
   - Mettre à jour `/learn/[courseId]`
   - Créer `/verify-certificate/[code]`

4. **Phase 4 - Fonctionnalités Avancées** (Priorité MOYENNE)
   - Déverrouillage progressif
   - Gestion prérequis
   - Suivi progression

5. **Phase 5 - Dashboard Instructeur** (Priorité BASSE)
   - Gestion modules
   - Upload médias

6. **Phase 6 - Badges & Certificats** (Priorité BASSE)
   - Affichage badges
   - Certificats QR code

---

## 📝 Notes Finales

- **Compatibilité**: Toutes les routes existantes continuent de fonctionner (sauf celles explicitement modifiées)
- **Rétrocompatibilité**: Les champs anciens (`video_url`, etc.) sont toujours supportés mais dépréciés
- **Migration Progressive**: Vous pouvez migrer progressivement les composants existants
- **Tests**: Tester chaque nouvelle fonctionnalité avec le backend avant de déployer

**Le frontend est maintenant prêt à être aligné avec le nouveau backend !** 🚀

