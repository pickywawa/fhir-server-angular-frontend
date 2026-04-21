package com.healthapp.events.service.preferences;

import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Optional;

@Component
public class NotificationPreferenceCatalog {

    private final List<NotificationCategoryDefinition> categories = List.of(
        new NotificationCategoryDefinition(
            "chat",
            "Chat",
            "Messages, mentions et activites de conversations de l'equipe.",
            NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL),
            List.of(
                new NotificationSubcategoryDefinition(
                    "new-message",
                    "Nouveau message",
                    "Un nouveau message est recu dans une conversation suivie.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH)
                ),
                new NotificationSubcategoryDefinition(
                    "mention",
                    "Mention directe",
                    "Vous etes mentionne dans une conversation.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.CRITICAL, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "conversation-assigned",
                    "Conversation assignee",
                    "Une conversation vous est assignee pour suivi.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                )
            )
        ),
        new NotificationCategoryDefinition(
            "questionnaires",
            "Questionnaires",
            "Assignation, rappels et retours sur les questionnaires patients.",
            NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL),
            List.of(
                new NotificationSubcategoryDefinition(
                    "questionnaire-added",
                    "Questionnaire ajoute",
                    "Un nouveau questionnaire a ete assigne a un patient ou a votre equipe.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "questionnaire-reminder",
                    "Rappel questionnaire",
                    "Un questionnaire arrive a echeance et necessite une action.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.EMAIL, NotificationChannel.PUSH)
                ),
                new NotificationSubcategoryDefinition(
                    "questionnaire-completed",
                    "Questionnaire complete",
                    "Un questionnaire vient d'etre complete et doit etre consulte.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH)
                )
            )
        ),
        new NotificationCategoryDefinition(
            "intervenants",
            "Intervenants",
            "Evolutions du care team, membres ajoutes, retires ou modifies.",
            NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL),
            List.of(
                new NotificationSubcategoryDefinition(
                    "member-added",
                    "Ajout d'un membre",
                    "Un intervenant est ajoute au suivi d'un patient ou a une equipe.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "member-removed",
                    "Suppression d'un membre",
                    "Un intervenant est retire du suivi ou d'une equipe.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.SMS)
                ),
                new NotificationSubcategoryDefinition(
                    "role-updated",
                    "Role modifie",
                    "Le role ou la responsabilite d'un intervenant a change.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH)
                )
            )
        ),
        new NotificationCategoryDefinition(
            "agenda",
            "Agenda",
            "Creation, modification et annulation des rendez-vous et temps forts du planning.",
            NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH),
            List.of(
                new NotificationSubcategoryDefinition(
                    "appointment-created",
                    "Rendez-vous ajoute",
                    "Un nouveau rendez-vous a ete cree dans votre agenda.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "appointment-updated",
                    "Rendez-vous modifie",
                    "Les informations d'un rendez-vous existant ont change.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH)
                ),
                new NotificationSubcategoryDefinition(
                    "appointment-cancelled",
                    "Rendez-vous annule",
                    "Un rendez-vous a ete annule et peut necessiter une reorganisation.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL, NotificationChannel.SMS)
                )
            )
        ),
        new NotificationCategoryDefinition(
            "visio-conferences",
            "Visio conferences",
            "Invitations, mises a jour et annulations des conferences video.",
            NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL),
            List.of(
                new NotificationSubcategoryDefinition(
                    "invitation",
                    "Invitation visio",
                    "Vous etes invite a rejoindre une conference video.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "updated",
                    "Visio modifiee",
                    "La conference video a ete modifiee (horaire, participants, lien).",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.MEDIUM, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                ),
                new NotificationSubcategoryDefinition(
                    "cancelled",
                    "Visio annulee",
                    "La conference video a ete annulee.",
                    NotificationPreferenceDefaults.of(true, NotificationPriority.HIGH, NotificationChannel.PUSH, NotificationChannel.EMAIL)
                )
            )
        )
    );

    public List<NotificationCategoryDefinition> getCategories() {
        return categories;
    }

    public Optional<NotificationCategoryDefinition> findCategory(String categoryKey) {
        return categories.stream().filter(category -> category.key().equals(categoryKey)).findFirst();
    }

    public Optional<NotificationSubcategoryDefinition> findSubcategory(String categoryKey, String subcategoryKey) {
        return findCategory(categoryKey)
            .stream()
            .flatMap(category -> category.subcategories().stream())
            .filter(subcategory -> subcategory.key().equals(subcategoryKey))
            .findFirst();
    }
}
