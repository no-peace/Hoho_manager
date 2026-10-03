import type { ActionHandlerMeta } from "@dmb/shared";
import * as addRole from "./addRole.js";
import * as check from "./check.js";
import * as createThread from "./createThread.js";
import * as deleteMessage from "./deleteMessage.js";
import * as dud from "./dud.js";
import * as modalSubmit from "./modalSubmit.js";
import * as openModal from "./openModal.js";
import * as removeRole from "./removeRole.js";
import * as sendDm from "./sendDm.js";
import * as sendEphemeralReply from "./sendEphemeralReply.js";
import * as sendMessage from "./sendMessage.js";
import * as sendWebhookMessage from "./sendWebhookMessage.js";
import * as setVariable from "./setVariable.js";
import * as stop from "./stop.js";
import * as toggleRole from "./toggleRole.js";
import * as wait from "./wait.js";
import type { ActionHandlerModule } from "./types.js";

/**
 * The action registry.
 *
 * `custom_id` -> handler. Adding a capability means writing a module exporting
 * `type`, `description` and `run(ctx)` and listing it here.
 */
const modules: readonly ActionHandlerModule[] = [
  dud,
  modalSubmit,
  addRole,
  removeRole,
  toggleRole,
  sendEphemeralReply,
  sendDm,
  openModal,
  sendMessage,
  sendWebhookMessage,
  deleteMessage,
  createThread,
  wait,
  setVariable,
  check,
  stop,
];

const registry = new Map<string, ActionHandlerModule>(
  modules.map((module) => [module.type, module]),
);

/** Look up a handler by its action type, or `null` when unregistered. */
export const getActionHandler = (actionType: string): ActionHandlerModule | null =>
  registry.get(actionType) ?? null;

export const hasActionHandler = (actionType: string): boolean =>
  registry.has(actionType);

/** Metadata for the UI's action picker. */
export const listActionTypes = (): ActionHandlerMeta[] =>
  modules.map((module) => ({
    type: module.type,
    description: module.description,
  }));

export default { getActionHandler, hasActionHandler, listActionTypes };