# Chat Bot Backend Service

This service exposes a chatbot API for healthcare workflows.
It uses a local free LLM via Ollama and can call FHIR resources on `http://localhost:8081/fhir`.

## Features

- REST chat endpoint: `POST /api/v1/chat`
- Streaming chat endpoint (SSE): `POST /api/v1/chat/stream`
- Built-in tool actions for predefined workflows:
  - search patient
  - create appointment
  - update patient identity
  - navigate to created resources

## Prerequisites

- Java 17
- Maven 3.8+
- Running FHIR backend on `http://localhost:8081/fhir`
- Ollama installed locally

## Install a free local model

Example with `qwen2.5:3b`:

```bash
ollama pull qwen2.5:3b
ollama serve
```

You can switch model with env var:

```bash
export OLLAMA_MODEL=llama3.2:3b
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
  -d '{"sessionId":"demo-1","message":"Recherche le patient Dupont"}'
```

Streaming chat request:

```bash
curl -N -X POST http://localhost:8090/api/v1/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"sessionId":"demo-1","message":"Cree un rendez-vous demain a 10h pour le patient 123"}'
```

## Configuration

Main configuration file: `src/main/resources/application.yaml`

Important keys:
- `app.fhir.base-url` (default: `http://localhost:8081/fhir`)
- `spring.ai.ollama.base-url` (default: `http://localhost:11434`)
- `spring.ai.ollama.chat.options.model` (default: `qwen2.5:3b`)
