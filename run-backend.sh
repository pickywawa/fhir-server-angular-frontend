#!/bin/bash

set -e

echo "🚀 Démarrage Backend (Docker Compose + projet FHIR local)..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FHIR_DIR="$ROOT_DIR/backend/fhir"

if [ ! -d "$FHIR_DIR" ]; then
	echo "❌ Projet FHIR introuvable: $FHIR_DIR"
	echo "   Clone d'abord le starter dans backend/fhir"
	exit 1
fi

if [ ! -f "$FHIR_DIR/pom.xml" ]; then
	echo "❌ pom.xml introuvable dans $FHIR_DIR"
	exit 1
fi

echo "🐳 Démarrage de l'infrastructure Docker (PostgreSQL + Keycloak + Jitsi)..."
cd "$ROOT_DIR"
docker compose up -d postgres keycloak jitsi-prosody jitsi-jicofo jitsi-jvb jitsi-web

echo "⏳ Attente de PostgreSQL..."
for i in {1..30}; do
	if docker compose exec -T postgres pg_isready -U postgres -d healthapp_db >/dev/null 2>&1; then
		echo "✅ PostgreSQL prêt"
		break
	fi

	if [ "$i" -eq 30 ]; then
		echo "❌ PostgreSQL ne répond pas après 60 secondes"
		exit 1
	fi

	sleep 2
done

JAVA17_HOME=$(/usr/libexec/java_home -v 17 2>/dev/null)
if [ -z "$JAVA17_HOME" ] || [ ! -x "$JAVA17_HOME/bin/java" ] || ! "$JAVA17_HOME/bin/java" -version 2>&1 | grep -q '"17'; then
	JAVA17_HOME="/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"
fi

if [ ! -x "$JAVA17_HOME/bin/java" ]; then
	echo "❌ Java 17 introuvable. Installe Java 17 pour démarrer le backend."
	exit 1
fi

if ! "$JAVA17_HOME/bin/java" -version 2>&1 | grep -q '"17'; then
	echo "❌ Le JDK détecté n'est pas Java 17: $JAVA17_HOME"
	exit 1
fi

echo "☕ Lancement du projet FHIR local ($FHIR_DIR)..."
echo "🌐 URLs backend:"
echo "   - UI admin/tester: http://localhost:8081/"
echo "   - API FHIR: http://localhost:8081/fhir"
echo "   - Metadata: http://localhost:8081/fhir/metadata"
cd "$FHIR_DIR"

echo "📦 Construction du WAR local (inclut l'overlay UI du starter)..."
JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" mvn -DskipTests package

ROOT_WAR="$FHIR_DIR/target/ROOT.war"
if [ ! -f "$ROOT_WAR" ]; then
	echo "❌ WAR introuvable après le build: $ROOT_WAR"
	exit 1
fi

echo "☕ Lancement du WAR packagé..."
HAPI_FHIR_TESTER_HOME_SERVER_ADDRESS="http://localhost:8081/fhir" \
SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/healthapp_db" \
SPRING_DATASOURCE_USERNAME="postgres" \
SPRING_DATASOURCE_PASSWORD="postgres" \
SPRING_DATASOURCE_DRIVER_CLASS_NAME="org.postgresql.Driver" \
HIBERNATE_DIALECT="ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgresDialect" \
JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" java -Dserver.port=8081 -jar "$ROOT_WAR"
