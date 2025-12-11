# 📋 PLAN D'IMPLÉMENTATION - MULTI-FORMATS POUR LES LEÇONS

## 🎯 Objectif Fonctionnel

Permettre aux formateurs d'uploader **3 formats** pour chaque leçon :

- **Vidéo** (obligatoire, format par défaut)
- **PDF** (optionnel, lisible in-app + téléchargeable)
- **Audio** (optionnel)

L'apprenant peut :

- Choisir librement le format (onglets)
- Vidéo affichée par défaut
- Contrôler librement la lecture (pause, avance, recul, vitesse)
- Progression automatique **sans bouton "Marquer Terminé"**

---

## 📊 PHASE 1 : BASE DE DONNÉES (Backend)

### 1.1 Migration de la table `lessons`

**Fichier** : `database/migrations/022_add_multi_formats_to_lessons.sql`

```sql
USE mdsc_auth;

-- Ajouter les colonnes pour les nouveaux formats
ALTER TABLE lessons
  ADD COLUMN pdf_url VARCHAR(500) NULL AFTER video_url,
  ADD COLUMN audio_url VARCHAR(500) NULL AFTER pdf_url,
  ADD COLUMN default_format ENUM('video', 'pdf', 'audio') DEFAULT 'video' AFTER audio_url,
  ADD COLUMN duration_seconds INT NULL COMMENT 'Durée en secondes (pour vidéo/audio)' AFTER duration_minutes;

-- Mettre à jour video_url pour être NOT NULL (obligatoire)
-- Note: Faire attention aux données existantes
ALTER TABLE lessons
  MODIFY COLUMN video_url VARCHAR(500) NOT NULL COMMENT 'URL vidéo obligatoire';

-- Index pour optimiser les requêtes
CREATE INDEX idx_default_format ON lessons(default_format);
```

**Script d'exécution** : `database/run_migration_022.js`

### 1.2 Vérification de la table `lesson_progress`

La table existe déjà avec :

- `is_completed` (BOOLEAN)
- `completed_at` (DATETIME)
- `last_position_seconds` (INT) - pour sauvegarder la position de lecture
- `time_spent_minutes` (INT)

**Ajout recommandé** :

```sql
ALTER TABLE lesson_progress
  ADD COLUMN progress_percentage DECIMAL(5,2) DEFAULT 0.00 COMMENT 'Progression 0-100%',
  ADD COLUMN format_used ENUM('video', 'pdf', 'audio') NULL COMMENT 'Format utilisé pour compléter';
```

---

## 🔧 PHASE 2 : BACKEND - Services & Contrôleurs

### 2.1 Service de gestion des médias (Utilisation du système existant)

**Fichier** : `src/services/mediaService.js` (déjà existant, à étendre)

Le service `mediaService.js` existe déjà et gère les uploads avec multer et stockage local. Nous l'utiliserons pour les nouveaux formats.

**Structure de stockage** :

- Vidéos : `uploads/videos/`
- PDFs : `uploads/documents/`
- Audios : `uploads/audio/`

**Fonction utilitaire à ajouter** :

```javascript
// Dans src/services/mediaService.js

/**
 * Construit l'URL publique d'un fichier uploadé
 * @param {string} filePath - Chemin relatif du fichier (ex: /uploads/videos/filename.mp4)
 */
static buildMediaUrl(filePath) {
  if (!filePath) return null;
  const apiUrl = process.env.API_URL || `http://localhost:${process.env.PORT || 5000}`;
  return filePath.startsWith('http') ? filePath : `${apiUrl}${filePath}`;
}

/**
 * Construit le chemin de stockage pour un fichier de leçon
 * @param {number} courseId
 * @param {number} moduleId
 * @param {number} lessonId
 * @param {string} format - 'video', 'pdf', 'audio'
 */
static getLessonUploadFolder(courseId, moduleId, lessonId, format) {
  const folders = {
    video: 'videos',
    pdf: 'documents',
    audio: 'audio'
  };
  return path.join(__dirname, '../../uploads', folders[format] || 'others');
}
```

### 2.2 Contrôleur d'upload multi-formats

**Fichier** : `src/controllers/lessonMediaController.js` (nouveau)

```javascript
const { pool } = require("../config/database");
const MediaService = require("../services/mediaService");
const multer = require("multer");
const path = require("path");
const fs = require("fs").promises;

