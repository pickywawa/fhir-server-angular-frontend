package com.healthapp.events.service;

import com.healthapp.events.dto.SavePushSubscriptionRequest;
import com.healthapp.events.model.PushSubscription;
import com.healthapp.events.repository.PushSubscriptionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class PushSubscriptionService {

    private static final Logger logger = LoggerFactory.getLogger(PushSubscriptionService.class);

    private final PushSubscriptionRepository repository;

    public PushSubscriptionService(PushSubscriptionRepository repository) {
        this.repository = repository;
    }

    @Transactional
    public void save(SavePushSubscriptionRequest request) {
        Optional<PushSubscription> existing = repository.findByEndpoint(request.endpoint());
            boolean isNew = existing.isEmpty();
        PushSubscription subscription = existing.orElseGet(PushSubscription::new);

        subscription.setUserId(request.userId());
        subscription.setEndpoint(request.endpoint());
        subscription.setKeyP256dh(request.keys().p256dh());
        subscription.setKeyAuth(request.keys().auth());

        repository.save(subscription);
            logger.info("[PushSubscription] {} subscription for userId={} endpoint={}",
                isNew ? "Created new" : "Updated existing",
                request.userId(),
                request.endpoint().length() > 60 ? request.endpoint().substring(0, 60) + "..." : request.endpoint());
    }

    @Transactional
    public void delete(String endpoint) {
        repository.deleteByEndpoint(endpoint);
            logger.info("[PushSubscription] Deleted subscription for endpoint={}",
                endpoint.length() > 60 ? endpoint.substring(0, 60) + "..." : endpoint);
    }

    @Transactional(readOnly = true)
    public List<PushSubscription> findByUserId(String userId) {
           List<PushSubscription> subs = repository.findByUserId(userId);
           logger.debug("[PushSubscription] findByUserId={} → {} subscription(s)", userId, subs.size());
           return subs;
    }
}
