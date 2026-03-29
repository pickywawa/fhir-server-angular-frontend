#!/bin/bash

echo "🚀 Démarrage du Frontend Angular..."

NODE22_BIN="/opt/homebrew/opt/node@22/bin"
if [ ! -x "$NODE22_BIN/node" ]; then
	echo "❌ Node 22 introuvable. Installe-le avec: brew install node@22"
	exit 1
fi

cd frontend
PATH="$NODE22_BIN:$PATH" npm run ng -- serve --host 0.0.0.0 --port 4200