// Configuration multer pour upload multi-formats
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const { lessonId } = req.params;
    const format = file.fieldname; // 'video', 'pdf', ou 'audio'

    // Récupérer course_id et module_id depuis la leçon
    const [lessons] = await pool.execute(
      "SELECT course_id, module_id FROM lessons WHERE id = ?",
      [lessonId]
    );

    if (lessons.length === 0) {
      return cb(new Error("Leçon non trouvée"));
    }

    const lesson = lessons[0];
    const uploadDir = MediaService.getLessonUploadFolder(
      lesson.course_id,
      lesson.module_id,
      lessonId,
      format
    );

    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (error) {
      cb(error);
    }
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    const ext = path.extname(file.originalname);
    const format = file.fieldname;
    cb(null, `lesson-${req.params.lessonId}-${format}-${uniqueSuffix}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  const validMimes = {
    video: ["video/mp4", "video/webm", "video/quicktime", "video/x-msvideo"],
    pdf: ["application/pdf"],
    audio: ["audio/mpeg", "audio/mp3", "audio/wav", "audio/mp4", "audio/m4a"],
  };

  const allowedMimes = validMimes[file.fieldname] || [];

  if (allowedMimes.length === 0 || allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Type de fichier non autorisé pour ${
          file.fieldname
        }. Types acceptés: ${allowedMimes.join(", ")}`
      ),
      false
    );
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB max pour vidéos, 150MB pour autres (géré côté frontend)
  },
}).fields([
  { name: "video", maxCount: 1 },
  { name: "pdf", maxCount: 1 },
  { name: "audio", maxCount: 1 },
]);

/**
 * POST /api/instructor/lessons/:lessonId/upload-media
 * Upload des fichiers vidéo, PDF et audio pour une leçon
 */
const uploadLessonMedia = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const instructorId = req.user.userId;
    const { default_format = "video", duration_seconds } = req.body;

    // Vérifier que l'instructeur est propriétaire de la leçon
    const [lessons] = await pool.execute(
      `SELECT l.id, l.course_id, l.module_id, c.instructor_id
       FROM lessons l
       JOIN courses c ON l.course_id = c.id
       WHERE l.id = ? AND c.instructor_id = ?`,
      [lessonId, instructorId]
    );

    if (lessons.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas autorisé à modifier cette leçon",
      });
    }

    // Vérifier que la vidéo est présente (obligatoire)
    if (!req.files || !req.files.video || req.files.video.length === 0) {
      return res.status(400).json({
        success: false,
        message: "La vidéo est obligatoire",
      });
    }

    const lesson = lessons[0];
    const updateFields = [];
    const params = [];

    // Traiter la vidéo (obligatoire)
    const videoFile = req.files.video[0];
    const videoUrl = `/uploads/videos/${videoFile.filename}`;
    updateFields.push("video_url = ?");
    params.push(videoUrl);

    // Sauvegarder dans media_files
    await MediaService.saveMediaFile(
      videoFile,
      "video",
      instructorId,
      lessonId,
      lesson.course_id
    );

    // Traiter le PDF (optionnel)
    if (req.files.pdf && req.files.pdf.length > 0) {
      const pdfFile = req.files.pdf[0];
      const pdfUrl = `/uploads/documents/${pdfFile.filename}`;
      updateFields.push("pdf_url = ?");
      params.push(pdfUrl);

      await MediaService.saveMediaFile(
        pdfFile,
        "document",
        instructorId,
        lessonId,
        lesson.course_id
      );
    } else {
      updateFields.push("pdf_url = ?");
      params.push(null);
    }

    // Traiter l'audio (optionnel)
    if (req.files.audio && req.files.audio.length > 0) {
      const audioFile = req.files.audio[0];
      const audioUrl = `/uploads/audio/${audioFile.filename}`;
      updateFields.push("audio_url = ?");
      params.push(audioUrl);

      await MediaService.saveMediaFile(
        audioFile,
        "audio",
        instructorId,
        lessonId,
        lesson.course_id
      );
    } else {
      updateFields.push("audio_url = ?");
      params.push(null);
    }

    // Mettre à jour default_format et duration
    updateFields.push("default_format = ?");
    params.push(default_format);

    if (duration_seconds !== undefined) {
      updateFields.push("duration_seconds = ?");
      params.push(duration_seconds);
      updateFields.push("duration_minutes = ?");
      params.push(Math.ceil(duration_seconds / 60));
    }

    updateFields.push("updated_at = NOW()");
    params.push(lessonId);

    await pool.execute(
      `UPDATE lessons SET ${updateFields.join(", ")} WHERE id = ?`,
      params
    );

    res.json({
      success: true,
      message: "Médias uploadés avec succès",
      data: {
        video_url: MediaService.buildMediaUrl(videoUrl),
        pdf_url:
          req.files.pdf && req.files.pdf.length > 0
            ? MediaService.buildMediaUrl(
                `/uploads/documents/${req.files.pdf[0].filename}`
              )
            : null,
        audio_url:
          req.files.audio && req.files.audio.length > 0
            ? MediaService.buildMediaUrl(
                `/uploads/audio/${req.files.audio[0].filename}`
              )
            : null,
      },
    });
  } catch (error) {
    console.error("Erreur upload médias:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de l'upload des médias",
    });
  }
};

