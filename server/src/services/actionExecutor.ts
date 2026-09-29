import { parseCustomId } from "@dmb/shared";
import type { DiscordInteraction } from "@dmb/shared";
import { getActionHandler } from "../actions/index.js";
import { actionFailed } from "../actions/responses.js";
import type { ActionContext, ActionResponse } from "../actions/types.js";
import { actionRepository, webhookProfileRepository } from "../repositories/index.js";
import { logger } from "../utils/logger.js";
import { hasBranches, selectBranch, type ExecutableStep } from "./branches.js";
import * as discord from "./discordService.js";

const log = logger.child("actions");

/** Guard against a `check` whose branches nest into each other forever. */
const MAX_BRANCH_DEPTH = 10;

export interface ExecuteResult {
  /** The response to send, if a step produced one. */
  response: ActionResponse | undefined;
  /** False when the custom id was not ours at all. */
  handled: boolean;
  type: string | null;
}

/**
 * Runs the action chain bound to a component's `custom_id`.
 *
 * Resolution order:
 *   1. Definitions saved in `action_definitions` (richer config, survives
 *      `custom_id` length limits) — these may be several steps.
 *   2. The `custom_id`'s inline params, as a single step. This is what makes
 *      ad-hoc messages sent straight from the editor work without a template.
 *
 * **Execution stops at the first step that returns a response**, which is then
 * sent as the interaction callback. Steps before it (waits, variable writes) run
 * silently. This gives predictable single-reply behaviour for chains.
 *
 * A `check` step with `then` / `else` branches is resolved *here* rather than in
 * its handler, because a branch is a sub-chain: the executor recurses into the
 * chosen list with the same variable bag, and a response from anywhere inside it
 * ends the whole flow.
 */
export const executeCustomId = async (
  customId: string,
  interaction: DiscordInteraction,
): Promise<ExecuteResult> => {
  const parsed = parseCustomId(customId);
  if (!parsed) return { response: undefined, handled: false, type: null };

  const stored = await actionRepository.findByCustomId(customId);
  const steps: ExecutableStep[] =
    stored.length > 0
      ? stored.map((definition) => ({
          id: definition.id,
          type: definition.action_type,
          config: definition.config ?? {},
        }))
      : [{ id: null, type: parsed.type, config: parsed.params }];

  const variables: Record<string, unknown> = {};
  const botToken = await discord.resolveBotToken().catch(() => null);

  const context: Omit<ActionContext, "config"> = {
    interaction,
    variables,
    botToken,
    discord,
    // Handlers that need persistence receive it explicitly rather than
    // importing repositories themselves, so they stay unit-testable.
    repositories: { webhookProfiles: webhookProfileRepository },
    logger: log,
  };

  const logStep = async (
    step: ExecutableStep,
    response: ActionResponse | undefined,
    startedAt: number,
  ): Promise<void> => {
    await actionRepository.log({
      actionDefinitionId: step.id,
      interactionId: interaction.id,
      userId: interaction.member?.user?.id ?? interaction.user?.id ?? "unknown",
      guildId: interaction.guild_id ?? null,
      channelId: interaction.channel_id ?? null,
      status: response ? "success" : "pending",
      response: { type: step.type, ms: Date.now() - startedAt },
    });
  };

  const runSteps = async (
    list: ExecutableStep[],
    depth: number,
  ): Promise<ActionResponse | undefined> => {
    if (depth > MAX_BRANCH_DEPTH) {
      log.warn(`Flow branches nested deeper than ${MAX_BRANCH_DEPTH}; stopping`);
      return actionFailed("That flow nests too deeply to run.");
    }

    for (const step of list) {
      const handler = getActionHandler(step.type);
      if (!handler) {
        log.warn(`No handler registered for action type "${step.type}"`);
        continue;
      }

      const started = Date.now();

      // Branching check: recurse into the chosen sub-chain instead of calling
      // the handler, which only knows about the legacy single-shot behaviour.
      if (step.type === "check" && hasBranches(step.config)) {
        const branch = selectBranch(step.config, variables);
        const nested = await runSteps(branch, depth + 1);
        await logStep(step, nested, started);
        if (nested) return nested;
        continue;
      }

      let response: ActionResponse | undefined;

      try {
        response = await handler.run({ ...context, config: step.config });
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        const stack = error instanceof Error ? error.stack : undefined;
        log.error(`Action "${step.type}" threw: ${reason}`, stack);
        response = actionFailed("Something went wrong running that action.");
      }

      await logStep(step, response, started);

      if (response) return response;
    }

    return undefined;
  };

  const response = await runSteps(steps, 0);

  // One line per click, so `pm2 logs dmb-api` answers "did my button do
  // anything?" without opening the database. Which delivery mode is in play
  // (webhook vs gateway relay) is invisible from here by design — both call this.
  log.info(
    response
      ? `Ran ${parsed.type} (${steps.length} step${steps.length === 1 ? "" : "s"}) and replied`
      : `Ran ${parsed.type} (${steps.length} step${steps.length === 1 ? "" : "s"}) with no visible reply`,
  );

  return { response, handled: true, type: parsed.type };
};

export default { executeCustomId };
