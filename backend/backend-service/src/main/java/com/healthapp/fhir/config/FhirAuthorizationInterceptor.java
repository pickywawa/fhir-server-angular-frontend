package com.healthapp.fhir.config;

import ca.uhn.fhir.rest.api.server.RequestDetails;
import ca.uhn.fhir.rest.server.exceptions.AuthenticationException;
import ca.uhn.fhir.rest.server.exceptions.ForbiddenOperationException;
import ca.uhn.fhir.rest.server.interceptor.auth.AuthorizationInterceptor;
import ca.uhn.fhir.rest.server.interceptor.auth.IAuthRule;
import ca.uhn.fhir.rest.server.interceptor.auth.RuleBuilder;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * HAPI FHIR AuthorizationInterceptor that validates the JWT passed via Spring Security.
 * <p>
 * Rules:
 * - Unauthenticated requests → 401 Unauthorized
 * - Authenticated users with role "admin" → full access
 * - Authenticated users with role "user" → read-only access to Patient resources
 * - Otherwise → 403 Forbidden
 */
@Component
public class FhirAuthorizationInterceptor extends AuthorizationInterceptor {

    @Override
    public List<IAuthRule> buildRuleList(RequestDetails theRequestDetails) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();

        if (authentication == null || !authentication.isAuthenticated()
                || "anonymousUser".equals(authentication.getPrincipal())) {
            throw new AuthenticationException("Unauthorized: valid Bearer token required");
        }

        // Extract preferred_username from JWT for logging/audit
        String username = extractUsername(authentication);

        // Check roles
        boolean isAdmin = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_admin"));
        boolean isUser = authentication.getAuthorities().stream()
                .anyMatch(a -> a.getAuthority().equals("ROLE_user"));

        if (isAdmin) {
            // Admins: full CRUD on all resources
            return new RuleBuilder()
                    .allowAll("Admin '" + username + "' has full access")
                    .build();
        }

        if (isUser) {
            // Standard users: read-only on Patient resources
            return new RuleBuilder()
                    .allow().read().resourcesOfType("Patient").withAnyId().andThen()
                    .allow().read().allResources().withAnyId().andThen()
                    .allow().create().resourcesOfType("Patient").withAnyId().andThen()
                    .allow().write().resourcesOfType("Patient").withAnyId().andThen()
                    .allow().delete().resourcesOfType("Patient").withAnyId().andThen()
                    .denyAll("User '" + username + "' has patient-scoped access only")
                    .build();
        }

        throw new ForbiddenOperationException("Forbidden: insufficient roles for user '" + username + "'");
    }

    private String extractUsername(Authentication authentication) {
        if (authentication.getPrincipal() instanceof Jwt jwt) {
            String preferred = jwt.getClaimAsString("preferred_username");
            return preferred != null ? preferred : jwt.getSubject();
        }
        return authentication.getName();
    }
}
