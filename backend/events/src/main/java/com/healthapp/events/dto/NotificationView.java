package com.healthapp.events.dto;

import com.healthapp.events.model.NotificationPriority;
import java.time.Instant;
import java.util.UUID;

public record NotificationView(
    UUID id,
    String userId,
    String eventId,
    String type,
    String title,
    String message,
    String actorUserId,
    String metadataJson,
    boolean acknowledged,
    Instant createdAt,
    Instant acknowledgedAt,
    NotificationPriority priority
) {
}
