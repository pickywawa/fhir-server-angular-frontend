#!/bin/bash

echo "🚀 Démarrage du Backend Service (HAPI FHIR)..."

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

cd backend/backend-service
JAVA_HOME="$JAVA17_HOME" PATH="$JAVA17_HOME/bin:$PATH" mvn spring-boot:run
