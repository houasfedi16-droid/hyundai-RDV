import Keycloak from "keycloak-js";

const keycloak = new Keycloak({
  url: "http://localhost:8080",
  realm: "hyundai-rdv",
  clientId: "hyundai-frontend",
});

export default keycloak;