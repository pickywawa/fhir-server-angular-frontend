# ✅ Projet Simplifié - README

## 🎉 Architecture Simplifiée

Votre projet a été simplifié avec succès !

### Structure Finale

```
angular-test/
├── frontend/                    # Angular 19 + NgRx
│   └── src/app/
│       ├── core/               # Services & Models
│       ├── features/patient/   # Module Patient avec NgRx
│       └── shared/
│
├── backend/
│   └── backend-service/        # Service unique Spring Boot + HAPI FHIR
│       ├── config/            # Configuration
│       └── provider/          # Patient Resource Provider
│
├── docker-compose.yml          # PostgreSQL
├── start-all.sh               # Démarrer PostgreSQL
├── run-backend.sh             # Démarrer le backend
├── run-frontend.sh            # Démarrer le frontend
└── seed-data.sh               # Données de test
```

## 🚀 Démarrage Rapide

### 1. Démarrer PostgreSQL
```bash
./start-all.sh
```

### 2. Terminal 1 - Backend
```bash
./run-backend.sh
```
**URL**: http://localhost:8080/fhir

### 3. Terminal 2 - Frontend  
```bash
./run-frontend.sh
```
**URL**: http://localhost:4200

### 4. Ajouter des données
```bash
./seed-data.sh
```

## 🌐 URLs

- **Frontend**: http://localhost:4200
- **Backend FHIR**: http://localhost:8080/fhir
- **FHIR Metadata**: http://localhost:8080/fhir/metadata
- **PostgreSQL**: localhost:5432

## 📚 Stack

**Frontend**: Angular 19 + NgRx + RxJS
**Backend**: Spring Boot + HAPI FHIR R4
**Database**: PostgreSQL 15

## ✨ Changements

✅ Supprimé: API Gateway, Patient Service microservice, Module Common
✅ Conservé: Un seul service backend avec HAPI FHIR
✅ Frontend dialogue directement avec HAPI FHIR
✅ Architecture simplifiée mais puissante

---

Consultez `README.md` pour la documentation complète.
