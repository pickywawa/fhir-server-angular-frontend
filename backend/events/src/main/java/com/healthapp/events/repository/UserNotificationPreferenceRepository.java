package com.healthapp.events.repository;

import com.healthapp.events.model.UserNotificationPreference;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface UserNotificationPreferenceRepository extends JpaRepository<UserNotificationPreference, UUID> {

    List<UserNotificationPreference> findByUserIdOrderByCategoryKeyAscSubcategoryKeyAsc(String userId);

    Optional<UserNotificationPreference> findByUserIdAndPreferenceKey(String userId, String preferenceKey);
}
