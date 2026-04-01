<#import "template.ftl" as layout>
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=false; section>
  <#if section = "header">
  <#elseif section = "form">
    <style>
      html, body, .login-pf, body.login-pf {
        background:
          radial-gradient(circle at 12% 8%, rgba(101, 220, 224, 0.60) 0%, rgba(101, 220, 224, 0.60) 24%, transparent 25%),
          radial-gradient(circle at 88% 84%, rgba(36, 182, 187, 0.50) 0%, rgba(36, 182, 187, 0.50) 22%, transparent 23%),
          linear-gradient(155deg, #7ad8dc 0%, #4ec4c8 48%, #22acb1 100%) !important;
        min-height: 100vh !important;
      }
      .login-pf-page,
      [class*="pf-v5-c-login"],
      [class*="pf-c-login"] {
        background: transparent !important;
      }
    </style>
    <div class="healthapp-login-layout">
      <section class="healthapp-login-visual" aria-hidden="true">
        <div class="healthapp-login-visual-card">
          <div class="healthapp-login-quote">&#8220;</div>
          <h2>Mettre l'humain au coeur de chaque soin</h2>
          <p>Une plateforme de sante pensee pour simplifier le quotidien des equipes et rassurer les patients.</p>
        </div>
      </section>

      <section class="healthapp-login-panel">
        <div class="healthapp-login-intro">
          <h1>Bienvenue</h1>
          <p>Connectez-vous avec votre identifiant et votre mot de passe.</p>
        </div>

        <#if message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
          <div class="alert alert-${message.type}">
            <span class="kc-feedback-text">${kcSanitize(message.summary)?no_esc}</span>
          </div>
        </#if>

        <form id="kc-form-login" action="${url.loginAction}" method="post">
          <div class="healthapp-form-group">
            <label class="healthapp-label" for="username">Identifiant ou adresse e-mail</label>
            <div class="healthapp-input-wrapper has-icon-email">
              <input
                tabindex="1"
                id="username"
                class="pf-c-form-control form-control"
                name="username"
                value="${(login.username!'')}"
                type="text"
                autofocus
                autocomplete="username"
                aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                placeholder="nom.prenom ou email"
              />
            </div>
          </div>

          <div class="healthapp-form-group">
            <label class="healthapp-label" for="password">Mot de passe</label>
            <div class="healthapp-input-wrapper has-icon-password">
              <input
                tabindex="2"
                id="password"
                class="pf-c-form-control form-control"
                name="password"
                type="password"
                autocomplete="current-password"
                aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                placeholder="Votre mot de passe"
              />
            </div>
          </div>

          <div class="healthapp-login-actions-row">
            <#if realm.rememberMe && !usernameEditDisabled??>
              <label class="healthapp-remember-me">
                <input tabindex="3" id="rememberMe" name="rememberMe" type="checkbox" <#if login.rememberMe??>checked</#if>>
                <span>Rester connecte</span>
              </label>
            <#else>
              <span></span>
            </#if>

            <#if realm.resetPasswordAllowed>
              <a tabindex="5" href="${url.loginResetCredentialsUrl}" class="healthapp-forgot-password">Mot de passe oublie ?</a>
            </#if>
          </div>

          <input type="hidden" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>>

          <div class="healthapp-submit-row">
            <input tabindex="4" class="btn btn-primary btn-block btn-lg" name="login" id="kc-login" type="submit" value="Connexion">
          </div>
        </form>
      </section>
    </div>
  <#elseif section = "info">
  </#if>
</@layout.registrationLayout>