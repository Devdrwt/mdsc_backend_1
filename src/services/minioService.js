const Minio = require('minio');
const path = require('path');
const fs = require('fs').promises;
const fsSync = require('fs');
const { Readable, PassThrough } = require('stream');
const os = require('os');

/**
 * Service de gestion du stockage MinIO
 */
class MinioService {
  static client = null;
  static defaultBucket = null;
  static isInitialized = false;

  /**
   * Initialiser le client MinIO
   */
  static initialize() {
    if (this.isInitialized && this.client) {
      return this.client;
    }

    const minioConfig = {
      endPoint: process.env.MINIO_ENDPOINT || 'localhost',
      port: parseInt(process.env.MINIO_PORT || '9000'),
      useSSL: process.env.MINIO_USE_SSL === 'true',
      accessKey: process.env.MINIO_ACCESS_KEY,
      secretKey: process.env.MINIO_SECRET_KEY,
      // Forcer region pour éviter les problèmes de signature
      region: process.env.MINIO_REGION || 'us-east-1',
      // Ajouter pathStyle pour compatibilité avec MinIO
      pathStyle: true,
      // Ajouter transport agent pour HTTPS
      ...(process.env.MINIO_USE_SSL === 'true' && {
        transportAgent: require('https').globalAgent
      })
    };

    console.log('🔧 [MINIO] Configuration:', {
      endPoint: minioConfig.endPoint,
      port: minioConfig.port,
      useSSL: minioConfig.useSSL,
      region: minioConfig.region,
      hasAccessKey: !!minioConfig.accessKey,
      hasSecretKey: !!minioConfig.secretKey,
      bucket: process.env.MINIO_BUCKET_NAME || 'mdsc-files'
    });

    // Vérifier que les clés d'accès sont configurées
    if (!minioConfig.accessKey || !minioConfig.secretKey) {
      console.error('❌ [MINIO] MinIO non configuré. MINIO_ACCESS_KEY et MINIO_SECRET_KEY sont requis.');
      this.isInitialized = false;
      return null;
    }

    try {
      this.client = new Minio.Client(minioConfig);
      this.defaultBucket = process.env.MINIO_BUCKET_NAME || 'mdsc-files';
      this.isInitialized = true;
      console.log('✅ [MINIO] Client initialisé:', {
        endpoint: minioConfig.endPoint,
        port: minioConfig.port,
        useSSL: minioConfig.useSSL,
        bucket: this.defaultBucket
      });
      
      // S'assurer que le bucket existe (en arrière-plan, ne pas bloquer)
      this.ensureBucketExists().catch(err => {
        console.error('❌ [MINIO] Erreur lors de la vérification du bucket:', err);
      });
      
      return this.client;
    } catch (error) {
      console.error('❌ [MINIO] Erreur lors de l\'initialisation:', error);
      console.error('❌ [MINIO] Détails:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      this.isInitialized = false;
      return null;
    }
  }

  /**
   * Tester la connexion MinIO et s'assurer que le bucket existe
   */
  static async testConnection() {
    if (!this.client || !this.defaultBucket) {
      throw new Error('Client ou bucket non défini');
    }

    try {
      console.log('🔍 [MINIO] Test de connexion...');
      
      // Tester la connexion en listant les buckets
      await this.client.listBuckets();
      console.log('✅ [MINIO] Connexion réussie');
      
      // S'assurer que le bucket existe
      await this.ensureBucketExists();
    } catch (error) {
      console.error('❌ [MINIO] Erreur lors du test de connexion:', error);
      console.error('❌ [MINIO] Détails:', {
        message: error.message,
        code: error.code,
        endpoint: process.env.MINIO_ENDPOINT,
        port: process.env.MINIO_PORT,
        useSSL: process.env.MINIO_USE_SSL
      });
      throw error;
    }
  }

  /**
   * S'assurer que le bucket existe, sinon le créer
   */
  static async ensureBucketExists() {
    if (!this.client || !this.defaultBucket) {
      console.warn('⚠️  [MINIO] Client ou bucket non défini');
      return;
    }

    try {
      console.log(`🔍 [MINIO] Vérification du bucket: ${this.defaultBucket}`);
      const exists = await this.client.bucketExists(this.defaultBucket);
      if (!exists) {
        console.log(`📦 [MINIO] Création du bucket: ${this.defaultBucket}`);
        await this.client.makeBucket(this.defaultBucket, process.env.MINIO_REGION || 'us-east-1');
        console.log(`✅ [MINIO] Bucket créé: ${this.defaultBucket}`);
        
        // Configurer la politique du bucket pour permettre l'accès public en lecture
        const policy = {
          Version: '2012-10-17',
          Statement: [
            {
              Effect: 'Allow',
              Principal: { AWS: ['*'] },
              Action: ['s3:GetObject'],
              Resource: [`arn:aws:s3:::${this.defaultBucket}/*`]
            }
          ]
        };
        
        try {
          await this.client.setBucketPolicy(this.defaultBucket, JSON.stringify(policy));
          console.log(`✅ [MINIO] Politique publique configurée pour le bucket ${this.defaultBucket}`);
        } catch (policyError) {
          console.warn('⚠️  [MINIO] Impossible de configurer la politique publique:', policyError.message);
        }
      } else {
        console.log(`✅ [MINIO] Bucket existe déjà: ${this.defaultBucket}`);
      }
    } catch (error) {
      console.error('❌ [MINIO] Erreur lors de la vérification/création du bucket:', error);
      console.error('❌ [MINIO] Détails:', {
        message: error.message,
        code: error.code,
        bucket: this.defaultBucket
      });
      throw error;
    }
  }

  /**
   * Obtenir le client MinIO (initialisé si nécessaire)
   */
  static getClient() {
    if (!this.client) {
      this.initialize();
    }
    return this.client;
  }

  /**
   * Vérifier si MinIO est disponible
   */
  static isAvailable() {
    const available = this.isInitialized && this.client !== null;
    if (!available) {
      console.warn('⚠️  [MINIO] MinIO non disponible:', {
        isInitialized: this.isInitialized,
        hasClient: !!this.client,
        endpoint: process.env.MINIO_ENDPOINT,
        port: process.env.MINIO_PORT
      });
    }
    return available;
  }

  /**
   * Uploader un fichier vers MinIO
   * @param {Object} file - Objet fichier de multer ou fichier local
   * @param {String} objectName - Nom de l'objet dans MinIO (chemin relatif)
   * @param {String} contentType - Type MIME du fichier
   * @returns {Promise<Object>} Informations sur le fichier uploadé
   */
  static async uploadFile(file, objectName, contentType) {
    console.log('🚀 [MINIO] ========== DÉBUT UPLOAD ==========');
    console.log('📋 [MINIO] Paramètres reçus:', {
      objectName,
      contentType,
      fileType: typeof file,
      hasBuffer: !!file?.buffer,
      hasPath: !!file?.path,
      fileSize: file?.size || file?.buffer?.length || 'unknown'
    });

    if (!this.isAvailable()) {
      console.error('❌ [MINIO] MinIO non disponible');
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      let fileStream;
      let fileSize;
      let tempFilePath = null;
      let useUploadStream = false;

      console.log('🔍 [MINIO] Analyse du type de fichier...');

      // Si c'est un fichier multer (avec path) - utiliser un stream pour les gros fichiers
      if (file.path && typeof file.path === 'string') {
        console.log('📁 [MINIO] Type: Fichier avec path');
        fileStream = fsSync.createReadStream(file.path);
        const stats = await fs.stat(file.path);
        fileSize = stats.size;
        useUploadStream = true;
        console.log('✅ [MINIO] Stream créé depuis le path:', file.path);
      } 
      // Si c'est un buffer direct
      else if (Buffer.isBuffer(file)) {
        console.log('📦 [MINIO] Type: Buffer direct');
        fileStream = file;
        fileSize = file.length;
        console.log('✅ [MINIO] Buffer direct utilisé:', fileSize, 'bytes');
      }
      // Si c'est un stream
      else if (file instanceof Readable) {
        console.log('🌊 [MINIO] Type: Stream');
        fileStream = file;
        fileSize = file.size;
        useUploadStream = true;
        console.log('✅ [MINIO] Stream direct utilisé');
      }
      // Si c'est un objet avec buffer (cas le plus courant avec multer memoryStorage)
      else if (file.buffer) {
        console.log('💾 [MINIO] Type: Objet avec buffer (multer)');
        const buffer = file.buffer;
        const LARGE_FILE_THRESHOLD = 100 * 1024 * 1024; // 100MB - seuil pour multipart upload
        const isPDF = (contentType || file.mimetype || '').includes('pdf') || 
                      (file.originalname || '').toLowerCase().endsWith('.pdf');
        
        console.log('📊 [MINIO] Taille fichier:', {
          bufferSize: buffer.length,
          bufferSizeMB: (buffer.length / (1024 * 1024)).toFixed(2) + ' MB',
          isLarge: buffer.length > LARGE_FILE_THRESHOLD,
          isPDF
        });

        // Pour les petits fichiers (<100MB) : buffer direct
        // Pour les gros fichiers (>100MB) : stream depuis buffer (pour multipart upload)
        if (buffer.length <= LARGE_FILE_THRESHOLD) {
          fileStream = buffer;
          fileSize = buffer.length;
          console.log('✅ [MINIO] Petit fichier, buffer direct:', fileSize, 'bytes');
        } else {
          // Gros fichier : créer un stream depuis le buffer
          // MinIO utilisera automatiquement le multipart upload
          console.log('📹 [MINIO] Gros fichier, création d\'un stream depuis le buffer pour multipart upload...');
          const { Readable } = require('stream');
          fileStream = Readable.from(buffer);
          fileSize = buffer.length;
          useUploadStream = true;
          console.log('✅ [MINIO] Stream créé depuis buffer pour multipart upload');
        }
      }
      else {
        console.error('❌ [MINIO] Format de fichier non reconnu:', typeof file);
        throw new Error('Format de fichier non supporté pour MinIO');
      }

      // Upload vers MinIO
      // Pour les PDFs : métadonnées minimales (sans original-filename qui peut causer des problèmes)
      const isPDF = (contentType || file.mimetype || '').includes('pdf') || 
                    (file.originalname || '').toLowerCase().endsWith('.pdf');
      
      // Nettoyer le nom de fichier original pour éviter les problèmes de signature avec caractères spéciaux
      const cleanOriginalFilename = (file.originalname || objectName)
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Enlever les accents
        .replace(/[^\x00-\x7F]/g, '') // Enlever les caractères non-ASCII
        .replace(/\s+/g, '_'); // Remplacer les espaces par des underscores
      
      const metaData = isPDF ? {
        'Content-Type': contentType || file.mimetype || 'application/pdf'
      } : {
        'Content-Type': contentType || file.mimetype || 'application/octet-stream',
        'original-filename': cleanOriginalFilename
      };

      // Pour les vidéos : utiliser putObject avec stream
      // Pour les PDFs et audio : utiliser putObject avec buffer (comme ça fonctionne pour l'audio)
      console.log('📤 [MINIO] Upload vers:', {
        bucket: this.defaultBucket,
        objectName,
        fileSize,
        useStream: useUploadStream,
        contentType: metaData['Content-Type'],
        tempFilePath: tempFilePath || 'N/A',
        metaData
      });

      console.log('🔄 [MINIO] Démarrage de putObject...');
      const startTime = Date.now();
      
      // MinIO v8 : utiliser putObject pour tous les cas
      const uploadPromise = client.putObject(
        this.defaultBucket,
        objectName,
        fileStream,
        fileSize,
        metaData
      );

      // Ajouter des logs de progression
      const progressInterval = setInterval(() => {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        console.log(`⏳ [MINIO] Upload en cours... ${elapsed}s écoulées`);
      }, 5000); // Log toutes les 5 secondes

      try {
        await uploadPromise;
        clearInterval(progressInterval);
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
        console.log(`✅ [MINIO] Upload terminé avec succès en ${elapsed}s`);
      } catch (uploadError) {
        clearInterval(progressInterval);
        console.error('❌ [MINIO] Erreur lors de putObject:', {
          message: uploadError.message,
          code: uploadError.code,
          stack: uploadError.stack
        });
        throw uploadError;
      }

      // Construire l'URL publique
      const publicUrl = this.getPublicUrl(objectName);
      
      console.log('🎉 [MINIO] Upload complet:', {
        bucket: this.defaultBucket,
        objectName,
        url: publicUrl,
        size: fileSize
      });
      console.log('🏁 [MINIO] ========== FIN UPLOAD ==========');

      return {
        bucket: this.defaultBucket,
        objectName: objectName,
        url: publicUrl,
        size: fileSize,
        contentType: contentType || file.mimetype
      };
    } catch (error) {
      console.error('💥 [MINIO] ========== ERREUR UPLOAD ==========');
      console.error('❌ [MINIO] Erreur lors de l\'upload vers MinIO:', {
        message: error.message,
        code: error.code,
        name: error.name,
        stack: error.stack
      });
      console.error('🏁 [MINIO] ========== FIN ERREUR ==========');
      throw error;
    }
  }

  /**
   * Télécharger un fichier depuis MinIO
   * @param {String} objectName - Nom de l'objet dans MinIO
   * @returns {Promise<Stream>} Stream du fichier
   */
  static async downloadFile(objectName) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      return await client.getObject(this.defaultBucket, objectName);
    } catch (error) {
      console.error('Erreur lors du téléchargement depuis MinIO:', error);
      throw error;
    }
  }

  /**
   * Supprimer un fichier depuis MinIO
   * @param {String} objectName - Nom de l'objet dans MinIO
   * @returns {Promise<Boolean>} Succès de la suppression
   */
  static async deleteFile(objectName) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      await client.removeObject(this.defaultBucket, objectName);
      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression depuis MinIO:', error);
      throw error;
    }
  }

  /**
   * Obtenir l'URL publique d'un fichier
   * @param {String} objectName - Nom de l'objet dans MinIO
   * @returns {String} URL publique
   */
  static getPublicUrl(objectName) {
    if (!this.isAvailable()) {
      return null;
    }

    const endpoint = process.env.MINIO_ENDPOINT || 'localhost';
    const port = process.env.MINIO_PORT || '9000';
    const useSSL = process.env.MINIO_USE_SSL === 'true';
    const protocol = useSSL ? 'https' : 'http';
    
    // Si une URL publique personnalisée est configurée, l'utiliser
    if (process.env.MINIO_PUBLIC_URL) {
      return `${process.env.MINIO_PUBLIC_URL}/${this.defaultBucket}/${objectName}`;
    }

    return `${protocol}://${endpoint}:${port}/${this.defaultBucket}/${objectName}`;
  }

  /**
   * Générer un nom d'objet unique pour MinIO
   * Dans MinIO/S3, les "dossiers" sont des préfixes dans les noms d'objets.
   * Ils sont créés automatiquement lors de l'upload - pas besoin de les créer manuellement.
   * 
   * @param {String} folder - Dossier/préfixe dans le bucket (ex: 'profiles', 'courses/thumbnails', 'videos')
   * @param {String} originalFilename - Nom de fichier original
   * @param {String} userId - ID de l'utilisateur (optionnel)
   * @returns {String} Nom d'objet unique avec préfixe (ex: 'videos/user123-1234567890-file.mp4')
   */
  static generateObjectName(folder, originalFilename, userId = null) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const filename = userId 
      ? `${userId}-${uniqueSuffix}${ext}`
      : `${sanitizedBaseName}-${uniqueSuffix}${ext}`;
    
    // Nettoyer le chemin du dossier/préfixe
    // Enlever les slashes en début/fin et remplacer les multiples slashes par un seul
    const cleanFolder = folder ? folder.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/') : '';
    
    // Construire le nom d'objet complet avec préfixe
    // Exemple: 'videos/user123-1234567890-file.mp4'
    const objectName = cleanFolder ? `${cleanFolder}/${filename}` : filename;
    
    console.log('📁 [MINIO] Génération nom objet:', {
      folder,
      cleanFolder,
      originalFilename,
      filename,
      objectName,
      userId
    });
    
    return objectName;
  }

  /**
   * Vérifier si un fichier existe dans MinIO
   * @param {String} objectName - Nom de l'objet dans MinIO
   * @returns {Promise<Boolean>} True si le fichier existe
   */
  static async fileExists(objectName) {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const client = this.getClient();
      await client.statObject(this.defaultBucket, objectName);
      return true;
    } catch (error) {
      if (error.code === 'NotFound') {
        return false;
      }
      throw error;
    }
  }

  /**
   * Obtenir les métadonnées d'un fichier
   * @param {String} objectName - Nom de l'objet dans MinIO
   * @returns {Promise<Object>} Métadonnées du fichier
   */
  static async getFileMetadata(objectName) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      const stat = await client.statObject(this.defaultBucket, objectName);
      return stat;
    } catch (error) {
      console.error('Erreur lors de la récupération des métadonnées:', error);
      throw error;
    }
  }

  /**
   * Générer une URL pré-signée pour upload direct
   * @param {String} bucket - Nom du bucket
   * @param {String} objectName - Nom de l'objet
   * @param {Number} expirySeconds - Durée de validité en secondes (défaut: 1 heure)
   * @returns {Promise<String>} URL pré-signée pour upload
   */
  static async getPresignedUploadUrl(bucket, objectName, expirySeconds = 3600) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      
      console.log('🔗 [MINIO] Génération URL pré-signée:', {
        bucket,
        objectName,
        expirySeconds,
        expiryMinutes: Math.round(expirySeconds / 60)
      });

      // Générer URL pré-signée pour PUT (upload)
      const presignedUrl = await client.presignedPutObject(bucket, objectName, expirySeconds);
      
      console.log('✅ [MINIO] URL pré-signée générée:', {
        objectName,
        urlLength: presignedUrl.length,
        validFor: `${Math.round(expirySeconds / 60)} minutes`
      });

      return presignedUrl;
    } catch (error) {
      console.error('❌ [MINIO] Erreur génération URL pré-signée:', error);
      throw error;
    }
  }

  /**
   * Générer une URL pré-signée pour téléchargement
   * @param {String} bucket - Nom du bucket
   * @param {String} objectName - Nom de l'objet
   * @param {Number} expirySeconds - Durée de validité en secondes (défaut: 1 heure)
   * @returns {Promise<String>} URL pré-signée pour téléchargement
   */
  static async getPresignedDownloadUrl(bucket, objectName, expirySeconds = 3600) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      
      // Générer URL pré-signée pour GET (download)
      const presignedUrl = await client.presignedGetObject(bucket, objectName, expirySeconds);
      
      return presignedUrl;
    } catch (error) {
      console.error('❌ [MINIO] Erreur génération URL téléchargement:', error);
      throw error;
    }
  }
}

// Initialiser automatiquement au chargement du module
MinioService.initialize();

module.exports = MinioService;
