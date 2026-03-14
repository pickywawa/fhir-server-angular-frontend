# 🏗️ Architecture du Système

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────┐
│                       FRONTEND                              │
│                    Angular 19 + NgRx                        │
│                   http://localhost:4200                     │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                 │
│  │  Core    │  │ Features │  │  Shared  │                 │
│  │ Services │  │  Patient │  │Components│                 │
│  │  Models  │  │   NgRx   │  │   Pipes  │                 │
│  └──────────┘  └──────────┘  └──────────┘                 │
└────────────────────┬────────────────────────────────────────┘
                     │ HTTP REST
                     │
┌────────────────────▼────────────────────────────────────────┐
│                    API GATEWAY                              │
│              Spring Cloud Gateway                           │
│                http://localhost:8080                        │
│                                                             │
│        ┌──────────────┐    ┌──────────────┐               │
│        │   Routing    │    │     CORS     │               │
│        │ Load Balance │    │  Security    │               │
│        └──────────────┘    └──────────────┘               │
└─────────┬──────────────────────────┬───────────────────────┘
          │                          │
          │                          │
┌─────────▼─────────────┐   ┌────────▼──────────────┐
│  PATIENT SERVICE      │   │   FHIR SERVICE        │
│   Spring Boot         │   │   HAPI FHIR           │
│  localhost:8081       │   │  localhost:8082       │
│                       │   │                       │
│  ┌────────────────┐   │   │  ┌────────────────┐  │
│  │    Domain      │   │   │  │  FHIR Resources│  │
│  │  - Patient     │   │   │  │   - Patient    │  │
│  │  - Address     │   │   │  │   - CRUD Ops   │  │
│  │  - Business    │   │   │  │   - Search     │  │
│  └────────────────┘   │   │  └────────────────┘  │
│  ┌────────────────┐   │   │                       │
│  │  Application   │   │   │                       │
│  │  - Use Cases   │   │   │                       │
│  │  - DTOs        │   │   │                       │
│  └────────────────┘   │   │                       │
│  ┌────────────────┐   │   │                       │
│  │Infrastructure  │   │   │                       │
│  │  - JPA Repos   │   │   │                       │
│  │  - Controllers │   │   │                       │
│  └────────┬───────┘   │   │                       │
└───────────┼───────────┘   └──────────┬────────────┘
            │                          │
            │                          │
┌───────────▼────────────┐   ┌─────────▼─────────────┐
│   PostgreSQL           │   │   PostgreSQL          │
│   Patient DB           │   │   FHIR DB             │
│   localhost:5432       │   │   localhost:5433      │
│                        │   │                       │
│  ┌─────────────────┐   │   │  ┌─────────────────┐  │
│  │  patients       │   │   │  │  hfj_resource   │  │
│  │  - id (PK)      │   │   │  │  - res_id (PK)  │  │
│  │  - first_name   │   │   │  │  - res_type     │  │
│  │  - last_name    │   │   │  │  - res_text     │  │
│  │  - dob          │   │   │  │  ...            │  │
│  │  - gender       │   │   │  └─────────────────┘  │
│  │  - email        │   │   │                       │
│  │  - address...   │   │   │                       │
│  └─────────────────┘   │   │                       │
└────────────────────────┘   └───────────────────────┘
```

## 🔄 Flux de données

### 1. Chargement des patients

```
User → Angular Component
       ↓ dispatch(loadPatients)
     NgRx Store
       ↓ Effect
     Patient Service (API call)
       ↓ HTTP GET
     API Gateway :8080
       ↓ Route to
     Patient Service :8081
       ↓ Use Case
     Domain Repository
       ↓ JPA
     PostgreSQL
       ↓ Return
     Back through the chain
       ↓ dispatch(loadPatientsSuccess)
     NgRx Store (update state)
       ↓ selector
     Angular Component (display)
```

### 2. Création d'un patient

```
User fills form → Component
       ↓ dispatch(createPatient)
     NgRx Effect
       ↓ HTTP POST
     API Gateway
       ↓
     Patient Service Controller
       ↓
     PatientUseCase.createPatient()
       ↓
     PatientDomainService.validate()
       ↓
     PatientRepository.save()
       ↓
     JPA → PostgreSQL
       ↓
     Return Patient DTO
       ↓
     dispatch(createPatientSuccess)
       ↓
     Update NgRx Store
       ↓
     Component re-renders
```

## 📦 Modules et Responsabilités

### Frontend (Angular)

- **Core**: Services globaux, modèles, guards
- **Features/Patient**: Logique métier patient isolée
  - Components: UI
  - State: NgRx (actions, reducers, effects, selectors)
  - Services: Communication API
- **Shared**: Composants réutilisables

### Backend (Spring Boot)

#### Patient Service (Clean Architecture + DDD)

**Domain Layer** (Cœur métier)
- `Patient` entity
- `Address` value object
- `PatientRepository` interface
- `PatientDomainService` (règles métier)

**Application Layer** (Orchestration)
- `PatientUseCase` (CRUD operations)
- `PatientDTO` (Data Transfer Objects)

**Infrastructure Layer** (Détails techniques)
- `PatientEntity` (JPA)
- `JpaPatientRepository`
- `PatientRepositoryImpl` (Adapter)
- `PatientController` (REST API)

#### FHIR Service

- Resource Providers (Patient, etc.)
- HAPI FHIR Server configuration
- PostgreSQL persistence

#### API Gateway

- Routes configuration
- CORS handling
- Load balancing (futur)

## 🔐 Principes appliqués

1. **Separation of Concerns**: Chaque couche a sa responsabilité
2. **Dependency Inversion**: Les dépendances pointent vers l'intérieur
3. **Domain-Driven Design**: Le domaine métier au centre
4. **CQRS**: Séparation lecture/écriture dans les use cases
5. **Reactive Programming**: RxJS pour la gestion asynchrone
6. **Immutability**: NgRx state immutable
7. **Microservices**: Services indépendants et déployables séparément
