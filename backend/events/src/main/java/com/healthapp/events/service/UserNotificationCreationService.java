package com.healthapp.events.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.events.model.EventPayload;
import com.healthapp.events.model.Notification;
import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;
import com.healthapp.events.repository.NotificationRepository;
import com.healthapp.events.service.dispatch.DispatchRequest;
import com.healthapp.events.service.dispatch.NotificationDispatcher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
public class UserNotificationCreationService {

    private final NotificationRepository notificationRepository;
    private final NotificationDispatcher notificationDispatcher;
    private final ObjectMapper objectMapper;

    public UserNotificationCreationService(
        NotificationRepository notificationRepository,
        NotificationDispatcher notificationDispatcher,
        ObjectMapper objectMapper
    ) {
        this.notificationRepository = notificationRepository;
        this.notificationDispatcher = notificationDispatcher;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public Notification createAndDispatch(UserNotificationCreateCommand command) {
        Notification notification = new Notification();
        notification.setUserId(command.userId());
        notification.setEventId(command.eventId() == null || command.eventId().isBlank()
            ? UUID.randomUUID().toString()
            : command.eventId());
        notification.setType(command.type() == null || command.type().isBlank() ? "GENERIC" : command.type());
        notification.setTitle(command.title() == null || command.title().isBlank()
            ? "Nouvelle notification"
            : command.title());
        notification.setMessage(command.message() == null ? "" : command.message());
        notification.setActorUserId(command.actorUserId());
        notification.setMetadataJson(toJson(buildMetadata(command)));
        notification.setAcknowledged(false);
        notification.setCreatedAt(command.occurredAt() == null ? Instant.now() : command.occurredAt());
        notification.setPriority(command.priority() == null ? NotificationPriority.LOW : command.priority());

        Notification saved = notificationRepository.save(notification);

        notificationDispatcher.dispatch(new DispatchRequest(
            saved.getUserId(),
            saved.getTitle(),
            saved.getMessage(),
            saved.getPriority(),
            safeChannels(command.channels()),
            saved.getId(),
            saved.getType(),
            command.category(),
            command.subcategory(),
            buildMetadata(command)
        ));

        return saved;
    }

    @Transactional
    public int createAndDispatchFromEvent(EventPayload payload) {
        if (payload.recipientUserIds() == null || payload.recipientUserIds().isEmpty()) {
            return 0;
        }

        int created = 0;
        String eventId = payload.eventId() == null || payload.eventId().isBlank()
            ? UUID.randomUUID().toString()
            : payload.eventId();

        String category = readMetadataValue(payload.metadata(), "category");
        String subcategory = readMetadataValue(payload.metadata(), "subcategory");
        Set<NotificationChannel> channels = parseChannels(payload.metadata() == null ? null : payload.metadata().get("channels"));

        for (String userId : payload.recipientUserIds()) {
            if (userId == null || userId.isBlank()) {
                continue;
            }

            createAndDispatch(new UserNotificationCreateCommand(
                userId,
                eventId,
                payload.type(),
                payload.title(),
                payload.message(),
                payload.actorUserId(),
                category,
                subcategory,
                payload.priority(),
                channels,
                payload.metadata(),
                payload.occurredAt()
            ));
            created++;
        }

        return created;
    }

    private Set<NotificationChannel> parseChannels(Object rawChannels) {
        if (rawChannels instanceof List<?> list && !list.isEmpty()) {
            EnumSet<NotificationChannel> channels = EnumSet.noneOf(NotificationChannel.class);
            for (Object item : list) {
                NotificationChannel channel = parseChannel(item);
                if (channel != null) {
                    channels.add(channel);
                }
            }
            if (!channels.isEmpty()) {
                return channels;
            }
        }

        NotificationChannel single = parseChannel(rawChannels);
        if (single != null) {
            return EnumSet.of(single);
        }

        return EnumSet.of(NotificationChannel.PUSH);
    }

    private NotificationChannel parseChannel(Object value) {
        if (value == null) {
            return null;
        }

        String normalized = String.valueOf(value).trim().toUpperCase();
        if (normalized.isEmpty()) {
            return null;
        }

        try {
            return NotificationChannel.valueOf(normalized);
        } catch (IllegalArgumentException ignored) {
            return null;
        }
    }

    private Set<NotificationChannel> safeChannels(Set<NotificationChannel> channels) {
        if (channels == null || channels.isEmpty()) {
            return EnumSet.of(NotificationChannel.PUSH);
        }
        return EnumSet.copyOf(channels);
    }

    private Map<String, Object> buildMetadata(UserNotificationCreateCommand command) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (command.metadata() != null) {
            metadata.putAll(command.metadata());
        }
        if (command.category() != null && !command.category().isBlank()) {
            metadata.putIfAbsent("category", command.category());
        }
        if (command.subcategory() != null && !command.subcategory().isBlank()) {
            metadata.putIfAbsent("subcategory", command.subcategory());
        }
        return metadata;
    }

    private String readMetadataValue(Map<String, Object> metadata, String key) {
        if (metadata == null) {
            return null;
        }

        Object value = metadata.get(key);
        if (value == null) {
            return null;
        }

        String text = String.valueOf(value).trim();
        return text.isEmpty() ? null : text;
    }

    private String toJson(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
