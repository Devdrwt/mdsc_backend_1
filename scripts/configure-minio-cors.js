/**
 * Script pour configurer CORS sur MinIO
 * Ce script doit être exécuté une fois pour permettre les uploads directs depuis le navigateur
 */

const Minio = require('minio');
require('dotenv').config();

async function configureMinioCORS() {
  console.log('🔧 Configuration CORS pour MinIO...\n');

  // Initialiser le client MinIO
  const minioClient = new Minio.Client({
    endPoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000'),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    region: process.env.MINIO_REGION || 'us-east-1',
    pathStyle: true
  });

  const buckets = [
    process.env.MINIO_BUCKET_NAME || 'mdsc-files',
    'videos-mdsc'
  ];

  // Configuration CORS pour permettre les uploads directs
  const corsConfig = {
    CORSRules: [
      {
        AllowedOrigins: [
          'http://localhost:3000',
          'http://localhost:3001',
          'http://localhost:3002',
          'https://mdcs.drwintech.com',
          process.env.FRONTEND_URL || 'http://localhost:3000'
        ].filter((v, i, a) => a.indexOf(v) === i), // Enlever les doublons
        AllowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
        AllowedHeaders: ['*'],
        ExposeHeaders: ['ETag', 'Content-Length', 'Content-Type'],
        MaxAgeSeconds: 3600
      }
    ]
  };

  console.log('📋 Configuration CORS à appliquer:');
  console.log(JSON.stringify(corsConfig, null, 2));
  console.log('');

  for (const bucket of buckets) {
    try {
      // Vérifier si le bucket existe
      const exists = await minioClient.bucketExists(bucket);
      if (!exists) {
        console.log(`⚠️  Bucket ${bucket} n'existe pas, création...`);
        await minioClient.makeBucket(bucket, process.env.MINIO_REGION || 'us-east-1');
        console.log(`✅ Bucket ${bucket} créé`);
      }

      // Note: La bibliothèque minio ne supporte pas directement setBucketCors
      // Il faut utiliser mc (MinIO Client CLI) ou l'API REST directement
      console.log(`⚠️  Pour configurer CORS sur ${bucket}, utilisez MinIO Client (mc):`);
      console.log('');
      console.log(`   mc alias set myminio http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT} ${process.env.MINIO_ACCESS_KEY} ${process.env.MINIO_SECRET_KEY}`);
      console.log(`   mc admin config set myminio api cors_allow_origin="*"`);
      console.log('   mc admin service restart myminio');
      console.log('');
      console.log('   OU via l\'interface web MinIO (Console):');
      console.log(`   1. Allez sur http://${process.env.MINIO_ENDPOINT}:${process.env.MINIO_PORT || 9001}`);
      console.log('   2. Connectez-vous avec vos credentials');
      console.log(`   3. Allez dans Buckets > ${bucket} > Settings > Access`);
      console.log('   4. Ajoutez la règle CORS ci-dessus');
      console.log('');

      // Configurer la politique publique pour lecture
      const policy = {
        Version: '2012-10-17',
        Statement: [
          {
            Effect: 'Allow',
            Principal: { AWS: ['*'] },
            Action: ['s3:GetObject'],
            Resource: [`arn:aws:s3:::${bucket}/*`]
          }
        ]
      };

      await minioClient.setBucketPolicy(bucket, JSON.stringify(policy));
      console.log(`✅ Politique publique configurée pour ${bucket}`);
      console.log('');

    } catch (error) {
      console.error(`❌ Erreur pour le bucket ${bucket}:`, error.message);
      console.log('');
    }
  }

  console.log('');
  console.log('📝 IMPORTANT: Configuration CORS via variables d\'environnement MinIO');
  console.log('');
  console.log('Si vous utilisez Docker, ajoutez ces variables d\'environnement au conteneur MinIO:');
  console.log('');
  console.log('  MINIO_API_CORS_ALLOW_ORIGIN="*"');
  console.log('  # OU spécifiquement:');
  console.log('  MINIO_API_CORS_ALLOW_ORIGIN="http://localhost:3000,https://mdcs.drwintech.com"');
  console.log('');
  console.log('Dans docker-compose.yml:');
  console.log('');
  console.log('  minio:');
  console.log('    image: minio/minio');
  console.log('    environment:');
  console.log('      - MINIO_API_CORS_ALLOW_ORIGIN=*');
  console.log('      # ou');
  console.log('      - MINIO_API_CORS_ALLOW_ORIGIN=http://localhost:3000,https://mdcs.drwintech.com');
  console.log('');
}

// Exécuter
configureMinioCORS()
  .then(() => {
    console.log('✅ Configuration terminée');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Erreur:', error);
    process.exit(1);
  });
