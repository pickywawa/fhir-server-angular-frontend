package com.healthapp.events.controller;

import com.healthapp.events.dto.NotificationPreferencesResponseDto;
import com.healthapp.events.dto.UpdateNotificationPreferencesRequest;
import com.healthapp.events.service.NotificationPreferenceService;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@Validated
@RestController
@RequestMapping("/api/v1/notification-preferences")
public class NotificationPreferencesController {

    private final NotificationPreferenceService notificationPreferenceService;

    public NotificationPreferencesController(NotificationPreferenceService notificationPreferenceService) {
        this.notificationPreferenceService = notificationPreferenceService;
    }

    @GetMapping("/{userId}")
    public NotificationPreferencesResponseDto getPreferences(@PathVariable @NotBlank String userId) {
        return notificationPreferenceService.getPreferences(userId);
    }

    @PutMapping("/{userId}")
    public NotificationPreferencesResponseDto updatePreferences(
        @PathVariable @NotBlank String userId,
        @Valid @RequestBody UpdateNotificationPreferencesRequest request
    ) {
        return notificationPreferenceService.updatePreferences(userId, request);
    }
}
