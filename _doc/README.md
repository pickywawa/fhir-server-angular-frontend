# Documentation projet (_doc)

Ce dossier rassemble la documentation technique pour l'exploitation et la migration de la plateforme.

## Documents

- `ARCHITECTURE.md`
  - Vue globale de l'architecture applicative
  - Cartographie des composants, flux, ports, dependances
  - Inventaire des scripts de lancement

- `KUBERNETES_PREPARATION.md`
  - Guide de preparation au deploiement Kubernetes
  - Mapping docker compose -> ressources K8s
  - Variables, secrets, probes, checklist go-live

- `fhir-examples/`
  - Jeux de ressources FHIR de test (CodeSystem, CarePlan, etc.)

## Point important

L'etat actuel est optimise pour un run local via scripts shell + Docker Compose infra.
La cible Kubernetes demandera de completer la containerisation des services `events` et `chat-bot`, puis de formaliser les manifests et la gestion de configuration/secrets.
