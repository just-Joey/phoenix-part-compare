import { createInternalNeonAuth } from "@neondatabase/neon-js/auth";

// createAuthClient() only exposes the Better Auth client (signIn/signUp/
// signOut/getSession) and drops getJWTToken — createInternalNeonAuth gives
// us both from the same instance.
const neonAuth = createInternalNeonAuth(import.meta.env.VITE_NEON_AUTH_URL);

export const authClient = neonAuth.adapter;
export const getAuthToken = neonAuth.getJWTToken;
