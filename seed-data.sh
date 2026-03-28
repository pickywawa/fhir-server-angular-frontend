#!/bin/bash

echo "📝 Insertion de données de test FHIR..."

# Attendre que le service soit prêt
sleep 5

KEYCLOAK_TOKEN_ENDPOINT="http://localhost:8180/realms/fhir/protocol/openid-connect/token"
FHIR_BASE_URL="http://localhost:8080/fhir"

ACCESS_TOKEN=$(curl -s -X POST "$KEYCLOAK_TOKEN_ENDPOINT" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  --data "grant_type=password&client_id=fhir-angular&username=apicard&password=apicard" \
  | sed -n 's/.*"access_token":"\([^"]*\)".*/\1/p')

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Impossible de récupérer un token Keycloak (utilisateur apicard)."
  exit 1
fi

create_patient() {
  local payload="$1"
  local status
  status=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" -X POST "$FHIR_BASE_URL/Patient" \
    -H "Content-Type: application/fhir+json" \
    -H "Accept: application/fhir+json" \
    -H "Authorization: Bearer $ACCESS_TOKEN" \
    -d "$payload")

  if [ "$status" != "201" ] && [ "$status" != "200" ]; then
    echo "❌ Echec insertion patient (HTTP $status)"
    cat /tmp/seed_response.json
    echo ""
    exit 1
  fi
}

# Injection idempotente d'un CodeSystem (upsert via conditional update sur l'url)
upsert_code_system() {
  local file="$1"
  local cs_url
  cs_url=$(python3 -c "import sys,json; print(json.load(open('$file'))['url'])")
  local status
  status=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" \
    -X POST "$FHIR_BASE_URL/CodeSystem" \
    -H "Content-Type: application/fhir+json" \
    -H "Accept: application/fhir+json" \
    -d @"$file")

  if [ "$status" != "201" ] && [ "$status" != "200" ]; then
    echo "❌ Echec insertion CodeSystem $cs_url (HTTP $status)"
    cat /tmp/seed_response.json
    echo ""
  else
    echo "✅ CodeSystem injecté : $cs_url"
  fi
}

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "📚 Injection des nomenclatures (CodeSystems)..."
upsert_code_system "$SCRIPT_DIR/_doc/fhir-examples/code-systems/document-type-fr_FR-codesystem.json"
upsert_code_system "$SCRIPT_DIR/_doc/fhir-examples/code-systems/document-class-fr_FR-codesystem.json"
upsert_code_system "$SCRIPT_DIR/_doc/fhir-examples/code-systems/care-plan-category-fr_FR-codesystem.json"
echo ""

echo "📋 Injection des plans de soins (CarePlans)..."
for f in "$SCRIPT_DIR/_doc/fhir-examples/care-plans"/careplan-patient-*.json; do
  patient_id=$(basename "$f" .json | sed 's/careplan-patient-//')
  status=$(curl -s -o /tmp/seed_response.json -w "%{http_code}" \
    -X POST "http://localhost:8081/fhir/CarePlan" \
    -H "Content-Type: application/fhir+json" \
    -H "Accept: application/fhir+json" \
    -d @"$f")
  if [ "$status" = "201" ] || [ "$status" = "200" ]; then
    echo "✅ CarePlan injecté pour Patient/$patient_id"
  else
    echo "❌ Echec CarePlan Patient/$patient_id (HTTP $status)"
    cat /tmp/seed_response.json
    echo ""
  fi
done
echo ""

# Patient 1
create_patient '{
    "resourceType": "Patient",
    "name": [{
      "family": "Dupont",
      "given": ["Jean"]
    }],
    "gender": "male",
    "birthDate": "1990-05-15",
    "telecom": [
      {
        "system": "email",
        "value": "jean.dupont@example.com"
      },
      {
        "system": "phone",
        "value": "+33612345678"
      }
    ],
    "address": [{
      "line": ["123 Rue de la Paix"],
      "city": "Paris",
      "state": "Île-de-France",
      "postalCode": "75001",
      "country": "France"
    }]
  }'

echo ""

# Patient 2
create_patient '{
    "resourceType": "Patient",
    "name": [{
      "family": "Martin",
      "given": ["Marie"]
    }],
    "gender": "female",
    "birthDate": "1985-03-20",
    "telecom": [
      {
        "system": "email",
        "value": "marie.martin@example.com"
      },
      {
        "system": "phone",
        "value": "+33698765432"
      }
    ],
    "address": [{
      "line": ["456 Avenue des Champs"],
      "city": "Lyon",
      "state": "Rhône-Alpes",
      "postalCode": "69001",
      "country": "France"
    }]
  }'

echo ""

# Patient 3
create_patient '{
    "resourceType": "Patient",
    "name": [{
      "family": "Bernard",
      "given": ["Pierre"]
    }],
    "gender": "male",
    "birthDate": "1978-11-08",
    "telecom": [
      {
        "system": "email",
        "value": "pierre.bernard@example.com"
      },
      {
        "system": "phone",
        "value": "+33687654321"
      }
    ],
    "address": [{
      "line": ["789 Boulevard de la Mer"],
      "city": "Marseille",
      "state": "PACA",
      "postalCode": "13001",
      "country": "France"
    }]
  }'

echo ""

# Patient 4
create_patient '{
    "resourceType": "Patient",
    "name": [{
      "family": "Dubois",
      "given": ["Sophie"]
    }],
    "gender": "female",
    "birthDate": "1992-07-25",
    "telecom": [
      {
        "system": "email",
        "value": "sophie.dubois@example.com"
      },
      {
        "system": "phone",
        "value": "+33676543210"
      }
    ],
    "address": [{
      "line": ["321 Rue du Commerce"],
      "city": "Toulouse",
      "state": "Occitanie",
      "postalCode": "31000",
      "country": "France"
    }]
  }'

echo "✅ 4 patients FHIR insérés avec succès!"
echo "🌐 Ouvrez http://localhost:4200 pour les voir"
