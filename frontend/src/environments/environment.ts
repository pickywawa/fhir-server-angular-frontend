export const environment = {
  production: false,
  apiUrl: 'http://localhost:8081/fhir',
  eventsApiUrl: 'http://localhost:8091',
  chatBotUrl: 'http://localhost:8090',
  keycloakUrl: 'http://localhost:8180',
  keycloakRealm: 'fhir',
  keycloakClientId: 'fhir-angular',
  jitsiDomain: 'localhost:8443',
  jitsiScriptUrl: 'https://localhost:8443/external_api.js',
  // Generate with: npx web-push generate-vapid-keys
  vapidPublicKey: 'BMumTj2GncVQRJryQD4BjLDzPnbZk3-8K463q34vAqJQ3iUHBn3b0KHss_4AddA9s6O4uw65OwRp-N6qOlrvCmA'
};
