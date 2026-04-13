package com.healthapp.events.controller;

import com.healthapp.events.dto.NotificationView;
import com.healthapp.events.service.NotificationService;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@Validated
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationsController {

    private final NotificationService notificationService;

    public NotificationsController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @GetMapping("/{userId}")
    public List<NotificationView> getNotifications(
        @PathVariable @NotBlank String userId,
        @RequestParam(defaultValue = "false") boolean onlyUnread,
        @RequestParam(defaultValue = "50") @Min(1) @Max(200) int limit
    ) {
        return notificationService.listNotifications(userId, onlyUnread, limit);
    }

    @PostMapping("/{notificationId}/ack")
    public NotificationView acknowledge(
        @PathVariable UUID notificationId,
        @RequestParam @NotBlank String userId
    ) {
        return notificationService.acknowledge(notificationId, userId);
    }

    @PostMapping("/{userId}/ack-all")
    public Map<String, Object> acknowledgeAll(@PathVariable @NotBlank String userId) {
        int updated = notificationService.acknowledgeAll(userId);
        return Map.of("status", "ok", "updated", updated);
    }
}
