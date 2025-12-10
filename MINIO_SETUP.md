# Configuration MinIO pour le stockage de fichiers

Ce document explique comment configurer MinIO pour le stockage de fichiers dans l'application MDSC Auth API.

## Vue d'ensemble

Le système a été migré pour utiliser MinIO comme solution de stockage d'objets au lieu du stockage local. Cela permet de :
- Ne plus perdre les fichiers lors des mises à jour du backend
- Avoir un stockage persistant et scalable
- Faciliter les déploiements et les sauvegardes

## Installation de MinIO

### Option 1: Docker (Recommandé)

```bash
docker run -d \
  -p 9000:9000 \
  -p 9001:9001 \
  --name minio \
  -e "MINIO_ROOT_USER=minioadmin" \
  -e "MINIO_ROOT_PASSWORD=minioadmin" \
  -v /data/minio:/data \
  minio/minio server /data --console-address ":9001"
```

### Option 2: Installation locale

Téléchargez MinIO depuis https://min.io/download

```bash
# Linux
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
./minio server /data/minio
```

## Configuration

### Variables d'environnement

Ajoutez les variables suivantes dans votre fichier `.env` :

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost
MINIO_PORT=9000
MINIO_USE_SSL=false
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_BUCKET_NAME=mdsc-files
MINIO_REGION=us-east-1

# Optionnel: URL publique personnalisée pour MinIO (si différent de endpoint:port)
# MINIO_PUBLIC_URL=http://your-minio-domain.com
```

### Configuration de production

Pour la production, utilisez :
- SSL activé (`MINIO_USE_SSL=true`)
- Des clés d'accès sécurisées (pas les valeurs par défaut)
- Une URL publique configurée si MinIO est derrière un reverse proxy

```env
MINIO_ENDPOINT=minio.yourdomain.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=votre_cle_secrete
MINIO_SECRET_KEY=votre_secret_secret
MINIO_BUCKET_NAME=mdsc-files
MINIO_PUBLIC_URL=https://cdn.yourdomain.com
```

## Migration de la base de données

Exécutez la migration pour ajouter le support MinIO à la table `user_files` :

```bash
# Via Node.js
node -e "const {pool} = require('./src/config/database'); pool.execute('ALTER TABLE user_files ADD COLUMN IF NOT EXISTS storage_type ENUM(\"minio\", \"s3\", \"local\") DEFAULT \"local\" AFTER mime_type'); pool.end();"

# Ou via MySQL directement
mysql -u your_user -p your_database < database/migrations/021_add_storage_type_to_user_files.sql
```

## Fonctionnement

### Comportement automatique

Le système détecte automatiquement si MinIO est disponible :

1. **Si MinIO est configuré et accessible** :
   - Les nouveaux fichiers sont uploadés vers MinIO
   - Les fichiers existants en stockage local restent accessibles
   - Les nouveaux fichiers utilisent `storage_type='minio'` dans la base de données

2. **Si MinIO n'est pas disponible** :
   - Le système utilise automatiquement le stockage local (fallback)
   - Les fichiers sont sauvegardés dans `uploads/` comme avant
   - Aucune erreur n'est générée

### Structure des buckets

Les fichiers sont organisés dans le bucket selon leur type :
- `profiles/` - Photos de profil et documents d'identité
- `courses/thumbnails/` - Miniatures de cours
- `courses/videos/` - Vidéos introductives de cours
- `videos/` - Vidéos de leçons
- `documents/` - Documents PDF, Word, etc.
- `images/` - Images diverses
- `audio/` - Fichiers audio
- `presentations/` - Présentations PowerPoint
- `h5p/` - Contenus H5P
- `others/` - Autres types de fichiers

## Migration des fichiers existants

Pour migrer les fichiers existants du stockage local vers MinIO, vous pouvez créer un script de migration. Exemple :

```javascript
const MinioService = require('./src/services/minioService');
const { pool } = require('./src/config/database');
const fs = require('fs').promises;
const path = require('path');

async function migrateFiles() {
  const [files] = await pool.execute(
    "SELECT * FROM media_files WHERE storage_type = 'local'"
  );
  
  for (const file of files) {
    try {
      const localPath = path.join(__dirname, 'uploads', file.url.replace('/uploads/', ''));
      const fileBuffer = await fs.readFile(localPath);
      
      const objectName = file.url.replace('/uploads/', '');
      await MinioService.uploadFile(
        { buffer: fileBuffer, mimetype: file.file_type, originalname: file.original_filename },
        objectName,
        file.file_type
      );
      
      await pool.execute(
        'UPDATE media_files SET storage_type = ?, storage_path = ?, bucket_name = ? WHERE id = ?',
        ['minio', objectName, MinioService.defaultBucket, file.id]
      );
      
      console.log(`Migré: ${file.filename}`);
    } catch (error) {
      console.error(`Erreur pour ${file.filename}:`, error.message);
    }
  }
}
```

## Vérification

Pour vérifier que MinIO fonctionne correctement :

1. Vérifiez les logs au démarrage du serveur :
   ```
   ✅ MinIO client initialisé: localhost
   ✅ Bucket créé: mdsc-files
   ```

2. Testez un upload de fichier via l'API

3. Vérifiez dans la console MinIO (http://localhost:9001) que les fichiers apparaissent

## Dépannage

### MinIO non initialisé

Si vous voyez `⚠️  MinIO non configuré`, vérifiez :
- Les variables d'environnement sont définies
- MinIO est démarré et accessible
- Les clés d'accès sont correctes

### Erreurs de connexion

- Vérifiez que MinIO est accessible depuis le serveur
- Vérifiez le port (9000 par défaut)
- Vérifiez les paramètres SSL si nécessaire

### Fichiers non accessibles

- Vérifiez la politique du bucket (doit permettre l'accès public en lecture)
- Vérifiez l'URL publique configurée
- Vérifiez que les fichiers existent dans MinIO via la console

## Sécurité

⚠️ **Important pour la production** :

1. Changez les clés d'accès par défaut
2. Activez SSL/TLS
3. Configurez des politiques de bucket appropriées
4. Utilisez un reverse proxy avec authentification si nécessaire
5. Configurez des sauvegardes régulières du bucket MinIO
