# Guide de déploiement MinIO en production sur VPS

Ce guide vous explique comment installer et configurer MinIO en production sur votre VPS.

## 📋 Prérequis

- Un VPS avec accès root/sudo
- Docker installé (recommandé) ou accès direct pour installation binaire
- Un domaine (optionnel mais recommandé pour SSL)
- Certificat SSL (Let's Encrypt recommandé)

## 🚀 Installation de MinIO

### Option 1: Installation avec Docker (Recommandé)

#### 1. Créer un répertoire pour les données

```bash
sudo mkdir -p /data/minio
sudo chown -R $USER:$USER /data/minio
```

#### 2. Créer un fichier docker-compose.yml

Créez le fichier `/opt/minio/docker-compose.yml` :

```yaml
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "9000:9000"   # API
      - "9001:9001"   # Console
    environment:
      MINIO_ROOT_USER: ${MINIO_ROOT_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_ROOT_PASSWORD}
    volumes:
      - /data/minio:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
```

#### 3. Créer un fichier .env pour les secrets

Créez `/opt/minio/.env` :

```bash
MINIO_ROOT_USER=your_secure_username_here
MINIO_ROOT_PASSWORD=your_very_secure_password_here
```

⚠️ **IMPORTANT** : Changez ces valeurs et gardez-les secrètes !

#### 4. Démarrer MinIO

```bash
cd /opt/minio
docker-compose up -d
```

#### 5. Vérifier que MinIO fonctionne

```bash
docker ps | grep minio
docker logs minio
```

Accédez à la console : `http://votre-ip:9001`

### Option 2: Installation binaire (sans Docker)

#### 1. Télécharger MinIO

```bash
cd /opt
wget https://dl.min.io/server/minio/release/linux-amd64/minio
chmod +x minio
```

#### 2. Créer un utilisateur système

```bash
sudo useradd -r -s /bin/false minio-user
sudo mkdir -p /data/minio
sudo chown minio-user:minio-user /data/minio
```

#### 3. Créer un service systemd

Créez `/etc/systemd/system/minio.service` :

```ini
[Unit]
Description=MinIO Object Storage
After=network.target

[Service]
Type=simple
User=minio-user
Group=minio-user
Environment="MINIO_ROOT_USER=your_secure_username"
Environment="MINIO_ROOT_PASSWORD=your_very_secure_password"
ExecStart=/opt/minio server /data/minio --console-address ":9001"
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

#### 4. Démarrer le service

```bash
sudo systemctl daemon-reload
sudo systemctl enable minio
sudo systemctl start minio
sudo systemctl status minio
```

## 🔒 Configuration sécurisée pour la production

### 1. Configuration Nginx (Reverse Proxy)

Créez `/etc/nginx/sites-available/minio` :

```nginx
# API MinIO (port 9000)
server {
    listen 80;
    server_name minio-api.votre-domaine.com;
    
    # Redirection vers HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name minio-api.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/minio-api.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio-api.votre-domaine.com/privkey.pem;
    
    # Configuration SSL recommandée
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Headers de sécurité
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Proxy vers MinIO
    location / {
        proxy_pass http://localhost:9000;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_connect_timeout 300;
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        chunked_transfer_encoding off;
    }
}

# Console MinIO (port 9001) - Accès restreint recommandé
server {
    listen 443 ssl http2;
    server_name minio-console.votre-domaine.com;

    ssl_certificate /etc/letsencrypt/live/minio-console.votre-domaine.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/minio-console.votre-domaine.com/privkey.pem;

    # Restreindre l'accès par IP (optionnel mais recommandé)
    # allow 192.168.1.0/24;  # Votre réseau local
    # allow votre-ip-publique;
    # deny all;

    location / {
        proxy_pass http://localhost:9001;
        proxy_set_header Host $http_host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-NginX-Proxy true;
        
        # WebSocket support pour la console
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Activez le site :

```bash
sudo ln -s /etc/nginx/sites-available/minio /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 2. Obtenir des certificats SSL avec Let's Encrypt

```bash
# Installer certbot si pas déjà installé
sudo apt update
sudo apt install certbot python3-certbot-nginx

# Obtenir les certificats
sudo certbot --nginx -d minio-api.votre-domaine.com
sudo certbot --nginx -d minio-console.votre-domaine.com

# Renouvellement automatique (déjà configuré par certbot)
sudo certbot renew --dry-run
```

### 3. Configuration du pare-feu

```bash
# Autoriser les ports nécessaires
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP (pour Let's Encrypt)
sudo ufw allow 443/tcp   # HTTPS

# Bloquer l'accès direct aux ports MinIO (utiliser Nginx uniquement)
# Ne pas ouvrir 9000 et 9001 publiquement si vous utilisez Nginx

sudo ufw enable
sudo ufw status
```

## ⚙️ Configuration du backend Node.js

### 1. Variables d'environnement pour la production

Dans votre fichier `.env` sur le VPS :

```env
# MinIO Configuration Production
MINIO_ENDPOINT=minio-api.votre-domaine.com
MINIO_PORT=443
MINIO_USE_SSL=true
MINIO_ACCESS_KEY=votre_access_key_secure
MINIO_SECRET_KEY=votre_secret_key_secure
MINIO_BUCKET_NAME=mdsc-files
MINIO_REGION=us-east-1

# URL publique pour les fichiers (sans port si HTTPS standard)
MINIO_PUBLIC_URL=https://minio-api.votre-domaine.com

# API URL du backend
API_URL=https://api.votre-domaine.com
```

### 2. Créer les clés d'accès dans MinIO

1. Connectez-vous à la console MinIO : `https://minio-console.votre-domaine.com`
2. Allez dans **Access Keys** → **Create Access Key**
3. Créez une clé avec les permissions nécessaires :
   - **Policy** : `readwrite` (ou créez une policy personnalisée)
   - **Name** : `mdsc-backend-key`
4. Copiez l'**Access Key** et le **Secret Key** dans votre `.env`

### 3. Créer et configurer le bucket

Dans la console MinIO :

1. Créez un bucket nommé `mdsc-files`
2. Configurez la politique du bucket :
   - Allez dans **Buckets** → `mdsc-files` → **Access Policy**
   - Sélectionnez **Public** pour permettre l'accès en lecture
   - Ou créez une policy personnalisée :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {"AWS": ["*"]},
      "Action": ["s3:GetObject"],
      "Resource": ["arn:aws:s3:::mdsc-files/*"]
    }
  ]
}
```

### 4. Exécuter la migration de la base de données

```bash
cd /chemin/vers/votre/api
node database/run_migration_021.js
```

### 5. Redémarrer le backend

```bash
# Si vous utilisez PM2
pm2 restart mdsc-auth-api

# Ou si vous utilisez systemd
sudo systemctl restart mdsc-auth-api
```

## 🔐 Sécurité avancée

### 1. Restreindre l'accès à la console MinIO

Modifiez Nginx pour n'autoriser que certaines IPs :

```nginx
# Dans /etc/nginx/sites-available/minio
server {
    # ... autres configurations ...
    
    # Autoriser uniquement votre IP et votre réseau
    allow 192.168.1.0/24;      # Votre réseau local
    allow votre-ip-publique;   # Votre IP publique
    deny all;
    
    # ... reste de la configuration ...
}
```

### 2. Créer une policy MinIO personnalisée

Dans la console MinIO, créez une policy avec des permissions limitées :

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::mdsc-files",
        "arn:aws:s3:::mdsc-files/*"
      ]
    }
  ]
}
```

### 3. Sauvegardes automatiques

Créez un script de sauvegarde `/opt/minio/backup.sh` :

```bash
#!/bin/bash
BACKUP_DIR="/backups/minio"
DATE=$(date +%Y%m%d_%H%M%S)
BUCKET="mdsc-files"

mkdir -p $BACKUP_DIR

# Utiliser mc (MinIO Client) pour la sauvegarde
mc mirror minio/$BUCKET $BACKUP_DIR/$DATE

# Garder seulement les 7 derniers backups
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} +

echo "Backup completed: $DATE"
```

Ajoutez dans crontab :

```bash
# Sauvegarde quotidienne à 2h du matin
0 2 * * * /opt/minio/backup.sh >> /var/log/minio-backup.log 2>&1
```

### 4. Monitoring

Installez MinIO Client pour le monitoring :

```bash
# Télécharger mc
wget https://dl.min.io/client/mc/release/linux-amd64/mc
chmod +x mc
sudo mv mc /usr/local/bin/

# Configurer l'alias
mc alias set minio https://minio-api.votre-domaine.com votre_access_key votre_secret_key

# Vérifier le statut
mc admin info minio
mc admin heal minio/mdsc-files
```

## ✅ Vérification

### 1. Tester l'upload

```bash
curl -X POST https://api.votre-domaine.com/api/files/upload \
  -H "Authorization: Bearer votre-token" \
  -F "file=@test.jpg" \
  -F "file_type=profile_picture"
```

### 2. Vérifier dans MinIO

- Connectez-vous à la console
- Vérifiez que le bucket `mdsc-files` contient les fichiers
- Vérifiez que les URLs publiques fonctionnent

### 3. Vérifier les logs

```bash
# Logs MinIO
docker logs minio
# ou
sudo journalctl -u minio -f

# Logs backend
pm2 logs mdsc-auth-api
# ou
sudo journalctl -u mdsc-auth-api -f
```

## 🐛 Dépannage

### MinIO ne démarre pas

```bash
# Vérifier les logs
docker logs minio
# ou
sudo journalctl -u minio

# Vérifier les permissions
ls -la /data/minio
```

### Erreur de connexion depuis le backend

1. Vérifiez les variables d'environnement
2. Vérifiez que MinIO est accessible depuis le serveur :
   ```bash
   curl https://minio-api.votre-domaine.com/minio/health/live
   ```
3. Vérifiez les clés d'accès dans la console MinIO

### Fichiers non accessibles publiquement

1. Vérifiez la politique du bucket (doit être Public)
2. Vérifiez que Nginx proxy correctement
3. Vérifiez les certificats SSL

## 📊 Monitoring et maintenance

### Commandes utiles

```bash
# Statut MinIO
mc admin info minio

# Espace utilisé
mc du minio/mdsc-files

# Lister les objets
mc ls minio/mdsc-files

# Réparer les objets corrompus
mc admin heal minio/mdsc-files
```

## 🎯 Checklist de déploiement

- [ ] MinIO installé et démarré
- [ ] Certificats SSL configurés
- [ ] Nginx configuré comme reverse proxy
- [ ] Pare-feu configuré
- [ ] Clés d'accès créées dans MinIO
- [ ] Bucket `mdsc-files` créé avec politique publique
- [ ] Variables d'environnement configurées dans le backend
- [ ] Migration de base de données exécutée
- [ ] Backend redémarré
- [ ] Test d'upload réussi
- [ ] Sauvegardes configurées
- [ ] Monitoring en place

## 📝 Notes importantes

1. **Ne jamais exposer les ports 9000 et 9001 publiquement** - Utilisez toujours Nginx
2. **Changez les credentials par défaut** - Utilisez des mots de passe forts
3. **Activez SSL/TLS** - C'est essentiel en production
4. **Configurez des sauvegardes** - Les données sont importantes
5. **Surveillez l'espace disque** - MinIO peut consommer beaucoup d'espace
6. **Restreignez l'accès à la console** - Seulement pour les administrateurs

## 🔗 Ressources

- [Documentation MinIO](https://min.io/docs/)
- [MinIO Security Best Practices](https://min.io/docs/minio/linux/administration/security.html)
- [Nginx Reverse Proxy](https://docs.nginx.com/nginx/admin-guide/web-server/reverse-proxy/)
