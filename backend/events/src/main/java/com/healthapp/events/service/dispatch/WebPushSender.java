package com.healthapp.events.service.dispatch;

import com.healthapp.events.model.PushSubscription;
import com.healthapp.events.repository.PushSubscriptionRepository;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jose4j.lang.JoseException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.security.Security;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutionException;

/**
 * Sends Web Push notifications using VAPID keys.
 */
@Service
public class WebPushSender {

    private static final Logger logger = LoggerFactory.getLogger(WebPushSender.class);
    private static final String PLACEHOLDER = "CHANGE_ME_GENERATE_WITH_WEB_PUSH";

    private final PushSubscriptionRepository subscriptionRepository;
    private final ObjectMapper objectMapper;
    private final PushService pushService;

    public WebPushSender(
            PushSubscriptionRepository subscriptionRepository,
            ObjectMapper objectMapper,
            @Value("${app.vapid.public-key}") String vapidPublicKey,
            @Value("${app.vapid.private-key}") String vapidPrivateKey,
            @Value("${app.vapid.subject}") String vapidSubject) {

        Security.addProvider(new BouncyCastleProvider());
        this.subscriptionRepository = subscriptionRepository;
        this.objectMapper = objectMapper;

        if (isPlaceholder(vapidPublicKey) || isPlaceholder(vapidPrivateKey)) {
            logger.warn("[WebPushSender] VAPID keys are not configured. Web push is disabled until valid keys are provided.");
            this.pushService = null;
            return;
        }

        PushService service;
        try {
            service = new PushService(vapidPublicKey, vapidPrivateKey, vapidSubject);
        } catch (GeneralSecurityException | IllegalArgumentException e) {
            logger.warn("[WebPushSender] Invalid VAPID configuration. Web push is disabled: {}", e.getMessage());
            service = null;
        }
        this.pushService = service;
    }

    /**
     * Sends a push notification to all registered subscriptions for the given user.
     */
    public void send(
        String userId,
        String title,
        String body,
        String priority,
        UUID notificationId,
        String type,
        String category,
        String subcategory,
        Map<String, Object> metadata
    ) {
        try {
            if (pushService == null) {
                    logger.warn("[WebPushSender] ⚠ Push service not initialized (VAPID keys missing?), skipping send for userId={}", userId);
                return;
            }

            List<PushSubscription> subscriptions = subscriptionRepository.findByUserId(userId);
            if (subscriptions == null || subscriptions.isEmpty()) {
                    logger.warn("[WebPushSender] No push subscriptions found for userId={}", userId);
                return;
            }

            String payload = buildPayload(title, body, priority, notificationId, userId, type, category, subcategory, metadata);
                logger.info("[WebPushSender] ▶ Sending push to userId={} title='{}' priority={} notificationId={} subscriptions={}",
                    userId, title, priority, notificationId, subscriptions.size());
                logger.debug("[WebPushSender] Payload: {}", payload);

            for (PushSubscription sub : subscriptions) {
                sendToSubscription(sub, payload);
            }
                logger.info("[WebPushSender] ✅ All push dispatched for userId={}", userId);
        } catch (Exception e) {
            logger.error("[WebPushSender] Unexpected error in send(): {}", e.getMessage(), e);
        }
    }

    private void sendToSubscription(PushSubscription sub, String payload) {
            long start = System.currentTimeMillis();
        try {
                logger.debug("[WebPushSender] Sending to endpoint={} keyP256dh_len={} keyAuth_len={}",
                    abbreviate(sub.getEndpoint()),
                    sub.getKeyP256dh() != null ? sub.getKeyP256dh().length() : 0,
                    sub.getKeyAuth() != null ? sub.getKeyAuth().length() : 0);
            Notification notification = new Notification(
                sub.getEndpoint(),
                sub.getKeyP256dh(),
                sub.getKeyAuth(),
                payload
            );
            pushService.send(notification);
                long elapsed = System.currentTimeMillis() - start;
                logger.info("[WebPushSender] ✅ Push sent in {}ms to userId={} endpoint={}",
                    elapsed, sub.getUserId(), abbreviate(sub.getEndpoint()));
        } catch (GeneralSecurityException | IOException | JoseException | ExecutionException | InterruptedException e) {
                long elapsed = System.currentTimeMillis() - start;
                logger.error("[WebPushSender] ❌ Failed to send push after {}ms to endpoint={}: {} ({})",
                    elapsed, abbreviate(sub.getEndpoint()), e.getClass().getSimpleName(), e.getMessage());
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private String buildPayload(
        String title,
        String body,
        String priority,
        UUID notificationId,
        String userId,
        String type,
        String category,
        String subcategory,
        Map<String, Object> metadata
    ) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("title", title == null ? "HealthApp" : title);
        payload.put("body", body == null ? "" : body);
        payload.put("priority", priority == null ? "LOW" : priority);
        payload.put("notificationId", notificationId == null ? "" : notificationId.toString());
        payload.put("userId", userId == null ? "" : userId);
        payload.put("type", type == null ? "GENERIC" : type);
        payload.put("category", category == null ? "" : category);
        payload.put("subcategory", subcategory == null ? "" : subcategory);
        payload.put("metadata", metadata == null ? Map.of() : metadata);

        try {
            return objectMapper.writeValueAsString(payload);
        } catch (JsonProcessingException e) {
            logger.warn("[WebPushSender] Failed to serialize push payload, using fallback: {}", e.getMessage());
            return "{\"title\":\"HealthApp\",\"body\":\"\",\"priority\":\"LOW\"}";
        }
    }

    private String abbreviate(String endpoint) {
        if (endpoint == null || endpoint.length() <= 40) return endpoint;
        return endpoint.substring(0, 40) + "...";
    }

    private boolean isPlaceholder(String value) {
        return value == null || value.isBlank() || value.contains(PLACEHOLDER);
    }
}
