package com.healthapp.events.service;

import com.healthapp.events.dto.NotificationCategoryPreferenceDto;
import com.healthapp.events.dto.NotificationChannelsDto;
import com.healthapp.events.dto.NotificationPreferenceUpdateDto;
import com.healthapp.events.dto.NotificationPreferenceValueDto;
import com.healthapp.events.dto.NotificationPreferencesResponseDto;
import com.healthapp.events.dto.NotificationSubcategoryPreferenceDto;
import com.healthapp.events.dto.UpdateNotificationPreferencesRequest;
import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.UserNotificationPreference;
import com.healthapp.events.repository.UserNotificationPreferenceRepository;
import com.healthapp.events.service.preferences.NotificationCategoryDefinition;
import com.healthapp.events.service.preferences.NotificationPreferenceCatalog;
import com.healthapp.events.service.preferences.NotificationPreferenceDefaults;
import com.healthapp.events.service.preferences.NotificationSubcategoryDefinition;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class NotificationPreferenceService {

    private final NotificationPreferenceCatalog catalog;
    private final UserNotificationPreferenceRepository repository;

    public NotificationPreferenceService(NotificationPreferenceCatalog catalog,
                                         UserNotificationPreferenceRepository repository) {
        this.catalog = catalog;
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public NotificationPreferencesResponseDto getPreferences(String userId) {
        Map<String, UserNotificationPreference> overrides = repository
            .findByUserIdOrderByCategoryKeyAscSubcategoryKeyAsc(userId)
            .stream()
            .collect(Collectors.toMap(UserNotificationPreference::getPreferenceKey, value -> value, (left, right) -> right, HashMap::new));

        List<NotificationCategoryPreferenceDto> categories = catalog.getCategories().stream()
            .map(category -> toCategoryDto(category, overrides))
            .toList();

        return new NotificationPreferencesResponseDto(userId, categories);
    }

    @Transactional
    public NotificationPreferencesResponseDto updatePreferences(String userId, UpdateNotificationPreferencesRequest request) {
        for (NotificationPreferenceUpdateDto update : request.preferences()) {
            validateUpdate(update);
            UserNotificationPreference preference = repository
                .findByUserIdAndPreferenceKey(userId, preferenceKey(update.categoryKey(), update.subcategoryKey()))
                .orElseGet(UserNotificationPreference::new);

            preference.setUserId(userId);
            preference.setPreferenceKey(preferenceKey(update.categoryKey(), update.subcategoryKey()));
            preference.setCategoryKey(update.categoryKey());
            preference.setSubcategoryKey(normalize(update.subcategoryKey()));
            preference.setEnabled(update.preference().enabled());
            preference.setPriority(update.preference().priority());
            preference.setPushEnabled(update.preference().channels().push());
            preference.setEmailEnabled(update.preference().channels().email());
            preference.setSmsEnabled(update.preference().channels().sms());
            repository.save(preference);
        }

        return getPreferences(userId);
    }

    private void validateUpdate(NotificationPreferenceUpdateDto update) {
        NotificationCategoryDefinition category = catalog.findCategory(update.categoryKey())
            .orElseThrow(() -> new IllegalArgumentException("Categorie inconnue: " + update.categoryKey()));

        String subcategoryKey = normalize(update.subcategoryKey());
        if (subcategoryKey == null) {
            return;
        }

        boolean exists = category.subcategories().stream().anyMatch(item -> item.key().equals(subcategoryKey));
        if (!exists) {
            throw new IllegalArgumentException("Sous-categorie inconnue: " + update.categoryKey() + "/" + subcategoryKey);
        }
    }

    private NotificationCategoryPreferenceDto toCategoryDto(NotificationCategoryDefinition category,
                                                            Map<String, UserNotificationPreference> overrides) {
        UserNotificationPreference categoryOverride = overrides.get(preferenceKey(category.key(), null));
        NotificationPreferenceValueDto defaultPreference = toPreferenceValue(category.defaults());
        NotificationPreferenceValueDto effectivePreference = categoryOverride == null
            ? defaultPreference
            : toPreferenceValue(categoryOverride);

        List<NotificationSubcategoryPreferenceDto> subcategories = category.subcategories().stream()
            .map(subcategory -> toSubcategoryDto(category.key(), subcategory, overrides))
            .toList();

        return new NotificationCategoryPreferenceDto(
            category.key(),
            category.title(),
            category.description(),
            defaultPreference,
            effectivePreference,
            categoryOverride != null,
            subcategories
        );
    }

    private NotificationSubcategoryPreferenceDto toSubcategoryDto(String categoryKey,
                                                                  NotificationSubcategoryDefinition subcategory,
                                                                  Map<String, UserNotificationPreference> overrides) {
        UserNotificationPreference override = overrides.get(preferenceKey(categoryKey, subcategory.key()));
        NotificationPreferenceValueDto defaultPreference = toPreferenceValue(subcategory.defaults());
        NotificationPreferenceValueDto effectivePreference = override == null
            ? defaultPreference
            : toPreferenceValue(override);

        return new NotificationSubcategoryPreferenceDto(
            subcategory.key(),
            subcategory.title(),
            subcategory.description(),
            defaultPreference,
            effectivePreference,
            override != null
        );
    }

    private NotificationPreferenceValueDto toPreferenceValue(NotificationPreferenceDefaults defaults) {
        Set<NotificationChannel> channels = defaults.channels();
        return new NotificationPreferenceValueDto(
            defaults.enabled(),
            defaults.priority(),
            new NotificationChannelsDto(
                channels.contains(NotificationChannel.PUSH),
                channels.contains(NotificationChannel.EMAIL),
                channels.contains(NotificationChannel.SMS)
            )
        );
    }

    private NotificationPreferenceValueDto toPreferenceValue(UserNotificationPreference preference) {
        return new NotificationPreferenceValueDto(
            preference.isEnabled(),
            preference.getPriority(),
            new NotificationChannelsDto(
                preference.isPushEnabled(),
                preference.isEmailEnabled(),
                preference.isSmsEnabled()
            )
        );
    }

    private String preferenceKey(String categoryKey, String subcategoryKey) {
        String normalizedSubcategory = normalize(subcategoryKey);
        return normalizedSubcategory == null ? categoryKey : categoryKey + "/" + normalizedSubcategory;
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
