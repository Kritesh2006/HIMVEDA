/**
 * Prints an ADMIN_CREDENTIAL_HASHES value for deployment. Run privately.
 * Reads ADMIN_CODE_1..3 from the environment, or prompts. Never logs the codes.
 */
import { CODE_PATTERN, getPepper, hashCode, newSalt } from "../src/server/auth/codes";

const pepper = getPepper();
const parts: string[] = [];
for (const slot of [1, 2, 3]) {
  const code = process.env[`ADMIN_CODE_${slot}`]?.trim() ?? "";
  if (!CODE_PATTERN.test(code)) throw new Error(`ADMIN_CODE_${slot} must be 4–12 digits`);
  const salt = newSalt();
  parts.push(`${slot}:${salt}:${hashCode(code, salt, pepper)}`);
}
process.stdout.write(parts.join(";") + "\n");
