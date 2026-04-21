package com.healthapp.events.service.preferences;

import com.healthapp.events.model.NotificationChannel;
import com.healthapp.events.model.NotificationPriority;

import java.util.EnumSet;
import java.util.Set;

public record NotificationPreferenceDefaults(
    boolean enabled,
    NotificationPriority priority,
    Set<NotificationChannel> channels
) {
    public static NotificationPreferenceDefaults of(boolean enabled,
                                                    NotificationPriority priority,
                                                    NotificationChannel... channels) {
        EnumSet<NotificationChannel> values = channels.length == 0
            ? EnumSet.noneOf(NotificationChannel.class)
            : EnumSet.of(channels[0], channels);
        return new NotificationPreferenceDefaults(enabled, priority, values);
    }
}