module.exports = {
  upload,
  uploadLessonMedia,
};
```

### 2.3 Mise à jour du contrôleur de leçons

**Fichier** : `src/controllers/lessonController.js`

**Modifier `getLessonForStudent`** pour inclure les nouveaux formats :

```javascript
// Dans getLessonForStudent, après la récupération de la leçon
const lesson = lessons[0];
const { buildMediaUrl } = require("../utils/media"); // Utiliser la fonction existante

// Construire les URLs des formats disponibles
const formats = {
  video: lesson.video_url ? buildMediaUrl(lesson.video_url) : null,
  pdf: lesson.pdf_url ? buildMediaUrl(lesson.pdf_url) : null,
  audio: lesson.audio_url ? buildMediaUrl(lesson.audio_url) : null,
};

res.json({
  success: true,
  data: {
    id: lesson.id,
    title: lesson.title,
    description: lesson.description,
    formats,
    default_format: lesson.default_format || "video",
    duration_seconds: lesson.duration_seconds,
    duration_minutes: lesson.duration_minutes,
    // ... autres champs existants
  },
});
```

### 2.4 API de progression automatique

**Fichier** : `src/controllers/lessonProgressController.js` (nouveau)

```javascript
const { pool } = require("../config/database");

/**
 * PUT /api/lessons/:lessonId/progress
 * Met à jour la progression d'une leçon
 */
const updateProgress = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id || req.user.userId;
    const { progress_percentage, last_position_seconds, format_used } =
      req.body;

    // Vérifier que l'utilisateur est inscrit au cours
    const [enrollments] = await pool.execute(
      `
      SELECT e.id, e.course_id
      FROM enrollments e
      JOIN lessons l ON l.course_id = e.course_id
      WHERE e.user_id = ? AND l.id = ? AND e.is_active = TRUE
    `,
      [userId, lessonId]
    );

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas inscrit à ce cours",
      });
    }

    const enrollment = enrollments[0];

    // Insérer ou mettre à jour la progression
    await pool.execute(
      `
      INSERT INTO lesson_progress (
        user_id, lesson_id, course_id, progress_percentage,
        last_position_seconds, format_used, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, NOW())
      ON DUPLICATE KEY UPDATE
        progress_percentage = VALUES(progress_percentage),
        last_position_seconds = VALUES(last_position_seconds),
        format_used = VALUES(format_used),
        updated_at = NOW()
    `,
      [
        userId,
        lessonId,
        enrollment.course_id,
        Math.min(100, Math.max(0, progress_percentage || 0)),
        last_position_seconds || 0,
        format_used || null,
      ]
    );

    res.json({
      success: true,
      message: "Progression mise à jour",
    });
  } catch (error) {
    console.error("Erreur mise à jour progression:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la mise à jour",
    });
  }
};

