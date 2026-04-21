package com.healthapp.events.service.dispatch;

import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;

import java.util.EnumSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Carries the data needed to dispatch a notification across one or more channels.
 *
 * @param userId      Target user identifier.
 * @param title       Short title of the notification.
 * @param message     Full notification body.
 * @param priority    Priority level (LOW, MEDIUM, HIGH, CRITICAL).
 * @param channels    Set of delivery channels to use. Can be empty (no delivery).
 * @param notificationId Optional notification database ID (UUID for tracking in push payloads).
 * @param type        Notification type identifier.
 * @param category    Notification category key.
 * @param subcategory Notification subcategory key.
 * @param metadata    Additional metadata included in push payload.
 */
public record DispatchRequest(
    String userId,
    String title,
    String message,
    NotificationPriority priority,
    Set<NotificationChannel> channels,
    UUID notificationId,
    String type,
    String category,
    String subcategory,
    Map<String, Object> metadata
) {
    public DispatchRequest(String userId, String title, String message, NotificationPriority priority, Set<NotificationChannel> channels) {
        this(userId, title, message, priority, channels, null, null, null, null, null);
    }

    public DispatchRequest(
        String userId,
        String title,
        String message,
        NotificationPriority priority,
        Set<NotificationChannel> channels,
        UUID notificationId
    ) {
        this(userId, title, message, priority, channels, notificationId, null, null, null, null);
    }

    public static DispatchRequest push(String userId, String title, String message, NotificationPriority priority) {
        return new DispatchRequest(userId, title, message, priority, EnumSet.of(NotificationChannel.PUSH));
    }

    public static DispatchRequest email(String userId, String title, String message, NotificationPriority priority) {
        return new DispatchRequest(userId, title, message, priority, EnumSet.of(NotificationChannel.EMAIL));
    }

    public static DispatchRequest sms(String userId, String title, String message, NotificationPriority priority) {
        return new DispatchRequest(userId, title, message, priority, EnumSet.of(NotificationChannel.SMS));
    }

    public static DispatchRequest allChannels(String userId, String title, String message, NotificationPriority priority) {
        return new DispatchRequest(userId, title, message, priority, EnumSet.allOf(NotificationChannel.class));
    }
}
