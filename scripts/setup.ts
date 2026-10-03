import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
if (!existsSync(".env")) {
  const template = readFileSync(".env.example", "utf8");
  writeFileSync(
    ".env",
    template.replace(
      "ENCRYPTION_KEY=",
      "ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
    ),
    { mode: 0o600 },
  );
  console.log("Created local .env with a unique encryption key.");
} else console.log("Existing .env preserved.");
