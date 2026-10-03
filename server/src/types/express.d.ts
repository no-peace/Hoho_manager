import type { DiscordInteraction, UserRecord } from "@dmb/shared";

/**
 * Adds the values our middleware attaches to the Express request.
 *
 * Both are optional because whether they exist depends on which middleware ran.
 * Route handlers should read them through the `requireUser` / `requireInteraction`
 * helpers in `middleware/auth.ts` and `middleware/verifyDiscordSignature.ts`,
 * which turn "probably present" into a guaranteed type (or a 401).
 */
import type { StaffRecord } from "../repositories/staffRepository.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Set by `attachUser`. */
      user?: UserRecord;
      /** Set by `verifyDiscordSignature` after the Ed25519 check passes. */
      interaction?: DiscordInteraction;
      staffContext?: {
        isAdmin: boolean;
        staffId: string | null;
        record?: StaffRecord;
      };
    }
  }
}

export {};
