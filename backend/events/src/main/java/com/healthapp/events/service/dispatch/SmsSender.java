package com.healthapp.events.service.dispatch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Stub SMS sender.
 * Integrate with Twilio / AWS SNS / OVH SMS etc. when needed.
 */
@Service
public class SmsSender {

    private static final Logger logger = LoggerFactory.getLogger(SmsSender.class);

    public void send(String userId, String body) {
        // TODO: implement with an SMS provider (Twilio, AWS SNS, OVH, etc.)
        logger.info("[SmsSender] [STUB] Would send SMS to userId={} body={}", userId, body);
    }
}
