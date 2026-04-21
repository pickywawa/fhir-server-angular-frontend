package com.healthapp.events.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

/**
 * Browser PushSubscription object sent from the frontend after calling
 * PushManager.subscribe().
 */
public record SavePushSubscriptionRequest(
    @NotBlank String userId,
    @NotBlank String endpoint,
    @NotNull PushKeysDto keys
) {
    public record PushKeysDto(
        @NotBlank String p256dh,
        @NotBlank String auth
    ) {}
}
