#!/bin/bash

echo "🏥 =========================================="
echo "   Application Fullstack - Gestion Patients"
echo "   Architecture simplifiée avec HAPI FHIR"
echo "   =========================================="
echo ""

# Couleurs
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Vérifier Docker
echo -e "${BLUE}🔍 Vérification de Docker...${NC}"
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker n'est pas installé. Veuillez l'installer.${NC}"
    exit 1
fi

# Démarrer PostgreSQL
echo -e "${BLUE}🐘 Démarrage de PostgreSQL avec Docker Compose...${NC}"
docker-compose up -d

echo ""
echo -e "${GREEN}✅ PostgreSQL démarré!${NC}"
echo "   - Database: localhost:5432 (healthapp_db)"
echo ""

# Attendre que PostgreSQL soit prêt
echo -e "${BLUE}⏳ Attente du démarrage de PostgreSQL (10 secondes)...${NC}"
sleep 10

echo ""
echo -e "${YELLOW}📋 Instructions pour démarrer les services:${NC}"
echo ""
echo "Ouvrez 2 terminaux différents et exécutez:"
echo ""
echo "Terminal 1 - Backend Service (HAPI FHIR):"
echo "  ./run-backend.sh"
echo ""
echo "Terminal 2 - Frontend Angular:"
echo "  ./run-frontend.sh"
echo ""
echo -e "${GREEN}✨ Une fois tous les services démarrés:${NC}"
echo "   Frontend: http://localhost:4200"
echo "   Backend FHIR: http://localhost:8080/fhir"
echo "   FHIR Metadata: http://localhost:8080/fhir/metadata"
echo ""