/**
 * PUT /api/lessons/:lessonId/complete
 * Marque une leçon comme complétée
 */
const completeLesson = async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id || req.user.userId;
    const { format_used } = req.body;

    // Vérifier inscription
    const [enrollments] = await pool.execute(
      `
      SELECT e.id, e.course_id
      FROM enrollments e
      JOIN lessons l ON l.course_id = e.course_id
      WHERE e.user_id = ? AND l.id = ? AND e.is_active = TRUE
    `,
      [userId, lessonId]
    );

    if (enrollments.length === 0) {
      return res.status(403).json({
        success: false,
        message: "Vous n'êtes pas inscrit à ce cours",
      });
    }

    const enrollment = enrollments[0];

    // Marquer comme complété
    await pool.execute(
      `
      INSERT INTO lesson_progress (
        user_id, lesson_id, course_id, is_completed,
        completed_at, progress_percentage, format_used, updated_at
      ) VALUES (?, ?, ?, TRUE, NOW(), 100, ?, NOW())
      ON DUPLICATE KEY UPDATE
        is_completed = TRUE,
        completed_at = NOW(),
        progress_percentage = 100,
        format_used = VALUES(format_used),
        updated_at = NOW()
    `,
      [userId, lessonId, enrollment.course_id, format_used || null]
    );

    // Recalculer la progression du cours
    const ProgressService = require("../services/progressService");
    await ProgressService.updateCourseProgress(enrollment.id);

    res.json({
      success: true,
      message: "Leçon complétée",
    });
  } catch (error) {
    console.error("Erreur complétion leçon:", error);
    res.status(500).json({
      success: false,
      message: "Erreur lors de la complétion",
    });
  }
};

module.exports = {
  updateProgress,
  completeLesson,
};
```

### 2.5 Routes

**Fichier** : `src/routes/lessonRoutes.js`

```javascript
// Ajouter après les routes existantes

const lessonMediaController = require("../controllers/lessonMediaController");
const lessonProgressController = require("../controllers/lessonProgressController");

// Route pour upload multi-formats (instructeurs)
router.post(
  "/lessons/:lessonId/upload-media",
  authenticateToken,
  authorize(["instructor", "admin"]),
  lessonMediaController.upload,
  lessonMediaController.uploadLessonMedia
);

// Routes pour progression (étudiants)
router.put(
  "/lessons/:lessonId/progress",
  authenticateToken,
  authorize(["student", "instructor", "admin"]),
  lessonProgressController.updateProgress
);

router.put(
  "/lessons/:lessonId/complete",
  authenticateToken,
  authorize(["student", "instructor", "admin"]),
  lessonProgressController.completeLesson
);
```

---

## 🎨 PHASE 3 : FRONTEND (Next.js)

### 3.1 Composant Player Multi-Formats

**Fichier** : `src/components/lessons/LessonPlayer.tsx` (nouveau)

```typescript
"use client";

