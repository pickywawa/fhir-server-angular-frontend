#!/bin/bash

echo "📝 Insertion de données de test FHIR..."

# Attendre que le service soit prêt
sleep 5

# Patient 1
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
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
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
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
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
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
curl -X POST http://localhost:8080/fhir/Patient \
  -H "Content-Type: application/fhir+json" \
  -d '{
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

echo ""
echo "✅ 4 patients FHIR insérés avec succès!"
echo "🌐 Ouvrez http://localhost:4200 pour les voir"
