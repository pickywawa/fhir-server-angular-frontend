# Preparation au deploiement Kubernetes

Ce document sert de base de travail pour migrer l'execution locale (scripts + docker compose) vers Kubernetes.

## 1) Objectif

Passer d'un mode local compose + process Java a une plateforme K8s reproductible, observable et securisee.

## Profil retenu (avril 2026)

- Cible: k3s
- Ingress: active
- Autoscaling: active (min 1, max 3)
- Point de depart: 1 replica par service
- HA: non forcee dans l'immediat (a reevaluer)
- Infra via Helm: postgres, kafka, keycloak, jitsi
- Containerisation applicative: frontend, fhir, events, chat-bot
- Observabilite: Prometheus + Grafana + Loki
- CI/CD: hors scope immediate
- Auto-reparation: assuree par Deployments + probes liveness/readiness

## 2) Mapping Docker Compose -> Kubernetes

| Compose | Cible K8s | Remarque |
|---|---|---|
| `postgres` | StatefulSet + Service + PVC | Base FHIR |
| `postgres-events` | StatefulSet + Service + PVC | Base events |
| `kafka` | StatefulSet + Service | idealement operator (Strimzi) |
| `keycloak` | Deployment + Service + Ingress | config realm via import/CLI |
| `jitsi-*` | Deployments + Services + Ingress/UDP | complexite reseau elevee |
| (non present dans compose) `fhir` | Deployment + Service | image deja facilitée par Dockerfile |
| (non present dans compose) `events` | Deployment + Service | Dockerfile a creer |
| (non present dans compose) `chat-bot` | Deployment + Service | Dockerfile a creer |
| `frontend` | Deployment + Service + Ingress | build Angular + serveur web |

## 3) Ressources Kubernetes minimales

- `Namespace`: `healthapp`
- `ConfigMap`: urls, ports, options non sensibles
- `Secret`: mots de passe DB, secrets Kafka/Keycloak, credentials IA
- `Deployment` + `Service` pour frontend/fhir/events/chat-bot
- `StatefulSet` + `PVC` pour postgres/postgres-events/kafka (si non managé)
- `Ingress` pour exposer frontend + APIs
- `NetworkPolicy` pour limiter les flux est-ouest
- `HPA` (optionnel initialement) pour frontend et APIs

## 4) Variables d'environnement a externaliser

## Frontend
- `apiUrl`
- `eventsApiUrl`
- `chatBotUrl`
- `keycloakUrl`
- `keycloakRealm`
- `keycloakClientId`
- `jitsiDomain`
- `jitsiScriptUrl`

## FHIR API
- `SPRING_DATASOURCE_URL`
- `SPRING_DATASOURCE_USERNAME`
- `SPRING_DATASOURCE_PASSWORD`
- `HIBERNATE_DIALECT`

## Events API
- `EVENTS_DB_URL`
- `EVENTS_DB_USERNAME`
- `EVENTS_DB_PASSWORD`
- `KAFKA_BOOTSTRAP_SERVERS`
- `EVENTS_TOPIC`

## Chat-bot API
- `FHIR_BASE_URL`
- `OLLAMA_BASE_URL`
- `OLLAMA_MODEL`
- `OLLAMA_CONNECT_TIMEOUT`
- `OLLAMA_READ_TIMEOUT`

## 5) Health checks / probes recommandees

- Frontend:
  - liveness: `GET /` (ou endpoint health Nginx)
  - readiness: `GET /`
- FHIR:
  - liveness: `GET /actuator/health/liveness`
  - readiness: `GET /actuator/health/readiness`
- Events:
  - liveness/readiness: `GET /actuator/health` ou `GET /api/v1/events/health`
- Chat-bot:
  - liveness/readiness: `GET /actuator/health` ou `GET /api/v1/chat/health`

## 6) Securite et hardening

- Interdire les CORS wildcard en production (chat-bot, fhir).
- Rendre `events` CORS configurable (pas hardcode localhost).
- Utiliser TLS via Ingress Controller (cert-manager si possible).
- Stocker credentials uniquement dans `Secret`.
- Activer policies de securite pod:
  - `runAsNonRoot: true`
  - `readOnlyRootFilesystem: true` quand possible
  - drop capabilities
- Journalisation centralisee (ELK/Loki) + traces OpenTelemetry si activees.

## 7) Gaps a combler avant deploiement

1. Creer un Dockerfile pour `backend/events`.
2. Creer un Dockerfile pour `backend/chat-bot`.
3. Definir image runtime du frontend (Nginx/Caddy) + gestion SPA routes.
4. Remplacer les URLs placeholder de `environment.prod.ts` par de vraies valeurs injectees au build/deploiement.
5. Clarifier la dependance Ollama:
   - mode dev: Ollama local
   - mode prod: service Ollama dedie ou provider LLM managé
6. Verifier `seed-data.sh` (coherence 8080 vs 8081).
7. Strategy Keycloak:
   - in-cluster (simple)
   - ou service IAM managé (recommande selon contexte).
8. Strategy Kafka:
   - in-cluster via operator
   - ou service managé (recommande en production).

## 8) Plan de migration en 4 phases

## Phase 1 - Containerisation
- Dockerfile `events` et `chat-bot`
- image frontend de production
- build CI des 4 images applicatives

## Phase 2 - Manifests de base
- namespace, configmaps, secrets
- deployments/services frontend/fhir/events/chat-bot
- ingress de base

## Phase 3 - Data & middleware
- postgres/postgres-events (stateful + backup)
- kafka (operator ou managé)
- keycloak + import realms

## Phase 4 - Production readiness
- probes + HPA
- network policies
- monitoring/alerting
- tests de charge + plan rollback

## 9) Checklist Go-Live Kubernetes

- [ ] Images versionnees et poussees en registry
- [ ] Secrets injectes via mecanisme securise
- [ ] TLS actif sur tous les endpoints publics
- [ ] Probes OK (readiness/liveness)
- [ ] Persistence validee (PVC + backup)
- [ ] CORS verrouille selon domaines reels
- [ ] Observabilite active (metrics/logs/traces)
- [ ] Test de restauration DB execute
- [ ] Test de rollback applicatif execute
- [ ] Runbook incident documente
