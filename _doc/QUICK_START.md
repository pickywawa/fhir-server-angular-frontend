# 🚀 Guide de Démarrage Rapide

## 📋 Étapes pour lancer l'application

### 1️⃣ Prérequis à installer

- Node.js 18+ : https://nodejs.org/
- Java 17+ : https://adoptium.net/
- Maven 3.8+ : https://maven.apache.org/
- Docker Desktop : https://www.docker.com/products/docker-desktop/

### 2️⃣ Démarrage en 3 minutes

```bash
# 1. Démarrer PostgreSQL
./start-all.sh

# 2. Dans 4 terminaux différents, lancer:

# Terminal 1
./run-api-gateway.sh

# Terminal 2
./run-patient-service.sh

# Terminal 3
./run-fhir-service.sh

# Terminal 4
./run-frontend.sh
```

### 3️⃣ Accéder à l'application

Ouvrez votre navigateur: **http://localhost:4200**

## 🎯 Tester l'API

### Créer un patient via curl

```bash
curl -X POST http://localhost:8080/api/patients \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Marie",
    "lastName": "Martin",
    "dateOfBirth": "1985-03-20",
    "gender": "female",
    "email": "marie.martin@example.com",
    "phone": "+33612345678",
    "address": {
      "street": "456 Avenue des Champs",
      "city": "Lyon",
      "state": "Rhône-Alpes",
      "zipCode": "69001",
      "country": "France"
    }
  }'
```

### Voir tous les patients

```bash
curl http://localhost:8080/api/patients
```

## 🏗️ Structure du Projet

```
angular-test/
├── frontend/              # Angular 19 + NgRx
│   └── src/app/
│       ├── core/         # Services & Models
│       ├── features/     # Modules métier
│       └── shared/       # Composants partagés
│
├── backend/              # Microservices Spring Boot
│   ├── patient-service/ # Port 8080
│   ├── fhir-service/    # Port 8082
│   └── common/          # Librairies partagées
│
├── docker-compose.yml    # PostgreSQL
└── *.sh                 # Scripts de démarrage
```

## 🐛 Problèmes courants

### Port déjà utilisé
```bash
# Trouver le processus
lsof -i :8080
# Tuer le processus
kill -9 <PID>
```

### PostgreSQL ne démarre pas
```bash
docker-compose down
docker-compose up -d
```

### Erreurs Maven
```bash
cd backend
mvn clean install -DskipTests
```

## 📚 En savoir plus

Consultez le fichier `README.md` pour la documentation complète.

## ✅ Checklist de vérification

- [ ] Docker est installé et lancé
- [ ] PostgreSQL tourne (ports 5432 et 5433)
- [ ] API Gateway répond sur http://localhost:8080
- [ ] Patient Service répond sur http://localhost:8080
- [ ] FHIR Service répond sur http://localhost:8082
- [ ] Frontend accessible sur http://localhost:4200

## 🎉 C'est prêt!

Vous avez maintenant une application fullstack avec:
- ✅ Frontend Angular 19 avec NgRx
- ✅ Backend microservices Spring Boot
- ✅ Clean Architecture + DDD
- ✅ Serveur HAPI FHIR
- ✅ PostgreSQL
