#!/bin/bash
# Script de déploiement rapide MinIO sur VPS
# Usage: bash DEPLOY_MINIO_VPS.sh

set -e

echo "🚀 Déploiement MinIO sur VPS"
echo "=============================="

# Variables (à modifier selon votre configuration)
MINIO_USER="minioadmin"
MINIO_PASSWORD=""
MINIO_DOMAIN_API="minio-api.votre-domaine.com"
MINIO_DOMAIN_CONSOLE="minio-console.votre-domaine.com"
DATA_DIR="/data/minio"

# Vérifier que Docker est installé
if ! command -v docker &> /dev/null; then
    echo "❌ Docker n'est pas installé. Installation..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    echo "✅ Docker installé. Veuillez vous reconnecter et relancer le script."
    exit 1
fi

# Vérifier que Docker Compose est installé
if ! command -v docker-compose &> /dev/null; then
    echo "❌ Docker Compose n'est pas installé. Installation..."
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
fi

# Demander le mot de passe MinIO si non fourni
if [ -z "$MINIO_PASSWORD" ]; then
    echo "🔐 Entrez un mot de passe sécurisé pour MinIO:"
    read -s MINIO_PASSWORD
    echo ""
fi

# Créer le répertoire de données
echo "📁 Création du répertoire de données..."
sudo mkdir -p $DATA_DIR
sudo chown -R $USER:$USER $DATA_DIR

# Créer le répertoire pour docker-compose
COMPOSE_DIR="/opt/minio"
sudo mkdir -p $COMPOSE_DIR
cd $COMPOSE_DIR

# Créer docker-compose.yml
echo "📝 Création du fichier docker-compose.yml..."
cat > docker-compose.yml <<EOF
version: '3.8'

services:
  minio:
    image: minio/minio:latest
    container_name: minio
    restart: unless-stopped
    ports:
      - "127.0.0.1:9000:9000"   # API (local uniquement)
      - "127.0.0.1:9001:9001"   # Console (local uniquement)
    environment:
      MINIO_ROOT_USER: ${MINIO_USER}
      MINIO_ROOT_PASSWORD: ${MINIO_PASSWORD}
    volumes:
      - ${DATA_DIR}:/data
    command: server /data --console-address ":9001"
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 30s
      timeout: 20s
      retries: 3
EOF

# Créer .env (pour référence, mais les variables sont dans docker-compose.yml)
cat > .env <<EOF
MINIO_ROOT_USER=${MINIO_USER}
MINIO_ROOT_PASSWORD=${MINIO_PASSWORD}
EOF

chmod 600 .env

# Démarrer MinIO
echo "🚀 Démarrage de MinIO..."
docker-compose up -d

# Attendre que MinIO soit prêt
echo "⏳ Attente du démarrage de MinIO..."
sleep 10

# Vérifier le statut
if docker ps | grep -q minio; then
    echo "✅ MinIO est démarré avec succès!"
    echo ""
    echo "📋 Informations importantes:"
    echo "   - Console locale: http://localhost:9001"
    echo "   - API locale: http://localhost:9000"
    echo "   - Utilisateur: ${MINIO_USER}"
    echo "   - Mot de passe: [celui que vous avez entré]"
    echo ""
    echo "⚠️  IMPORTANT:"
    echo "   1. Configurez Nginx comme reverse proxy (voir MINIO_PRODUCTION_SETUP.md)"
    echo "   2. Obtenez des certificats SSL avec Let's Encrypt"
    echo "   3. Créez les clés d'accès dans la console MinIO"
    echo "   4. Configurez les variables d'environnement dans votre backend"
    echo ""
    echo "📖 Consultez MINIO_PRODUCTION_SETUP.md pour la suite"
else
    echo "❌ Erreur lors du démarrage de MinIO"
    docker logs minio
    exit 1
fi
