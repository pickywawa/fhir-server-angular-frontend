package com.healthapp.events.service.dispatch;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * Stub email sender.
 * Integrate with JavaMail / SendGrid / SES etc. when needed.
 */
@Service
public class EmailSender {

    private static final Logger logger = LoggerFactory.getLogger(EmailSender.class);

    public void send(String userId, String title, String body) {
        // TODO: implement with a mail provider (JavaMail, SendGrid, Amazon SES, etc.)
        logger.info("[EmailSender] [STUB] Would send email to userId={} title={}", userId, title);
    }
}
