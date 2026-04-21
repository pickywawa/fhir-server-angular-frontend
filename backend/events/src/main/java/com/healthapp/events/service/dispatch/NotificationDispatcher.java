package com.healthapp.events.service.dispatch;

import com.healthapp.events.model.NotificationChannel;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Central notification dispatcher.
 *
 * <p>Dispatches a notification to one or more channels (PUSH, EMAIL, SMS)
 * based on the provided {@link DispatchRequest}. Channels can be combined freely.
 *
 * <p>Usage example:
 * <pre>
 *   dispatcher.dispatch(DispatchRequest.push(userId, "Titre", "Message", NotificationPriority.HIGH));
 *   dispatcher.dispatch(DispatchRequest.allChannels(userId, "Urgent", "Alerte critique", NotificationPriority.CRITICAL));
 * </pre>
 */
@Service
public class NotificationDispatcher {

    private static final Logger logger = LoggerFactory.getLogger(NotificationDispatcher.class);

    private final WebPushSender webPushSender;
    private final EmailSender emailSender;
    private final SmsSender smsSender;

    public NotificationDispatcher(WebPushSender webPushSender, EmailSender emailSender, SmsSender smsSender) {
        this.webPushSender = webPushSender;
        this.emailSender = emailSender;
        this.smsSender = smsSender;
    }

    /**
     * Dispatch a notification via the channels specified in the request.
     * Each enabled channel is attempted independently; a failure in one does not block others.
     */
    public void dispatch(DispatchRequest request) {
        if (request.channels() == null || request.channels().isEmpty()) {
            logger.debug("[NotificationDispatcher] No channels specified for userId={}, skipping dispatch",
                request.userId());
            return;
        }

        String priorityLabel = request.priority() != null ? request.priority().name() : "LOW";
        logger.info("[NotificationDispatcher] Dispatching to userId={} channels={} priority={}",
            request.userId(), request.channels(), priorityLabel);

        for (NotificationChannel channel : request.channels()) {
            try {
                    long t0 = System.currentTimeMillis();
                    logger.debug("[NotificationDispatcher] → Channel {} for userId={}", channel, request.userId());
                switch (channel) {
                        case PUSH -> webPushSender.send(
                            request.userId(),
                            request.title(),
                            request.message(),
                            priorityLabel,
                            request.notificationId(),
                            request.type(),
                            request.category(),
                            request.subcategory(),
                            request.metadata()
                        );
                    case EMAIL -> emailSender.send(request.userId(), request.title(), request.message());
                    case SMS -> smsSender.send(request.userId(), request.message());
                }
                    logger.info("[NotificationDispatcher] ✅ Channel {} done in {}ms for userId={}",
                        channel, System.currentTimeMillis() - t0, request.userId());
            } catch (Exception e) {
                logger.error("[NotificationDispatcher] Channel {} failed for userId={}: {}",
                    channel, request.userId(), e.getMessage());
            }
        }
    }
}
