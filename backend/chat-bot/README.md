# Chat Bot Backend Service

Service de chat backend refondu autour de LangChain4j + Ollama.
Le mode de fonctionnement est iteratif: le modele peut enchaîner plusieurs appels tools FHIR avant de finaliser la reponse.

## Features

- REST chat endpoint: `POST /api/v1/chat`
- Streaming chat endpoint (SSE): `POST /api/v1/chat/stream`
- Agent LangChain4j avec memoire de conversation
- Modele par defaut: Mixtral 8x7B avec fenetre 32K (`num_ctx=32768`)
- Tools FHIR iteratifs exposes au modele:
  - recherche de ressources
  - lecture de ressource
  - creation / mise a jour
  - lecture metadata FHIR
- Streaming SSE avec evenements de progression:
  - `start`
  - `tool:*`
  - `chunk`
  - `error`
  - `done`

## Prerequisites

- Java 17
- Maven 3.8+
- Running FHIR backend on `http://localhost:8081/fhir`
- Ollama installed locally

## Installer le modele Mixtral

Exemple:

```bash
ollama pull mixtral:8x7b-instruct-v0.1-q4_K_M
ollama serve
```

Variables utiles:

```bash
export OLLAMA_BASE_URL=http://localhost:11434
export OLLAMA_MODEL=mixtral:8x7b-instruct-v0.1-q4_K_M
export OLLAMA_NUM_CTX=32768
export FHIR_BASE_URL=http://localhost:8081/fhir
```

## Run locally

```bash
cd backend/chat-bot
mvn spring-boot:run
```

Service URL:
- `http://localhost:8090`

## API examples

Chat request:

```bash
curl -X POST http://localhost:8090/api/v1/chat \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-1","message":"Donne-moi un resume du patient Dupont"}'
```

Streaming chat request (SSE):

```bash
curl -N -X POST http://localhost:8090/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-1","message":"Cherche les rendez-vous du patient 123 et propose un recap"}'
```

## Configuration

Main configuration file: `src/main/resources/application.yaml`

Important keys:
- `app.fhir.base-url` (default: `http://localhost:8081/fhir`)
- `app.chatbot.ollama.base-url` (default: `http://localhost:11434`)
- `app.chatbot.ollama.model` (default: `mixtral:8x7b-instruct-v0.1-q4_K_M`)
- `app.chatbot.ollama.num-ctx` (default: `32768`)
- `app.chatbot.system-prompt` (strategie agentique iterative)
