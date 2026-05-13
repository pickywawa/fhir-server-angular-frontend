package com.healthapp.events.controller;

import com.healthapp.events.dto.NotificationView;
import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;
import com.healthapp.events.service.NotificationService;
import com.healthapp.events.service.UserNotificationCreateCommand;
import com.healthapp.events.service.UserNotificationCreationService;
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
import java.util.EnumSet;
import java.util.LinkedHashMap;

@Validated
@RestController
@RequestMapping("/api/v1/notifications")
public class NotificationsController {

    private final NotificationService notificationService;
    private final UserNotificationCreationService notificationCreationService;

    public NotificationsController(
        NotificationService notificationService,
        UserNotificationCreationService notificationCreationService
    ) {
        this.notificationService = notificationService;
        this.notificationCreationService = notificationCreationService;
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

    @PostMapping("/{notificationId}/respond")
    public NotificationView respond(
        @PathVariable UUID notificationId,
        @RequestParam @NotBlank String userId,
        @RequestParam @NotBlank String decision
    ) {
        return notificationService.respond(notificationId, userId, decision);
    }

    @PostMapping("/{userId}/ack-all")
    public Map<String, Object> acknowledgeAll(@PathVariable @NotBlank String userId) {
        int updated = notificationService.acknowledgeAll(userId);
        return Map.of("status", "ok", "updated", updated);
    }

    @PostMapping("/{userId}/test-push")
    public Map<String, Object> sendPushTest(@PathVariable @NotBlank String userId) {
        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "TEST_PUSH",
            "Test notification push",
            "Ceci est une notification push de test.",
            null,
            "system",
            "push-test",
            NotificationPriority.MEDIUM,
            EnumSet.of(NotificationChannel.PUSH),
            Map.of("source", "settings-test"),
            null
        ));

        return Map.of("status", "ok");
    }

    @PostMapping("/{userId}/test-push-scenarios")
    public Map<String, Object> sendPushScenarioTests(@PathVariable @NotBlank String userId) {
        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "CARE_TEAM_MEMBER_ADDED",
            "Intervenant ajoute",
            "Dr Martin a rejoint le suivi du patient P1002.",
            null,
            "intervenants",
            "member-added",
            NotificationPriority.HIGH,
            EnumSet.of(NotificationChannel.PUSH),
            Map.of(
                "patientId", "P1002",
                "practitionerId", "PR-220",
                "practitionerName", "Dr Martin",
                "category", "intervenants",
                "subcategory", "member-added"
            ),
            null
        ));

        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "QUESTIONNAIRE_UPDATED",
            "Questionnaire modifie",
            "Le questionnaire post-op a ete mis a jour.",
            null,
            "questionnaires",
            "questionnaire-added",
            NotificationPriority.MEDIUM,
            EnumSet.of(NotificationChannel.PUSH),
            Map.of(
                "questionnaireId", "Q-POST-01",
                "questionnaireTitle", "Questionnaire post-op",
                "patientId", "P1002",
                "category", "questionnaires",
                "subcategory", "questionnaire-added"
            ),
            null
        ));

        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "APPOINTMENT_UPDATED",
            "Rendez-vous modifie",
            "Le rendez-vous du 22/04 a ete deplace a 16h30.",
            null,
            "agenda",
            "appointment-updated",
            NotificationPriority.MEDIUM,
            EnumSet.of(NotificationChannel.PUSH),
            Map.of(
                "appointmentId", "APT-445",
                "startsAt", "2026-04-22T16:30:00Z",
                "patientId", "P1002",
                "category", "agenda",
                "subcategory", "appointment-updated"
            ),
            null
        ));

        Map<String, Object> visioMetadata = new LinkedHashMap<>();
        visioMetadata.put("conferenceId", "VISIO-991");
        visioMetadata.put("meetingUrl", "https://localhost:8443/healthapp-visio-test");
        visioMetadata.put("startsAt", "2026-04-22T17:00:00Z");
        visioMetadata.put("hostName", "Dr Leroy");
        visioMetadata.put("requiresResponse", true);
        visioMetadata.put("category", "visio-conferences");
        visioMetadata.put("subcategory", "invitation");

        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "VISIO_INVITATION",
            "Invitation visioconference",
            "Vous etes invite a une visioconference de coordination.",
            null,
            "visio-conferences",
            "invitation",
            NotificationPriority.HIGH,
            EnumSet.of(NotificationChannel.PUSH),
            visioMetadata,
            null
        ));

        notificationCreationService.createAndDispatch(new UserNotificationCreateCommand(
            userId,
            null,
            "CHAT_MESSAGE_RECEIVED",
            "Nouveau message de discussion",
            "Vous avez recu un nouveau message dans la discussion du patient P1002.",
            null,
            "chat",
            "new-message",
            NotificationPriority.MEDIUM,
            EnumSet.of(NotificationChannel.PUSH),
            Map.of(
                "discussionId", "DISC-1002-01",
                "patientId", "P1002",
                "sender", "Infirmiere Julie",
                "category", "chat",
                "subcategory", "new-message"
            ),
            null
        ));

        return Map.of("status", "ok", "sent", 5);
    }

    @GetMapping("/metadata-schemas")
    public Map<String, Object> metadataSchemas() {
        return Map.of(
            "intervenants.member-added", List.of("patientId", "practitionerId", "practitionerName"),
            "questionnaires.questionnaire-added", List.of("questionnaireId", "questionnaireTitle", "patientId"),
            "agenda.appointment-updated", List.of("appointmentId", "startsAt", "patientId"),
            "visio-conferences.invitation", List.of("conferenceId", "meetingUrl", "startsAt", "hostName", "requiresResponse"),
            "chat.new-message", List.of("discussionId", "patientId", "sender")
        );
    }
}
