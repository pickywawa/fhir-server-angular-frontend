# 📡 Documentation API

## Base URL

```
Production: http://localhost:8080 (API Gateway)
Dev Patient Service: http://localhost:8081
Dev FHIR Service: http://localhost:8082
```

## 🏥 Patient API

### 1. Créer un patient

**POST** `/api/patients`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "firstName": "Jean",
  "lastName": "Dupont",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "email": "jean.dupont@example.com",
  "phone": "+33612345678",
  "address": {
    "street": "123 Rue de la Paix",
    "city": "Paris",
    "state": "Île-de-France",
    "zipCode": "75001",
    "country": "France"
  }
}
```

**Response:** `201 Created`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "Jean",
  "lastName": "Dupont",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "email": "jean.dupont@example.com",
  "phone": "+33612345678",
  "address": {
    "street": "123 Rue de la Paix",
    "city": "Paris",
    "state": "Île-de-France",
    "zipCode": "75001",
    "country": "France"
  }
}
```

---

### 2. Récupérer tous les patients

**GET** `/api/patients`

**Response:** `200 OK`
```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "firstName": "Jean",
      "lastName": "Dupont",
      "dateOfBirth": "1990-05-15",
      "gender": "male",
      "email": "jean.dupont@example.com",
      "phone": "+33612345678",
      "address": {...}
    }
  ],
  "total": 1,
  "page": 0,
  "pageSize": 1
}
```

---

### 3. Récupérer un patient par ID

**GET** `/api/patients/{id}`

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "Jean",
  "lastName": "Dupont",
  ...
}
```

**Error Response:** `404 Not Found`
```json
{
  "timestamp": "2024-03-11T10:30:00",
  "status": 404,
  "error": "Not Found",
  "message": "Patient not found with id: xxx",
  "path": "/api/patients/xxx"
}
```

---

### 4. Mettre à jour un patient

**PUT** `/api/patients/{id}`

**Headers:**
```
Content-Type: application/json
```

**Body:**
```json
{
  "firstName": "Jean-Updated",
  "lastName": "Dupont",
  "dateOfBirth": "1990-05-15",
  "gender": "male",
  "email": "jean.updated@example.com",
  "phone": "+33612345678",
  "address": {...}
}
```

**Response:** `200 OK`
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "firstName": "Jean-Updated",
  ...
}
```

---

### 5. Supprimer un patient

**DELETE** `/api/patients/{id}`

**Response:** `204 No Content`

---

## 🔬 FHIR API

### Base URL
```
http://localhost:8082/fhir
```

### 1. Créer une ressource Patient FHIR

**POST** `/fhir/Patient`

**Headers:**
```
Content-Type: application/fhir+json
```

**Body:**
```json
{
  "resourceType": "Patient",
  "name": [{
    "family": "Dupont",
    "given": ["Jean"]
  }],
  "gender": "male",
  "birthDate": "1990-05-15",
  "telecom": [{
    "system": "email",
    "value": "jean.dupont@example.com"
  }],
  "address": [{
    "line": ["123 Rue de la Paix"],
    "city": "Paris",
    "postalCode": "75001",
    "country": "France"
  }]
}
```

**Response:** `201 Created`
```json
{
  "resourceType": "Patient",
  "id": "1",
  "meta": {
    "versionId": "1",
    "lastUpdated": "2024-03-11T10:30:00.000+00:00"
  },
  "name": [...],
  ...
}
```

---

### 2. Lire une ressource Patient FHIR

**GET** `/fhir/Patient/{id}`

**Response:** `200 OK`
```json
{
  "resourceType": "Patient",
  "id": "1",
  ...
}
```

---

### 3. Rechercher des patients FHIR

**GET** `/fhir/Patient?family=Dupont`

**Query Parameters:**
- `family` - Nom de famille
- `given` - Prénom

**Response:** `200 OK`
```json
{
  "resourceType": "Bundle",
  "type": "searchset",
  "total": 1,
  "entry": [{
    "resource": {
      "resourceType": "Patient",
      "id": "1",
      ...
    }
  }]
}
```

---

### 4. Mettre à jour une ressource Patient FHIR

**PUT** `/fhir/Patient/{id}`

**Headers:**
```
Content-Type: application/fhir+json
```

**Body:** (même structure que POST)

**Response:** `200 OK`

---

### 5. Supprimer une ressource Patient FHIR

**DELETE** `/fhir/Patient/{id}`

**Response:** `204 No Content`

---

## 🔐 Codes d'erreur

| Code | Description |
|------|-------------|
| 200 | Succès |
| 201 | Ressource créée |
| 204 | Succès sans contenu |
| 400 | Requête invalide |
| 404 | Ressource non trouvée |
| 500 | Erreur serveur |

---

## 📝 Exemples avec cURL

### Créer un patient
```bash
curl -X POST http://localhost:8080/api/patients \
  -H "Content-Type: application/json" \
  -d @patient.json
```

### Récupérer tous les patients
```bash
curl http://localhost:8080/api/patients
```

### Récupérer un patient spécifique
```bash
curl http://localhost:8080/api/patients/{id}
```

### Mettre à jour un patient
```bash
curl -X PUT http://localhost:8080/api/patients/{id} \
  -H "Content-Type: application/json" \
  -d @updated-patient.json
```

### Supprimer un patient
```bash
curl -X DELETE http://localhost:8080/api/patients/{id}
```

---

## 📝 Exemples avec Postman

1. Importez la collection Postman (à créer)
2. Configurez l'environnement avec `baseUrl = http://localhost:8080`
3. Testez les endpoints

---

## 🧪 Tests

### Vérifier la santé de l'API Gateway
```bash
curl http://localhost:8080/actuator/health
```

### Vérifier la santé du Patient Service
```bash
curl http://localhost:8081/actuator/health
```

### Vérifier le serveur FHIR
```bash
curl http://localhost:8082/fhir/metadata
```
