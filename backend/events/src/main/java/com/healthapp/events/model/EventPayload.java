package com.healthapp.events.model;

import java.time.Instant;
import java.util.List;
import java.util.Map;

public record EventPayload(
    String eventId,
    String type,
    String title,
    String message,
    String actorUserId,
    List<String> recipientUserIds,
    Map<String, Object> metadata,
    Instant occurredAt,
    NotificationPriority priority
) {
}
