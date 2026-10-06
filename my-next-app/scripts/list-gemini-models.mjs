// Temporary local diagnostic. Never import this script into the application.
// From my-next-app: node --env-file=.env.local scripts/list-gemini-models.mjs
import { GoogleGenAI } from "@google/genai";

async function main() {
  if (process.env.NODE_ENV === "production") {
    console.error("This diagnostic is for local development only.");
    process.exitCode = 1;
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey?.trim()) {
    console.error("Set GEMINI_API_KEY in .env.local before running this script.");
    process.exitCode = 1;
    return;
  }

  try {
    const client = new GoogleGenAI({
      apiKey,
      vertexai: false,
      httpOptions: { timeout: 15_000, retryOptions: { attempts: 1 } },
    });
    const models = await client.models.list({ config: { pageSize: 100 } });
    // The SDK's async iterator follows subsequent pages automatically.
    for await (const model of models) {
      // Allowlist output fields; never print the client or complete response.
      console.log(JSON.stringify({
        name: model.name,
        displayName: model.displayName,
        supportedActions: model.supportedActions,
      }));
    }
  } catch {
    // SDK exceptions can contain request information; do not print them.
    console.error("Unable to list models. Check the API key, project access, and network connection.");
    process.exitCode = 1;
  }
}

await main();
