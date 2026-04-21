package com.healthapp.events.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.healthapp.events.dto.NotificationView;
import com.healthapp.events.model.EventPayload;
import com.healthapp.events.model.Notification;
import com.healthapp.events.model.NotificationPriority;
import com.healthapp.events.repository.NotificationRepository;
import jakarta.persistence.EntityNotFoundException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationRepository notificationRepository;
    private final ObjectMapper objectMapper;

    public NotificationService(NotificationRepository notificationRepository, ObjectMapper objectMapper) {
        this.notificationRepository = notificationRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public int createNotifications(EventPayload payload) {
        if (payload.recipientUserIds() == null || payload.recipientUserIds().isEmpty()) {
            return 0;
        }

        int created = 0;
        String metadataJson = toJson(payload);
        String safeEventId = payload.eventId() == null || payload.eventId().isBlank()
            ? UUID.randomUUID().toString()
            : payload.eventId();

        for (String userId : payload.recipientUserIds()) {
            if (userId == null || userId.isBlank()) {
                continue;
            }
            Notification notification = new Notification();
            notification.setUserId(userId);
            notification.setEventId(safeEventId);
            notification.setType(payload.type() == null ? "GENERIC" : payload.type());
            notification.setTitle(payload.title() == null ? "Nouvelle notification" : payload.title());
            notification.setMessage(payload.message() == null ? "" : payload.message());
            notification.setActorUserId(payload.actorUserId());
            notification.setMetadataJson(metadataJson);
            notification.setAcknowledged(false);
            notification.setCreatedAt(payload.occurredAt() == null ? Instant.now() : payload.occurredAt());
            notification.setPriority(payload.priority() == null ? NotificationPriority.LOW : payload.priority());

            notificationRepository.save(notification);
            created++;
        }

        return created;
    }

    @Transactional(readOnly = true)
    public List<NotificationView> listNotifications(String userId, boolean onlyUnread, int limit) {
        List<Notification> source = onlyUnread
            ? notificationRepository.findTop200ByUserIdAndAcknowledgedOrderByCreatedAtDesc(userId, false)
            : notificationRepository.findTop200ByUserIdOrderByCreatedAtDesc(userId);

        return source.stream()
            .sorted(Comparator.comparing(Notification::getCreatedAt).reversed())
            .limit(Math.max(1, Math.min(limit, 200)))
            .map(this::toView)
            .toList();
    }

    @Transactional
    public NotificationView acknowledge(UUID notificationId, String userId) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new EntityNotFoundException("Notification introuvable"));

        if (!notification.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Notification non accessible pour cet utilisateur");
        }

        if (!notification.isAcknowledged()) {
            notification.setAcknowledged(true);
            notification.setAcknowledgedAt(Instant.now());
        }

        return toView(notificationRepository.save(notification));
    }

    @Transactional
    public int acknowledgeAll(String userId) {
        List<Notification> notifications = notificationRepository
            .findTop200ByUserIdAndAcknowledgedOrderByCreatedAtDesc(userId, false);

        int updated = 0;
        for (Notification notification : notifications) {
            notification.setAcknowledged(true);
            notification.setAcknowledgedAt(Instant.now());
            notificationRepository.save(notification);
            updated++;
        }
        return updated;
    }

    @Transactional
    public NotificationView respond(UUID notificationId, String userId, String decision) {
        Notification notification = notificationRepository.findById(notificationId)
            .orElseThrow(() -> new EntityNotFoundException("Notification introuvable"));

        if (!notification.getUserId().equals(userId)) {
            throw new IllegalArgumentException("Notification non accessible pour cet utilisateur");
        }

        Map<String, Object> metadata = parseMetadata(notification.getMetadataJson());
        metadata.put("responseDecision", decision == null ? "" : decision.trim().toUpperCase());
        metadata.put("responseAt", Instant.now().toString());
        notification.setMetadataJson(toJsonMap(metadata));
        notification.setAcknowledged(true);
        notification.setAcknowledgedAt(Instant.now());

        return toView(notificationRepository.save(notification));
    }

    private NotificationView toView(Notification notification) {
        return new NotificationView(
            notification.getId(),
            notification.getUserId(),
            notification.getEventId(),
            notification.getType(),
            notification.getTitle(),
            notification.getMessage(),
            notification.getActorUserId(),
            notification.getMetadataJson(),
            notification.isAcknowledged(),
            notification.getCreatedAt(),
            notification.getAcknowledgedAt(),
            notification.getPriority()
        );
    }

    private String toJson(EventPayload payload) {
        try {
            return objectMapper.writeValueAsString(payload.metadata());
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private Map<String, Object> parseMetadata(String metadataJson) {
        if (metadataJson == null || metadataJson.isBlank()) {
            return new LinkedHashMap<>();
        }

        try {
            Map<String, Object> metadata = objectMapper.readValue(metadataJson, Map.class);
            return metadata == null ? new LinkedHashMap<>() : new LinkedHashMap<>(metadata);
        } catch (JsonProcessingException e) {
            return new LinkedHashMap<>();
        }
    }

    private String toJsonMap(Map<String, Object> metadata) {
        try {
            return objectMapper.writeValueAsString(metadata == null ? Map.of() : metadata);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }
}
