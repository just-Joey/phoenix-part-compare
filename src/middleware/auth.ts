import type { NextFunction, Request, Response } from "express";

const authUrl = process.env.NEON_AUTH_URL;
if (!authUrl) {
  throw new Error("NEON_AUTH_URL is not set — required to verify Neon Auth JWTs");
}
const issuer = new URL(authUrl).origin;
const jwksUrl = new URL(`${authUrl}/.well-known/jwks.json`);

// Neon Auth has no "disable public sign-up" setting yet, so anyone can
// register a session — this allowlist is the actual access boundary.
const allowedEmails = new Set(
  (process.env.ALLOWED_USER_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean)
);
if (allowedEmails.size === 0) {
  throw new Error("ALLOWED_USER_EMAILS is not set — required to restrict access");
}

// Loaded lazily via dynamic import because jose is ESM-only and this project
// compiles to CommonJS — a static import would fail at runtime under `node
// dist/server.js` (works under tsx in dev only by accident). Dynamic import()
// is preserved as real ESM interop by tsc under moduleResolution "Node16",
// so this works in both dev and the compiled build.
type Payload = Record<string, unknown>;

let verifyPromise: Promise<(token: string) => Promise<Payload>> | undefined;

function getVerify() {
  if (!verifyPromise) {
    verifyPromise = import("jose").then((jose) => {
      const jwks = jose.createRemoteJWKSet(jwksUrl);
      return async (token: string): Promise<Payload> => {
        const { payload } = await jose.jwtVerify(token, jwks, { issuer });
        return payload;
      };
    });
  }
  return verifyPromise;
}

// Gates the API behind a signed-in Neon Auth session belonging to one of the
// allowlisted emails — this app calls the paid Claude API on every request,
// so no one else should ever reach the route handlers.
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or malformed Authorization header" });
    return;
  }

  try {
    const verify = await getVerify();
    const payload = await verify(header.slice("Bearer ".length));
    const email = typeof payload.email === "string" ? payload.email.toLowerCase() : undefined;
    if (!email || !allowedEmails.has(email)) {
      res.status(403).json({ error: "This account isn't authorized for this app" });
      return;
    }
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session" });
  }
}
