#!/bin/bash

set -e

echo "🚀 Démarrage Backend (Docker Compose + projet FHIR local)..."

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FHIR_DIR="$ROOT_DIR/backend/fhir"
EVENTS_DIR="$ROOT_DIR/backend/events"

kill_port_if_used() {
	local port="$1"
	local pids
	pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)

	if [ -n "$pids" ]; then
		echo "⚠️  Port $port déjà utilisé. Arrêt du/des processus: $pids"
		kill $pids 2>/dev/null || true
		sleep 1

		# Si un process résiste, on force l'arrêt pour éviter un échec au relancement.
		pids=$(lsof -ti tcp:"$port" 2>/dev/null || true)
		if [ -n "$pids" ]; then
			echo "⚠️  Forçage de l'arrêt sur le port $port: $pids"
			kill -9 $pids 2>/dev/null || true
			sleep 1
		fi
	fi
}

is_docker_service_running() {
	local service="$1"
	docker compose ps --status running --services 2>/dev/null | grep -qx "$service"
}

is_port_open() {
	local port="$1"
	lsof -ti tcp:"$port" >/dev/null 2>&1
}

wait_for_port() {
	local port="$1"
	local retries="${2:-20}"
	local delay="${3:-1}"

	for _ in $(seq 1 "$retries"); do
		if is_port_open "$port"; then
			return 0
		fi
		sleep "$delay"
	done

	return 1
}

print_status() {
	local label="$1"
	if [ "$2" -eq 0 ]; then
		echo "✅ $label"
	else
		echo "❌ $label"
	fi
}

if [ ! -d "$FHIR_DIR" ]; then
	echo "❌ Projet FHIR introuvable: $FHIR_DIR"
	echo "   Clone d'abord le starter dans backend/fhir"
	exit 1
fi

if [ ! -f "$FHIR_DIR/pom.xml" ]; then
	echo "❌ pom.xml introuvable dans $FHIR_DIR"
	exit 1
fi

echo "🧹 Vérification des ports backend (8081, 8090, 8091)..."
kill_port_if_used 8081
kill_port_if_used 8090
kill_port_if_used 8091

echo "🐳 Démarrage de l'infrastructure Docker (PostgreSQL + Keycloak + Jitsi)..."
cd "$ROOT_DIR"
docker compose up -d postgres postgres-events kafka keycloak jitsi-prosody jitsi-jicofo jitsi-jvb jitsi-web

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

# ────────────────────────────────────────────────────────────────────────────────
# JAVA HOME DETECTION (needed for all backends)
# ────────────────────────────────────────────────────────────────────────────────
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

# ────────────────────────────────────────────────────────────────────────────────
# Background function: Wait for postgres-events/kafka and start events-api
# This runs in parallel so FHIR/chat-bot don't get blocked by Kafka startup
# ────────────────────────────────────────────────────────────────────────────────
_wait_for_events_deps_and_start() {
	echo "⏳ [Background] Attente de PostgreSQL events..."
	for i in {1..30}; do
		if docker compose exec -T postgres-events pg_isready -U postgres -d healthapp_events_db >/dev/null 2>&1; then
			echo "✅ [Background] PostgreSQL events prêt"
			break
		fi

		if [ "$i" -eq 30 ]; then
			echo "❌ [Background] PostgreSQL events ne répond pas après 60 secondes"
			return 1
		fi

		sleep 2
	done

	echo "⏳ [Background] Attente de Kafka (readiness check)..."
	for i in {1..60}; do
		if docker compose exec -T kafka /opt/kafka/bin/kafka-cluster.sh cluster-id --bootstrap-server localhost:9092 >/dev/null 2>&1; then
			echo "✅ [Background] Kafka prêt"
			break
		fi
		if [ "$i" -eq 60 ]; then
			echo "⚠️  [Background] Kafka non disponible après 60s — Events service tentera de se reconnecter"
			break
		fi
		sleep 2
	done

	# ── Events ────────────────────────────────────────────────────────────────────
	if [ -d "$EVENTS_DIR" ] && [ -f "$EVENTS_DIR/pom.xml" ]; then
		echo ""
		echo "📨 Démarrage du service events (port 8091)..."
		echo "   - API events : http://localhost:8091/api/v1/events"
		echo "   - API notif  : http://localhost:8091/api/v1/notifications"
		cd "$EVENTS_DIR"
		EVENTS_DB_URL="jdbc:postgresql://localhost:5433/healthapp_events_db" \
		EVENTS_DB_USERNAME="postgres" \
		EVENTS_DB_PASSWORD="postgres" \
		KAFKA_BOOTSTRAP_SERVERS="localhost:9092" \
		VAPID_PUBLIC_KEY="${VAPID_PUBLIC_KEY:-BMumTj2GncVQRJryQD4BjLDzPnbZk3-8K463q34vAqJQ3iUHBn3b0KHss_4AddA9s6O4uw65OwRp-N6qOlrvCmA}" \
		VAPID_PRIVATE_KEY="${VAPID_PRIVATE_KEY:-dt6Ul8vJj6z6a6JWypI2NxN4Lg_KJjzqb58dTft2qfc}" \
		VAPID_SUBJECT="${VAPID_SUBJECT:-mailto:admin@healthapp.local}" \
		JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" mvn -q spring-boot:run &
		EVENTS_PID=$!
	else
		echo "⚠️  [Background] Dossier events introuvable ($EVENTS_DIR) — service ignoré."
		EVENTS_PID=""
	fi
}

