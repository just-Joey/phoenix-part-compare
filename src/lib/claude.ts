import Anthropic from "@anthropic-ai/sdk";

if (!process.env.ANTHROPIC_API_KEY) {
  // Fail loudly at startup rather than getting a confusing 401 on first request.
  throw new Error(
    "ANTHROPIC_API_KEY is not set. Copy .env.example to .env and fill it in."
  );
}

export const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
