package com.healthapp.events.controller;

import com.healthapp.events.dto.SavePushSubscriptionRequest;
import com.healthapp.events.service.PushSubscriptionService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/push-subscriptions")
public class PushSubscriptionController {

    private final PushSubscriptionService pushSubscriptionService;
    private static final Logger logger = LoggerFactory.getLogger(PushSubscriptionController.class);

    public PushSubscriptionController(PushSubscriptionService pushSubscriptionService) {
        this.pushSubscriptionService = pushSubscriptionService;
    }

    /**
     * Register or update a browser push subscription for a user.
     */
    @PostMapping
    public ResponseEntity<Void> subscribe(@Valid @RequestBody SavePushSubscriptionRequest request) {
            logger.info("[PushController] POST /push-subscriptions userId={} endpoint={}", request.userId(), abbreviate(request.endpoint()));
        pushSubscriptionService.save(request);
            logger.info("[PushController] ✅ Subscription saved for userId={}", request.userId());
        return ResponseEntity.ok().build();
    }

    /**
     * Unregister a push subscription (user opted out or browser revoked permission).
     */
    @DeleteMapping
    public ResponseEntity<Void> unsubscribe(@RequestParam @NotBlank String endpoint) {
            logger.info("[PushController] DELETE /push-subscriptions endpoint={}", abbreviate(endpoint));
        pushSubscriptionService.delete(endpoint);
            logger.info("[PushController] ✅ Subscription deleted for endpoint={}", abbreviate(endpoint));
        return ResponseEntity.noContent().build();
    }

        private String abbreviate(String s) {
            return s != null && s.length() > 60 ? s.substring(0, 60) + "..." : s;
        }
}
