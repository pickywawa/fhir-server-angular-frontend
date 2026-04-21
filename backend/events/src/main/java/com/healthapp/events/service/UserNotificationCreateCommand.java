package com.healthapp.events.service;

import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;

import java.time.Instant;
import java.util.Map;
import java.util.Set;

/**
 * Command used to create and dispatch a user notification.
 */
public record UserNotificationCreateCommand(
    String userId,
    String eventId,
    String type,
    String title,
    String message,
    String actorUserId,
    String category,
    String subcategory,
    NotificationPriority priority,
    Set<NotificationChannel> channels,
    Map<String, Object> metadata,
    Instant occurredAt
) {
}
