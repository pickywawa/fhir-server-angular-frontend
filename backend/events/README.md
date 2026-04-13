# Events Microservice

Microservice Spring Boot dedie a la gestion des evenements applicatifs et notifications personnelles.

## Capacites

- Publication d'evenements metier vers Kafka.
- Consommation des evenements et creation de notifications personnelles par utilisateur.
- Stockage persistant des notifications dans PostgreSQL (base dediee).
- Acquittement unitaire ou global des notifications.

## Endpoints principaux

- `POST /api/v1/events/publish`
- `GET /api/v1/notifications/{userId}`
- `POST /api/v1/notifications/{notificationId}/ack?userId={userId}`
- `POST /api/v1/notifications/{userId}/ack-all`
- `GET /api/v1/events/health`

## Exemple de payload de publication

```json
{
  "type": "CARE_TEAM_MEMBER_ADDED",
  "title": "Nouveau membre dans l'equipe",
  "message": "Dr Martin a rejoint l'equipe de prise en charge",
  "actorUserId": "practitioner-1",
  "recipientUserIds": ["practitioner-2", "practitioner-3"],
  "metadata": {
    "patientId": "123",
    "careTeamId": "ct-42"
  }
}
```
