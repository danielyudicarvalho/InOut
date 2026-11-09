import * as Crypto from "expo-crypto";
import * as SecureStore from "expo-secure-store";
import * as WebBrowser from "expo-web-browser";
import { createAuthService, requireIssuer } from "@inout/identity";
import { resetUser } from "../analytics/posthog";
import {
  createOpenIdAuthRepository,
  createOpenIdSession,
} from "@inout/identity/openid";

const issuer = requireIssuer(process.env.EXPO_PUBLIC_AUTH_ISSUER);
const redirectUri = "inout://auth/callback";
let repository: ReturnType<typeof createOpenIdAuthRepository> | undefined;

function authRepository() {
  return (repository ??= createOpenIdAuthRepository({
    issuer,
    clientId: "inout-mobile",
    redirectUri,
    storage: {
      getItem: (key) => SecureStore.getItemAsync(key),
      setItem: (key, value) => SecureStore.setItemAsync(key, value),
      deleteItem: (key) => SecureStore.deleteItemAsync(key),
    },
    openBrowser: async (url, returnUri) => {
      if (!returnUri) {
        await WebBrowser.openBrowserAsync(url);
        return null;
      }
      const result = await WebBrowser.openAuthSessionAsync(url, returnUri);
      return result.type === "success" ? { url: result.url } : null;
    },
    fetch,
    sha256: async (value) => {
      const encoded = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        value,
        { encoding: Crypto.CryptoEncoding.BASE64 },
      );
      return Uint8Array.from(atob(encoded), (character) =>
        character.charCodeAt(0),
      );
    },
    randomBytes: async (length) => Crypto.getRandomBytes(length),
  }));
}

export function getAuthClient() {
  return createOpenIdSession(authRepository());
}

export function getAuth() {
  const service = createAuthService(authRepository());
  return {
    ...service,
    async signOut() {
      await service.signOut();
      resetUser();
    },
  };
}

let email = "";
export function rememberEmail(value: string) {
  email = value.trim().toLowerCase();
}
export function pendingEmail() {
  return email;
}
