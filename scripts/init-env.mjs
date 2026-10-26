import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (existsSync(".env")) {
  console.log(".env already exists; left unchanged.");
  process.exit(0);
}
writeFileSync(
  ".env",
  `DATABASE_URL=postgresql://kshorts:kshorts-local@localhost:5432/kshorts\nAPP_PASSWORD=${randomBytes(18).toString("base64url")}\nSESSION_SECRET=${randomBytes(32).toString("hex")}\nAI_MODE=demo\nOPENAI_MODEL=gpt-4.1-mini\nSTORAGE_DIR=./storage\n`,
  { mode: 0o600, flag: "wx" },
);
console.log(
  "Created private .env with random login password and session secret. Read APP_PASSWORD locally in your editor; never commit or share .env.",
);
