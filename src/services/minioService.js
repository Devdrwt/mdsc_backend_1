const Minio = require('minio');
const path = require('path');
const fs = require('fs').promises;
const { Readable } = require('stream');

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
      secretKey: process.env.MINIO_SECRET_KEY
    };

    // Vérifier que les clés d'accès sont configurées
    if (!minioConfig.accessKey || !minioConfig.secretKey) {
      console.warn('⚠️  MinIO non configuré. Les fichiers seront stockés localement.');
      this.isInitialized = false;
      return null;
    }

    try {
      this.client = new Minio.Client(minioConfig);
      this.defaultBucket = process.env.MINIO_BUCKET_NAME || 'mdsc-files';
      this.isInitialized = true;
      console.log('✅ MinIO client initialisé:', minioConfig.endPoint);
      
      // S'assurer que le bucket existe
      this.ensureBucketExists();
      
      return this.client;
    } catch (error) {
      console.error('❌ Erreur lors de l\'initialisation de MinIO:', error);
      this.isInitialized = false;
      return null;
    }
  }

  /**
   * S'assurer que le bucket existe, sinon le créer
   */
  static async ensureBucketExists() {
    if (!this.client || !this.defaultBucket) return;

    try {
      const exists = await this.client.bucketExists(this.defaultBucket);
      if (!exists) {
        await this.client.makeBucket(this.defaultBucket, process.env.MINIO_REGION || 'us-east-1');
        console.log(`✅ Bucket créé: ${this.defaultBucket}`);
        
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
          console.log(`✅ Politique publique configurée pour le bucket ${this.defaultBucket}`);
        } catch (policyError) {
          console.warn('⚠️  Impossible de configurer la politique publique:', policyError.message);
        }
      }
    } catch (error) {
      console.error('❌ Erreur lors de la vérification/création du bucket:', error);
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
    return this.isInitialized && this.client !== null;
  }

  /**
   * Uploader un fichier vers MinIO
   * @param {Object} file - Objet fichier de multer ou fichier local
   * @param {String} objectName - Nom de l'objet dans MinIO (chemin relatif)
   * @param {String} contentType - Type MIME du fichier
   * @returns {Promise<Object>} Informations sur le fichier uploadé
   */
  static async uploadFile(file, objectName, contentType) {
    if (!this.isAvailable()) {
      throw new Error('MinIO n\'est pas disponible');
    }

    try {
      const client = this.getClient();
      let fileStream;

      // Si c'est un fichier multer (avec path)
      if (file.path && typeof file.path === 'string') {
        fileStream = await fs.readFile(file.path);
      } 
      // Si c'est un buffer
      else if (Buffer.isBuffer(file)) {
        fileStream = file;
      }
      // Si c'est un stream
      else if (file instanceof Readable) {
        fileStream = file;
      }
      // Si c'est un objet avec buffer
      else if (file.buffer) {
        fileStream = file.buffer;
      }
      else {
        throw new Error('Format de fichier non supporté pour MinIO');
      }

      // Upload vers MinIO
      const metaData = {
        'Content-Type': contentType || file.mimetype || 'application/octet-stream',
        'original-filename': file.originalname || objectName
      };

      await client.putObject(
        this.defaultBucket,
        objectName,
        fileStream,
        file.size || fileStream.length,
        metaData
      );

      // Construire l'URL publique
      const publicUrl = this.getPublicUrl(objectName);

      return {
        bucket: this.defaultBucket,
        objectName: objectName,
        url: publicUrl,
        size: file.size || fileStream.length,
        contentType: contentType || file.mimetype
      };
    } catch (error) {
      console.error('Erreur lors de l\'upload vers MinIO:', error);
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
   * @param {String} folder - Dossier dans le bucket (ex: 'profiles', 'courses/thumbnails')
   * @param {String} originalFilename - Nom de fichier original
   * @param {String} userId - ID de l'utilisateur (optionnel)
   * @returns {String} Nom d'objet unique
   */
  static generateObjectName(folder, originalFilename, userId = null) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(originalFilename);
    const baseName = path.basename(originalFilename, ext);
    const sanitizedBaseName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_');
    
    const filename = userId 
      ? `${userId}-${uniqueSuffix}${ext}`
      : `${sanitizedBaseName}-${uniqueSuffix}${ext}`;
    
    // Nettoyer le chemin du dossier
    const cleanFolder = folder.replace(/^\/+|\/+$/g, '').replace(/\/+/g, '/');
    
    return cleanFolder ? `${cleanFolder}/${filename}` : filename;
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
}

// Initialiser automatiquement au chargement du module
MinioService.initialize();

module.exports = MinioService;
