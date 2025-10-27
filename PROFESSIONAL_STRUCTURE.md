# 🏥 Structure Professionnelle MdSC MOOC

## Architecture Hiérarchique

```
🏥 DOMAINE (Santé)
├── 📚 MODULE (Cardiologie Fondamentale)
│   ├── 📖 COURS 1 (Anatomie du Cœur)
│   │   ├── 📝 SÉQUENCE 1 (Introduction à l'Anatomie)
│   │   │   ├── 📄 PDF (Introduction Cardiologie)
│   │   │   ├── 🎥 VIDÉO (Dissection Virtuelle)
│   │   │   ├── 📝 QUIZ (Anatomie de Base)
│   │   │   └── ✅ MINI-CONTROL (Contrôle Anatomie)
│   │   ├── 📝 SÉQUENCE 2 (Structure du Cœur)
│   │   │   ├── 📄 PDF (Anatomie Détaillée)
│   │   │   ├── 🎥 VIDÉO (Modèle 3D)
│   │   │   └── ✅ MINI-CONTROL (Quiz Structure)
│   │   ├── 📝 SÉQUENCE 3 (Vaisseaux Sanguins)
│   │   └── 📝 SÉQUENCE 4 (Système de Conduction)
│   ├── 📖 COURS 2 (Physiologie Cardiaque)
│   │   ├── 📝 SÉQUENCE 1 (Mécanismes de Base)
│   │   ├── 📝 SÉQUENCE 2 (Cycle Cardiaque)
│   │   └── 📝 SÉQUENCE 3 (Régulation)
│   └── 📖 COURS 3 (Pathologies Cardiovasculaires)
│       ├── 📝 SÉQUENCE 1 (Infarctus)
│       ├── 📝 SÉQUENCE 2 (Insuffisance Cardiaque)
│       └── 📝 SÉQUENCE 3 (Traitements)
│   └── 🏆 ÉVALUATION MODULE (Examen Final Cardiologie)
├── 📚 MODULE (Neurologie Clinique)
└── 📚 MODULE (Pneumologie)
```

## 🎯 Workflow d'Apprentissage

### 1. **Inscription au Module**
- L'étudiant s'inscrit au module complet
- Accès à tous les cours du module
- Progression globale suivie

### 2. **Parcours des Cours**
- Chaque cours contient plusieurs séquences
- Les séquences sont ordonnées logiquement
- Contenus variés : PDF, vidéos, quiz, live

### 3. **Mini-Contrôles**
- Évaluation après chaque séquence importante
- Score minimum requis pour continuer
- Badges attribués selon les performances

### 4. **Certification Module**
- Évaluation finale du module
- Score minimum pour obtenir la certification
- Certificat généré automatiquement

## 📊 Avantages de cette Structure

### ✅ **Pour les Étudiants**
- **Parcours structuré** : Progression logique et cohérente
- **Micro-apprentissage** : Contenus digestibles par séquences
- **Évaluation continue** : Mini-contrôles pour valider les acquis
- **Certification professionnelle** : Reconnaissance des compétences

### ✅ **Pour les Instructeurs**
- **Organisation claire** : Structure modulaire facile à gérer
- **Flexibilité** : Possibilité d'ajouter/modifier du contenu
- **Suivi détaillé** : Progression des étudiants par séquence
- **Évaluation adaptée** : Différents types d'évaluations

### ✅ **Pour les Administrateurs**
- **Gestion sectorielle** : Organisation par domaines professionnels
- **Statistiques détaillées** : Suivi des performances par module
- **Certification centralisée** : Gestion des certifications professionnelles
- **Scalabilité** : Facile d'ajouter de nouveaux domaines/modules

## 🔧 API Endpoints Disponibles

### Domaines
- `GET /api/professional/domains` - Liste des domaines
- `GET /api/professional/domains/:id` - Détails d'un domaine
- `POST /api/professional/domains` - Créer un domaine (Admin)

### Modules
- `GET /api/professional/domains/:domainId/modules` - Modules d'un domaine
- `GET /api/professional/modules/:id` - Détails d'un module
- `POST /api/professional/modules` - Créer un module (Instructeur)

### Séquences
- `GET /api/professional/courses/:courseId/sequences` - Séquences d'un cours
- `POST /api/professional/courses/:courseId/sequences` - Créer une séquence

### Contenus
- `GET /api/professional/sequences/:sequenceId/contents` - Contenus d'une séquence
- `POST /api/professional/sequences/:sequenceId/contents` - Ajouter du contenu

## 🎓 Exemple d'Utilisation

### Création d'un Module Professionnel

1. **Créer le domaine** (Admin)
```json
POST /api/professional/domains
{
  "name": "Santé",
  "description": "Formations médicales",
  "icon": "heart-pulse",
  "color": "#dc3545"
}
```

2. **Créer le module** (Instructeur)
```json
POST /api/professional/modules
{
  "domain_id": 1,
  "title": "Cardiologie Fondamentale",
  "description": "Module complet cardiologie",
  "duration_hours": 40,
  "difficulty": "intermediate",
  "price": 299.99,
  "certification_required": true
}
```

3. **Créer les cours** (Instructeur)
```json
POST /api/courses
{
  "module_id": 1,
  "title": "Anatomie du Cœur",
  "description": "Structure du système cardiovasculaire",
  "difficulty": "beginner"
}
```

4. **Créer les séquences** (Instructeur)
```json
POST /api/professional/courses/1/sequences
{
  "title": "Introduction à l'Anatomie",
  "description": "Vue d'ensemble",
  "sequence_order": 1,
  "has_mini_control": true,
  "mini_control_points": 10
}
```

5. **Ajouter du contenu** (Instructeur)
```json
POST /api/professional/sequences/1/contents
{
  "title": "PDF Introduction",
  "content_type": "pdf",
  "content_url": "https://example.com/intro.pdf",
  "content_order": 1,
  "is_required": true
}
```

Cette structure professionnelle transforme votre MOOC en une véritable plateforme de formation professionnelle structurée et certifiante ! 🚀