# ────────────────────────────────────────────────────────────────────────────────
# FHIR & Chat-bot: Start immediately (don't wait for Kafka)
# ────────────────────────────────────────────────────────────────────────────────
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

echo "☕ Lancement du WAR packagé (arrière-plan)..."
HAPI_FHIR_TESTER_HOME_SERVER_ADDRESS="http://localhost:8081/fhir" \
SPRING_DATASOURCE_URL="jdbc:postgresql://localhost:5432/healthapp_db" \
SPRING_DATASOURCE_USERNAME="postgres" \
SPRING_DATASOURCE_PASSWORD="postgres" \
SPRING_DATASOURCE_DRIVER_CLASS_NAME="org.postgresql.Driver" \
HIBERNATE_DIALECT="ca.uhn.fhir.jpa.model.dialect.HapiFhirPostgresDialect" \
JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" java -Dserver.port=8081 -jar "$ROOT_WAR" &
FHIR_PID=$!

# ── Chat-bot ──────────────────────────────────────────────────────────────────
CHATBOT_DIR="$ROOT_DIR/backend/chat-bot"
if [ -d "$CHATBOT_DIR" ] && [ -f "$CHATBOT_DIR/pom.xml" ]; then
	echo ""
	echo "🤖 Démarrage du chat-bot (port 8090)..."
	echo "   - API chat : http://localhost:8090/api/v1/chat"
	echo "   - Santé    : http://localhost:8090/api/v1/chat/health"
	cd "$CHATBOT_DIR"
	JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" mvn -q spring-boot:run &
	CHATBOT_PID=$!
else
	echo "⚠️  Dossier chat-bot introuvable ($CHATBOT_DIR) — service ignoré."
	CHATBOT_PID=""
fi

# ────────────────────────────────────────────────────────────────────────────────
# Events-api: Start in background (waits for Kafka without blocking FHIR/chat-bot)
# ────────────────────────────────────────────────────────────────────────────────
_wait_for_events_deps_and_start &

# ── Arrêt propre sur Ctrl+C ───────────────────────────────────────────────────
cleanup() {
	echo ""
	echo "🛑 Arrêt des services..."
	kill "$FHIR_PID" 2>/dev/null
	[ -n "$CHATBOT_PID" ] && kill "$CHATBOT_PID" 2>/dev/null
	# Kill all child processes (including events-api launched in background function)
	jobs -p | xargs -r kill 2>/dev/null || true
	wait
	echo "✅ Services arrêtés."
}
trap cleanup INT TERM

echo ""
echo "🔎 Vérification des composants démarrés..."

postgres_status=1
postgres_events_status=1
kafka_status=1
keycloak_status=1
jitsi_status=1
fhir_status=1
events_status=1
chatbot_status=1

if is_docker_service_running "postgres"; then
	postgres_status=0
fi

if is_docker_service_running "postgres-events"; then
	postgres_events_status=0
fi

if is_docker_service_running "kafka"; then
	kafka_status=0
fi

if is_docker_service_running "keycloak"; then
	keycloak_status=0
fi

if is_docker_service_running "jitsi-prosody" \
	&& is_docker_service_running "jitsi-jicofo" \
	&& is_docker_service_running "jitsi-jvb" \
	&& is_docker_service_running "jitsi-web"; then
	jitsi_status=0
fi

if wait_for_port 8081 45 1; then
	fhir_status=0
fi

# Check events port (running in background function)
if wait_for_port 8091 45 1; then
	events_status=0
fi

if [ -n "$CHATBOT_PID" ] && wait_for_port 8090 45 1; then
	chatbot_status=0
fi

echo ""
echo "📊 Statut des composants:"
print_status "PostgreSQL" "$postgres_status"
print_status "PostgreSQL events" "$postgres_events_status"
print_status "Kafka" "$kafka_status"
print_status "Keycloak" "$keycloak_status"
print_status "Jitsi" "$jitsi_status"
print_status "FHIR (port 8081)" "$fhir_status"
print_status "Events (port 8091)" "$events_status"
if [ -n "$CHATBOT_PID" ]; then
	print_status "Chat-bot (port 8090)" "$chatbot_status"
else
	echo "❌ Chat-bot (non démarré)"
fi

echo ""
echo "✅ Backends démarrés. Appuie sur Ctrl+C pour tout arrêter."
echo "💡 Tip: FHIR + Chat-bot sont prêts immédiatement. Events-api démarre en parallèle (sans bloquer)."
wait $FHIR_PID
[ -n "$CHATBOT_PID" ] && wait $CHATBOT_PID
# Wait for all other background jobs (events-api in the background function)
wait
