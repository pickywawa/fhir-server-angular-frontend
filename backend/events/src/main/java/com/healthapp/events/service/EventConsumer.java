package com.healthapp.events.service;

import com.healthapp.events.model.EventPayload;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Service;

@Service
public class EventConsumer {

    private static final Logger logger = LoggerFactory.getLogger(EventConsumer.class);

    private final UserNotificationCreationService notificationCreationService;

    public EventConsumer(UserNotificationCreationService notificationCreationService) {
        this.notificationCreationService = notificationCreationService;
    }

    @KafkaListener(topics = "${app.events.topic}", groupId = "${spring.kafka.consumer.group-id}")
    public void onEvent(EventPayload payload) {
        int created = notificationCreationService.createAndDispatchFromEvent(payload);
        logger.info("Event consumed type={} eventId={} recipients={} notificationsCreated={}",
            payload.type(), payload.eventId(),
            payload.recipientUserIds() == null ? 0 : payload.recipientUserIds().size(),
            created);
    }
}
