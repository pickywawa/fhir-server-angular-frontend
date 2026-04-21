# Architecture du projet HealthApp

## 1) Vue d'ensemble

Le projet est une application sante basee sur FHIR avec:
- un frontend Angular (SPA)
- un serveur FHIR principal (HAPI FHIR JPA)
- un microservice Events (Kafka + Postgres)
- un microservice Chat-bot (Spring AI + Ollama)
- des services d'infrastructure (Postgres, Kafka, Keycloak, Jitsi)

En local, l'infrastructure est orchestree par `docker-compose.yml` et les backends Java sont lances via `run-backend.sh`.

## 2) Structure repository

- `frontend/`: application Angular
- `backend/fhir/`: serveur FHIR principal (HAPI FHIR, port 8081)
- `backend/events/`: service notifications/evenements (port 8091)
- `backend/chat-bot/`: service chat IA (port 8090)
- `docker-compose.yml`: infra locale (db, kafka, keycloak, jitsi)
- `run-backend.sh`: bootstrap de l'infra et demarrage des services Java
- `run-frontend.sh`: lancement Angular en dev sur 4200
- `seed-data.sh`: injection de donnees FHIR de test

## 3) Composants runtime

| Composant | Tech | Port | Role | Dependances |
|---|---|---:|---|---|
| Frontend | Angular 21 | 4200 | UI metier, routing, auth guard | FHIR, Events, Chat-bot, Keycloak, Jitsi |
| FHIR API | HAPI FHIR JPA (Spring Boot) | 8081 | API FHIR R4, persistence clinique | Postgres, (optionnel: Elastic), Keycloak (selon usage OAuth) |
| Events API | Spring Boot | 8091 | Publication/consommation events + notifications | Kafka, Postgres events |
| Chat-bot API | Spring Boot WebFlux + Spring AI | 8090 | Chat synchrone/SSE + tools FHIR | FHIR API, Ollama |
| Postgres | postgres:15-alpine | 5432 | Base principale FHIR | FHIR API |
| Postgres Events | postgres:15-alpine | 5433->5432 | Base notifications/events | Events API |
| Kafka | apache/kafka:3.9.0 | 9092 | Bus d'evenements | Events API |
| Keycloak | keycloak:26.1 | 8180 | IAM/OIDC | Frontend |
| Jitsi stack | jitsi web/prosody/jicofo/jvb | 8443, 8082, 10000/udp | Visioconference | Frontend |

## 4) Flux applicatifs principaux

### 4.1 UI -> FHIR
- Le frontend utilise `ApiService` avec `environment.apiUrl`.
- En dev: `http://localhost:8081/fhir`.
- Ressources majeures: Patient, CarePlan, Questionnaire, Communication, DocumentReference, Appointment, etc.

### 4.2 UI -> Events
- `NotificationService` consomme `eventsApiUrl/api/v1/notifications`.
- Polling toutes les 10s pour les notifications utilisateur.

### 4.3 UI -> Chat-bot
- `ChatBotService` appelle `chatBotUrl/api/v1/chat`.
- Streaming SSE via `POST /api/v1/chat/stream`.
- Le chat-bot appelle ensuite FHIR via `app.fhir.base-url`.

### 4.4 Events interne
- `POST /api/v1/events/publish` publie vers Kafka.
- `EventConsumer` consomme Kafka et persiste des notifications en base events.

### 4.5 Authentification
- Frontend base sur Keycloak JS (`check-sso`, OIDC).
- Config via `keycloakUrl`, `keycloakRealm`, `keycloakClientId`.

## 5) Endpoints clefs

### Frontend
- `http://localhost:4200`

### FHIR
- `http://localhost:8081/fhir`
- `http://localhost:8081/fhir/metadata`
- `http://localhost:8081/actuator/health`

### Events
- `GET /api/v1/events/health`
- `POST /api/v1/events/publish`
- `GET /api/v1/notifications/{userId}`
- `POST /api/v1/notifications/{notificationId}/ack`
- `POST /api/v1/notifications/{userId}/ack-all`

### Chat-bot
- `GET /api/v1/chat/health`
- `POST /api/v1/chat`
- `POST /api/v1/chat/stream` (SSE)

## 6) Configuration et variables importantes

### Frontend (`frontend/src/environments/environment.ts`)
- `apiUrl`
- `eventsApiUrl`
- `chatBotUrl`
- `keycloakUrl`
- `keycloakRealm`
- `keycloakClientId`
- `jitsiDomain`
- `jitsiScriptUrl`

### FHIR (`backend/fhir/src/main/resources/application.yaml`)
- `server.port=8081`
- datasource via `SPRING_DATASOURCE_URL/USERNAME/PASSWORD`
- dialect via `HIBERNATE_DIALECT`
- CORS configure avec `allowed_origin: ["*"]` par defaut

### Events (`backend/events/src/main/resources/application.yaml`)
- `server.port=8091`
- `EVENTS_DB_URL`, `EVENTS_DB_USERNAME`, `EVENTS_DB_PASSWORD`
- `KAFKA_BOOTSTRAP_SERVERS`
- `EVENTS_TOPIC`

### Chat-bot (`backend/chat-bot/src/main/resources/application.yaml`)
- `server.port=8090`
- `FHIR_BASE_URL`
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL`

## 7) Scripts d'execution (etat actuel)

### `run-backend.sh`
- tue les process sur 8081/8090/8091 si besoin
- lance compose: postgres, postgres-events, kafka, keycloak, jitsi-*
- build et lance `backend/fhir` (WAR) sur 8081
- lance `backend/events` sur 8091
- lance `backend/chat-bot` sur 8090

### `run-frontend.sh`
- impose Node 22 Homebrew (`/opt/homebrew/opt/node@22/bin`)
- lance Angular dev server sur 4200

### `seed-data.sh`
- recupere token Keycloak
- injecte CodeSystems, CarePlans, puis Patients
- utilise majoritairement FHIR en `http://localhost:8081/fhir`
- note: une variable `FHIR_BASE_URL` interne est initialisee sur `http://localhost:8080/fhir` mais les appels principaux patient/careplan ciblent 8081

## 8) Contraintes et points d'attention architecture

- CORS Events est restreint a `http://localhost:4200` (a rendre configurable en env en prod).
- CORS Chat-bot autorise `*` (a durcir en prod).
- `docker-compose.yml` decrit seulement l'infra, pas les 3 services applicatifs Java.
- Un seul Dockerfile detecte: `backend/fhir/Dockerfile`.
  - Aucun Dockerfile present pour `backend/events` et `backend/chat-bot`.
- Le frontend prod contient encore des URLs placeholder (`*.production.com`) a parametrer avant deploiement reel.

## 9) Cible d'architecture pour Kubernetes

Cible recommandee:
- Namespace dedie (ex: `healthapp`)
- 4 Deployments applicatifs: frontend, fhir-api, events-api, chat-bot
- 4+ Deployments/stateful tiers techniques: keycloak, kafka, postgres, postgres-events (ou services managés)
- Ingress unique avec routage par host/path
- ConfigMaps/Secrets pour externaliser toute config runtime
- Probes liveness/readiness sur tous les pods

Le detail operationnel est documente dans `_doc/KUBERNETES_PREPARATION.md`.
