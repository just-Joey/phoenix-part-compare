import { createInternalNeonAuth } from "@neondatabase/neon-js/auth";

// createAuthClient() only exposes the Better Auth client (signIn/signUp/
// signOut/getSession) and drops getJWTToken — createInternalNeonAuth gives
// us both from the same instance.
const neonAuth = createInternalNeonAuth(import.meta.env.VITE_NEON_AUTH_URL);

const authUrl = import.meta.env.VITE_NEON_AUTH_URL;
if (!authUrl || !authUrl.startsWith("http")) {
  throw new Error(
    `VITE_NEON_AUTH_URL is missing or malformed: ${JSON.stringify(authUrl)}. Check client/.env.`
  );
}
export const authClient = neonAuth.adapter;
export const getAuthToken = neonAuth.getJWTToken;
