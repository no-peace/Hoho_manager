import { AdaptiveFields } from "@dmb/shared";
import type { ActionType, SetVariableMode } from "@dmb/shared";
import { configString, type ActionContext, type ActionResponse } from "./types.js";

export const type: ActionType = "set_variable";
export const description = "Store a value for later steps";

/**
 * Writes a value into the flow's variable bag.
 *
 * Variables are the plumbing for multi-step flows: a later step can reference
 * `{{name}}` in its content, and `check` branches on it.
 *
 * Three modes, matching Discohook's names — though `adaptive` is scoped to what
 * this bot can actually observe, because our handlers return a *response* rather
 * than a result object, so there is no "previous sent message" to read from:
 *
 * | Mode       | `value` means                | Example                          |
 * | ---------- | ---------------------------- | -------------------------------- |
 * | `static`   | a literal                    | `member`                         |
 * | `adaptive` | a field of the interaction   | `user.id`, `channel.id`, `selected` |
 * | `get`      | the name of another variable | `userId`                         |
 *
 * Always returns `undefined`: this step never responds, so the chain continues.
 */

/**
 * Fields an `adaptive` variable can read off the interaction.
 *
 * Re-exported from `@dmb/shared` so the editor offers exactly the fields this
 * handler knows how to read.
 */
export const ADAPTIVE_FIELDS = AdaptiveFields;

const readAdaptive = (field: string, { interaction }: ActionContext): unknown => {
  const user = interaction.member?.user ?? interaction.user;

  switch (field) {
    case "user.id":
      return user?.id ?? null;
    case "user.name":
      return user?.global_name ?? user?.username ?? null;
    case "user.tag":
      return user?.username ?? null;
    case "channel.id":
      return interaction.channel_id ?? null;
    case "guild.id":
      return interaction.guild_id ?? null;
    case "message.id":
      return interaction.message?.id ?? null;
    case "selected":
      // Select menus deliver their values as an array; join so `{{name}}` and
      // the `in` check can both treat it as a plain comma-separated list.
      return interaction.data?.values?.join(",") ?? "";
    default:
      return null;
  }
};

export const run = async (
  context: ActionContext,
): Promise<ActionResponse | undefined> => {
  const { config, variables } = context;
  const name = configString(config, "name");
  if (!name) return undefined;

  const mode = (configString(config, "varType") ?? "static") as SetVariableMode;

  switch (mode) {
    case "adaptive":
      variables[name] = readAdaptive(String(config.value ?? ""), context);
      break;
    case "get":
      variables[name] = variables[String(config.value ?? "")] ?? null;
      break;
    case "static":
    default:
      variables[name] = config.value ?? null;
      break;
  }

  return undefined; // continue
};

export default run;
