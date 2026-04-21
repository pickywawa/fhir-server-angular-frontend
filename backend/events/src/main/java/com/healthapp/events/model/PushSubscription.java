package com.healthapp.events.model;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

import java.time.Instant;
import java.util.UUID;

/**
 * Stores a browser Web Push subscription for a user.
 * Each (userId, endpoint) pair is unique: one subscription per device/browser.
 */
@Entity
@Table(
    name = "push_subscriptions",
    indexes = { @Index(name = "idx_push_subscriptions_user", columnList = "user_id") },
    uniqueConstraints = { @UniqueConstraint(name = "uq_push_subscription_endpoint", columnNames = "endpoint") }
)
public class PushSubscription {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private String userId;

    @Column(nullable = false, length = 2048)
    private String endpoint;

    @Column(name = "key_p256dh", nullable = false, length = 512)
    private String keyP256dh;

    @Column(name = "key_auth", nullable = false, length = 256)
    private String keyAuth;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @PrePersist
    public void init() {
        if (createdAt == null) {
            createdAt = Instant.now();
        }
    }

    public UUID getId() { return id; }
    public void setId(UUID id) { this.id = id; }

    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }

    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }

    public String getKeyP256dh() { return keyP256dh; }
    public void setKeyP256dh(String keyP256dh) { this.keyP256dh = keyP256dh; }

    public String getKeyAuth() { return keyAuth; }
    public void setKeyAuth(String keyAuth) { this.keyAuth = keyAuth; }

    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