import { useState, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import Plyr from "plyr";
import "plyr/dist/plyr.css";

// Import dynamique pour react-pdf (réduit le bundle)
const Document = dynamic(
  () => import("react-pdf").then((mod) => mod.Document),
  { ssr: false }
);
const Page = dynamic(() => import("react-pdf").then((mod) => mod.Page), {
  ssr: false,
});

interface LessonFormats {
  video: string | null;
  pdf: string | null;
  audio: string | null;
}

interface LessonPlayerProps {
  lessonId: number;
  formats: LessonFormats;
  defaultFormat: "video" | "pdf" | "audio";
  durationSeconds?: number;
  onProgress?: (progress: number) => void;
  onComplete?: () => void;
}

export default function LessonPlayer({
  lessonId,
  formats,
  defaultFormat = "video",
  durationSeconds,
  onProgress,
  onComplete,
}: LessonPlayerProps) {
  const [activeFormat, setActiveFormat] = useState<"video" | "pdf" | "audio">(
    defaultFormat
  );
  const [videoProgress, setVideoProgress] = useState(0);
  const [pdfProgress, setPdfProgress] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [numPages, setNumPages] = useState<number>(0);
  const [pageNumber, setPageNumber] = useState(1);

  // Initialiser Plyr pour vidéo
  useEffect(() => {
    if (activeFormat === "video" && videoRef.current && formats.video) {
      const player = new Plyr(videoRef.current, {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "settings",
          "fullscreen",
        ],
        settings: ["speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      });

      player.on("timeupdate", () => {
        if (player.currentTime && player.duration) {
          const progress = (player.currentTime / player.duration) * 100;
          setVideoProgress(progress);
          onProgress?.(progress);

          // Auto-complétion à 95% ou plus
          if (progress >= 95 && !isCompleted) {
            setIsCompleted(true);
            onComplete?.();
          }
        }
      });

      player.on("ended", () => {
        setVideoProgress(100);
        setIsCompleted(true);
        onComplete?.();
      });

      return () => {
        player.destroy();
      };
    }
  }, [activeFormat, formats.video, isCompleted, onProgress, onComplete]);

  // Initialiser Plyr pour audio
  useEffect(() => {
    if (activeFormat === "audio" && audioRef.current && formats.audio) {
      const player = new Plyr(audioRef.current, {
        controls: [
          "play-large",
          "play",
          "progress",
          "current-time",
          "mute",
          "volume",
          "settings",
        ],
        settings: ["speed"],
        speed: { selected: 1, options: [0.5, 0.75, 1, 1.25, 1.5, 2] },
      });

      player.on("timeupdate", () => {
        if (player.currentTime && player.duration) {
          const progress = (player.currentTime / player.duration) * 100;
          setVideoProgress(progress);
          onProgress?.(progress);

          if (progress >= 95 && !isCompleted) {
            setIsCompleted(true);
            onComplete?.();
          }
        }
      });

      player.on("ended", () => {
        setVideoProgress(100);
        setIsCompleted(true);
        onComplete?.();
      });

      return () => {
        player.destroy();
      };
    }
  }, [activeFormat, formats.audio, isCompleted, onProgress, onComplete]);

  // Suivi progression PDF
  useEffect(() => {
    if (activeFormat === "pdf" && numPages > 0) {
      const progress = (pageNumber / numPages) * 100;
      setPdfProgress(progress);
      onProgress?.(progress);

      // Complétion à 80% du PDF
      if (progress >= 80 && !isCompleted) {
        setIsCompleted(true);
        onComplete?.();
      }
    }
  }, [activeFormat, pageNumber, numPages, isCompleted, onProgress, onComplete]);

  // Envoyer progression au backend toutes les 10 secondes
  useEffect(() => {
    const interval = setInterval(async () => {
      const currentProgress =
        activeFormat === "pdf" ? pdfProgress : videoProgress;

      if (currentProgress > 0 && !isCompleted) {
        try {
          await fetch(`/api/lessons/${lessonId}/progress`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              progress_percentage: currentProgress,
              format_used: activeFormat,
            }),
          });
        } catch (error) {
          console.error("Erreur sauvegarde progression:", error);
        }
      }
    }, 10000); // Toutes les 10 secondes

    return () => clearInterval(interval);
  }, [lessonId, activeFormat, videoProgress, pdfProgress, isCompleted]);

  // Marquer comme complété au backend
  const handleComplete = async () => {
    try {
      await fetch(`/api/lessons/${lessonId}/complete`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format_used: activeFormat }),
      });
    } catch (error) {
      console.error("Erreur complétion:", error);
    }
  };

  useEffect(() => {
    if (isCompleted) {
      handleComplete();
    }
  }, [isCompleted]);

  return (
    <div className="lesson-player">
      {/* Onglets de sélection de format */}
      <div className="format-tabs flex gap-2 mb-4">
        <button
          onClick={() => setActiveFormat("video")}
          disabled={!formats.video}
          className={`px-4 py-2 rounded ${
            activeFormat === "video" ? "bg-blue-600 text-white" : "bg-gray-200"
          } ${!formats.video ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          ▶️ Vidéo
        </button>
        <button
          onClick={() => setActiveFormat("pdf")}
          disabled={!formats.pdf}
          className={`px-4 py-2 rounded ${
            activeFormat === "pdf" ? "bg-blue-600 text-white" : "bg-gray-200"
          } ${!formats.pdf ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          📄 PDF
        </button>
        <button
          onClick={() => setActiveFormat("audio")}
          disabled={!formats.audio}
          className={`px-4 py-2 rounded ${
            activeFormat === "audio" ? "bg-blue-600 text-white" : "bg-gray-200"
          } ${!formats.audio ? "opacity-50 cursor-not-allowed" : ""}`}
        >
          🎧 Audio
        </button>
      </div>

      {/* Barre de progression */}
      <div className="progress-bar mb-4">
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-blue-600 h-2 rounded-full transition-all"
            style={{
              width: `${activeFormat === "pdf" ? pdfProgress : videoProgress}%`,
            }}
          />
        </div>
        <div className="flex justify-between mt-1 text-sm text-gray-600">
          <span>
            {Math.round(activeFormat === "pdf" ? pdfProgress : videoProgress)}%
          </span>
          {isCompleted && <span className="text-green-600">✓ Complété</span>}
        </div>
      </div>

      {/* Contenu selon le format */}
      <div className="player-content">
        {activeFormat === "video" && formats.video && (
          <video ref={videoRef} className="w-full" controls>
            <source src={formats.video} type="video/mp4" />
          </video>
        )}

        {activeFormat === "pdf" && formats.pdf && (
          <div className="pdf-viewer">
            <div className="flex justify-between items-center mb-4">
              <button
                onClick={() => setPageNumber((prev) => Math.max(1, prev - 1))}
                disabled={pageNumber <= 1}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Précédent
              </button>
              <span className="text-sm">
                Page {pageNumber} sur {numPages}
              </span>
              <button
                onClick={() =>
                  setPageNumber((prev) => Math.min(numPages, prev + 1))
                }
                disabled={pageNumber >= numPages}
                className="px-4 py-2 bg-gray-200 rounded disabled:opacity-50"
              >
                Suivant
              </button>
              <a
                href={formats.pdf}
                download
                className="px-4 py-2 bg-blue-600 text-white rounded"
              >
                Télécharger PDF
              </a>
            </div>
            <Document
              file={formats.pdf}
              onLoadSuccess={({ numPages }) => setNumPages(numPages)}
              className="flex justify-center"
            >
              <Page pageNumber={pageNumber} width={800} />
            </Document>
          </div>
        )}

        {activeFormat === "audio" && formats.audio && (
          <audio ref={audioRef} className="w-full" controls>
            <source src={formats.audio} type="audio/mpeg" />
          </audio>
        )}
      </div>
    </div>
  );
}
```

### 3.2 Page de lecture de leçon

**Fichier** : `src/app/courses/[courseId]/lessons/[lessonId]/page.tsx`

```typescript
"use client";

import { useEffect, useState } from "react";
import LessonPlayer from "@/components/lessons/LessonPlayer";

export default function LessonPage({
  params,
}: {
  params: { courseId: string; lessonId: string };
}) {
  const [lesson, setLesson] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLesson();
  }, [params.lessonId]);

  const fetchLesson = async () => {
    try {
      const res = await fetch(
        `/api/courses/${params.courseId}/lessons/${params.lessonId}`
      );
      const data = await res.json();
      if (data.success) {
        setLesson(data.data);
      }
    } catch (error) {
      console.error("Erreur chargement leçon:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Chargement...</div>;
  if (!lesson) return <div>Leçon non trouvée</div>;

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-4">{lesson.title}</h1>
      {lesson.description && (
        <p className="text-gray-600 mb-6">{lesson.description}</p>
      )}

      <LessonPlayer
        lessonId={parseInt(params.lessonId)}
        formats={lesson.formats}
        defaultFormat={lesson.default_format}
        durationSeconds={lesson.duration_seconds}
      />
    </div>
  );
}
```

### 3.3 Formulaire d'upload pour formateurs

**Fichier** : `src/components/instructor/LessonMediaUpload.tsx` (nouveau)

```typescript
"use client";

import { useState } from "react";

interface LessonMediaUploadProps {
  lessonId: number;
  courseId: number;
  moduleId: number;
  onSuccess?: () => void;
}

export default function LessonMediaUpload({
  lessonId,
  courseId,
  moduleId,
  onSuccess,
}: LessonMediaUploadProps) {
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [defaultFormat, setDefaultFormat] = useState<"video" | "pdf" | "audio">(
    "video"
  );
  const [uploading, setUploading] = useState(false);

  const handleUpload = async () => {
    if (!videoFile) {
      alert("La vidéo est obligatoire");
      return;
    }

    setUploading(true);

    try {
      // Créer FormData pour l'upload multipart
      const formData = new FormData();
      formData.append("video", videoFile);

      if (pdfFile) {
        formData.append("pdf", pdfFile);
      }

      if (audioFile) {
        formData.append("audio", audioFile);
      }

      formData.append("default_format", defaultFormat);

      // Upload direct vers le backend avec multer
      const res = await fetch(
        `/api/instructor/lessons/${lessonId}/upload-media`,
        {
          method: "POST",
          body: formData,
          // Ne pas mettre Content-Type, le navigateur le fera automatiquement avec boundary
        }
      );

      const data = await res.json();

      if (!data.success) {
        throw new Error(data.message || "Erreur lors de l'upload");
      }

      alert("Upload réussi !");
      onSuccess?.();
    } catch (error) {
      console.error("Erreur upload:", error);
      alert(`Erreur lors de l'upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block mb-2">Vidéo (obligatoire) *</label>
        <input
          type="file"
          accept="video/*"
          onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
          className="w-full"
        />
      </div>

      <div>
        <label className="block mb-2">PDF (optionnel)</label>
        <input
          type="file"
          accept="application/pdf"
          onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
          className="w-full"
        />
      </div>

      <div>
        <label className="block mb-2">Audio (optionnel)</label>
        <input
          type="file"
          accept="audio/*"
          onChange={(e) => setAudioFile(e.target.files?.[0] || null)}
          className="w-full"
        />
      </div>

      <div>
        <label className="block mb-2">Format par défaut</label>
        <select
          value={defaultFormat}
          onChange={(e) => setDefaultFormat(e.target.value as any)}
          className="w-full p-2 border rounded"
        >
          <option value="video">Vidéo</option>
          <option value="pdf">PDF</option>
          <option value="audio">Audio</option>
        </select>
      </div>

      <button
        onClick={handleUpload}
        disabled={!videoFile || uploading}
        className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50"
      >
        {uploading ? "Upload en cours..." : "Uploader"}
      </button>
    </div>
  );
}
```

---

## 📦 PHASE 4 : INSTALLATION & CONFIGURATION

### 4.1 Dépendances Backend

Aucune nouvelle dépendance nécessaire. Le projet utilise déjà :

- `multer` (pour les uploads)
- `fs` (pour la gestion des fichiers)

### 4.2 Dépendances Frontend

```bash
npm install plyr react-pdf pdfjs-dist
```

### 4.3 Configuration des dossiers d'upload

**Backend** : S'assurer que les dossiers existent :

```javascript
// Créer les dossiers si nécessaire
const uploadDirs = ["uploads/videos", "uploads/documents", "uploads/audio"];

uploadDirs.forEach((dir) => {
  const fullPath = path.join(__dirname, "../", dir);
  fs.mkdirSync(fullPath, { recursive: true });
});
```

**Note** : Les dossiers seront créés automatiquement par multer lors du premier upload.

### 4.4 Variables d'environnement

**Backend** (`.env`) - Aucune nouvelle variable nécessaire :

```env
# Utiliser les variables existantes
API_URL=http://localhost:5000
PORT=5000
```

**Configuration serveur statique** : S'assurer que le serveur Express sert les fichiers statiques :

```javascript
// Dans src/server.js (déjà configuré normalement)
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));
```

---

## ✅ PHASE 5 : TESTS & VALIDATION

### 5.1 Tests Backend

- [ ] Migration SQL exécutée sans erreur
- [ ] Upload vidéo fonctionnel
- [ ] Upload PDF fonctionnel
- [ ] Upload audio fonctionnel
- [ ] Upload multiple (vidéo + PDF + audio) fonctionnel
- [ ] Mise à jour base de données correcte (video_url, pdf_url, audio_url)
- [ ] Sauvegarde dans media_files fonctionnelle
- [ ] API progression fonctionnelle
- [ ] Auto-complétion déclenchée
- [ ] URLs des médias accessibles publiquement

### 5.2 Tests Frontend

- [ ] Affichage des 3 formats
- [ ] Changement de format fonctionnel
- [ ] Player vidéo avec contrôles
- [ ] Player audio avec contrôles
- [ ] Viewer PDF avec pagination
- [ ] Téléchargement PDF fonctionnel
- [ ] Progression automatique sauvegardée
- [ ] Complétion automatique déclenchée
- [ ] Pas de bouton "Marquer Terminé" visible

### 5.3 Tests UX

- [ ] Vidéo par défaut au chargement
- [ ] Formats indisponibles grisés
- [ ] Responsive mobile
- [ ] Accessibilité (clavier, lecteurs d'écran)

---

## 🚀 PHASE 6 : DÉPLOIEMENT

### 6.1 Checklist pré-déploiement

- [ ] Migration SQL testée en staging
- [ ] Dossiers uploads créés et accessibles
- [ ] Permissions d'écriture sur les dossiers uploads
- [ ] Serveur Express configuré pour servir les fichiers statiques
- [ ] Variables d'environnement configurées (API_URL)
- [ ] Tests end-to-end réussis
- [ ] Documentation utilisateur mise à jour

### 6.2 Déploiement

1. **Backend** :

   - Exécuter migration SQL
   - Créer les dossiers `uploads/videos`, `uploads/documents`, `uploads/audio`
   - Vérifier les permissions d'écriture
   - Déployer nouveau code
   - Vérifier que `/uploads` est servi correctement

2. **Frontend** :
   - Build production
   - Déployer
   - Vérifier accès aux médias via URLs complètes

---

## 📝 NOTES IMPORTANTES

### Sécurité

- ✅ Vérification des permissions (instructeur propriétaire, étudiant inscrit)
- ✅ Validation des types MIME côté backend
- ✅ Limites de taille de fichiers (500MB pour vidéos, 150MB pour autres)
- ✅ Validation des extensions de fichiers
- ✅ Stockage sécurisé dans dossiers organisés par cours/module/leçon
- ⚠️ **Recommandation** : Pour production, considérer l'ajout d'une authentification pour l'accès aux fichiers (middleware de vérification d'inscription)

### Performance

- ⚠️ Pour production, considérer :
  - Streaming HLS pour vidéos longues
  - CDN pour distribution des médias
  - Compression automatique des vidéos

### Compatibilité

- ✅ Rétrocompatibilité : les leçons existantes avec seulement `video_url` continuent de fonctionner
- ✅ `duration_minutes` conservé pour compatibilité, `duration_seconds` ajouté pour précision

---

## 📅 ESTIMATION TEMPS

| Phase                     | Durée estimée        |
| ------------------------- | -------------------- |
| Phase 1 : Base de données | 2h                   |
| Phase 2 : Backend         | 6h                   |
| Phase 3 : Frontend        | 12h                  |
| Phase 4 : Configuration   | 1h                   |
| Phase 5 : Tests           | 6h                   |
| Phase 6 : Déploiement     | 2h                   |
| **TOTAL**                 | **~29h (3.5 jours)** |

---

## 🎯 RÉSULTAT ATTENDU

À la fin de l'implémentation :

✅ Formateurs peuvent uploader vidéo + PDF + audio  
✅ Apprenants choisissent librement le format  
✅ Vidéo affichée par défaut  
✅ Contrôles complets (pause, vitesse, avance/recul)  
✅ Progression automatique sans bouton  
✅ PDF lisible et téléchargeable  
✅ Architecture utilisant le système de stockage existant (multer + fichiers locaux)

---

**Plan créé le** : 2025-12-09  
**Version** : 1.0
