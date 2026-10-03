import { create } from "zustand";
import type {
  ActionHandlerMeta,
  ActionType,
  FlowRegistration,
  FlowStep,
  StoredActionDefinition,
} from "@dmb/shared";
import { api } from "../api/client";
import { uid } from "../utils/constants";

/**
 * Action flows, keyed by the component `custom_id` they belong to.
 *
 * A flow is an **ordered list of steps** (Discohook-style): a button can add a
 * role, then DM the user, then reply — all from one click. Two representations
 * have to be kept in sync:
 *
 *   - In memory: `FlowStep[]`, with editor-only `_id`s so the list can reorder.
 *   - On the wire: a flat list of `StoredActionDefinition`s carrying an
 *     `execution_order`, which is what the server reads back on a click.
 *
 * `custom_id` is capped at 100 characters, which is far too small for a chain, so
 * only the *first* step's params can ride inline there. Everything else is
 * registered server-side: saved templates persist their steps, and ad-hoc sends
 * register theirs through `/api/send` (see {@link toRegistrations}).
 */

/**
 * Used until `/api/config` responds, and if the backend is unreachable.
 * Kept aligned with `server/src/actions/index.ts`.
 */
const FALLBACK_TYPES: ActionHandlerMeta[] = [
  { type: "dud", description: "Do nothing" },
  { type: "add_role", description: "Give the member who clicked a role" },
  { type: "remove_role", description: "Take a role away from the member who clicked" },
  { type: "toggle_role", description: "Add the role if absent, remove it if present" },
  { type: "send_ephemeral_reply", description: "Show the clicker a private message" },
  { type: "send_dm", description: "DM the member who clicked" },
  { type: "open_modal", description: "Open a form the user can fill in" },
  { type: "send_message", description: "Send a message as the bot" },
  { type: "send_webhook_message", description: "Send a message through a saved webhook" },
  { type: "delete_message", description: "Delete the message carrying the component" },
  { type: "create_thread", description: "Start a thread from the message" },
  { type: "wait", description: "Pause before the next step" },
  { type: "set_variable", description: "Store a value for later steps" },
  { type: "check", description: "Branch or stop the flow based on a condition" },
  { type: "stop", description: "End the flow here" },
];

/** Config keys a `check` step may use to store its sub-chains. */
export const BRANCH_KEYS = ["then", "else", "pass", "fail"] as const;

/** A sensible default config for a freshly added step. */
const defaultConfig = (type: ActionType): Record<string, unknown> => {
  switch (type) {
    case "add_role":
    case "remove_role":
    case "toggle_role":
      return { roleId: "" };
    case "send_ephemeral_reply":
    case "send_dm":
      return { content: "" };
    case "open_modal":
      return { title: "Form", customId: "modal:form" };
    case "send_message":
      return { content: "" };
    case "send_webhook_message":
      return { content: "" };
    case "create_thread":
      return { name: "" };
    case "wait":
      return { seconds: 1 };
    case "set_variable":
      return { name: "", value: "", varType: "static" };
    case "check":
      return {
        left: "",
        op: "==",
        right: "",
        then: [],
        else: [],
      };
    case "stop":
      return { content: "" };
    default:
      return {};
  }
};

export const createStep = (type: ActionType = "dud"): FlowStep => ({
  _id: uid(),
  type,
  config: defaultConfig(type),
});

export interface ActionState {
  actionTypes: ActionHandlerMeta[];
  typesLoaded: boolean;
  /** `{ [customId]: FlowStep[] }` — the ordered chain for each component. */
  flows: Record<string, FlowStep[]>;

  fetchActionTypes(): Promise<void>;

  getFlow(customId: string): FlowStep[];
  setFlow(customId: string, steps: FlowStep[]): void;
  addStep(customId: string, type?: ActionType): void;
  updateStep(customId: string, index: number, patch: Partial<FlowStep>): void;
  removeStep(customId: string, index: number): void;
  moveStep(customId: string, index: number, direction: number): void;
  /** Move a flow when its component's `custom_id` changes. */
  renameFlow(oldCustomId: string, nextCustomId: string): void;
  removeFlow(customId: string): void;

  /** Flatten every flow for the template API. */
  toList(): StoredActionDefinition[];
  /** Rebuild flows from a loaded template, preserving step order. */
  loadFromList(list: StoredActionDefinition[]): void;
  /** Flows for an ad-hoc send, so the server can execute multi-step chains. */
  toRegistrations(): FlowRegistration[];

  reset(): void;
}

/**
 * Serialise one step, dropping editor-only `_id`s **recursively**.
 *
 * A `check` step carries its branches inside `config.then` / `config.else`, so a
 * shallow strip would leave nested `_id`s in the persisted JSON. The server
 * ignores them, but they would round-trip into the database and change every
 * time the editor reloaded, making template diffs noisy for no benefit.
 */
const stripStep = (step: FlowStep): { type: ActionType; config: Record<string, unknown> } => ({
  type: step.type,
  config: stripConfig(step.config ?? {}),
});

const stripConfig = (config: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if ((BRANCH_KEYS as readonly string[]).includes(key)) {
      next[key] = Array.isArray(value) ? value.map((entry) => stripStep(entry as FlowStep)) : [];
      continue;
    }
    next[key] = value;
  }

  return next;
};

/** Give every step — including nested branch steps — a fresh editor `_id`. */
const hydrateStep = (step: FlowStep): FlowStep => ({
  ...step,
  _id: step._id ?? uid(),
  config: hydrateConfig(step.config ?? {}),
});

const hydrateConfig = (config: Record<string, unknown>): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...config };

  for (const key of BRANCH_KEYS) {
    const value = next[key];
    if (Array.isArray(value)) {
      next[key] = value.map((entry) => hydrateStep(entry as FlowStep));
    }
  }

  return next;
};

export const useActionStore = create<ActionState>()((set, get) => ({
  actionTypes: FALLBACK_TYPES,
  typesLoaded: false,
  flows: {},

  fetchActionTypes: async () => {
    try {
      const response = await api.config();
      if (Array.isArray(response.actionTypes) && response.actionTypes.length > 0) {
        set({ actionTypes: response.actionTypes, typesLoaded: true });
      }
    } catch {
      // Offline or backend down: the fallback list keeps the editor usable.
      set({ typesLoaded: false });
    }
  },

  getFlow: (customId) => get().flows[customId] ?? [],

  setFlow: (customId, steps) =>
    set((state) => {
      const flows = { ...state.flows };
      if (steps.length === 0) delete flows[customId];
      else flows[customId] = steps;
      return { flows };
    }),

  addStep: (customId, type = "dud") =>
    set((state) => ({
      flows: {
        ...state.flows,
        [customId]: [...(state.flows[customId] ?? []), createStep(type)],
      },
    })),

  updateStep: (customId, index, patch) =>
    set((state) => {
      const existing = state.flows[customId];
      if (!existing || !existing[index]) return {};

      const steps = [...existing];
      steps[index] = { ...steps[index], ...patch } as FlowStep;
      return { flows: { ...state.flows, [customId]: steps } };
    }),

  removeStep: (customId, index) =>
    set((state) => {
      const existing = state.flows[customId];
      if (!existing) return {};

      const steps = existing.filter((_, i) => i !== index);
      const flows = { ...state.flows };
      if (steps.length === 0) delete flows[customId];
      else flows[customId] = steps;
      return { flows };
    }),

  moveStep: (customId, index, direction) =>
    set((state) => {
      const existing = state.flows[customId];
      const target = index + direction;
      if (!existing || target < 0 || target >= existing.length) return {};

      const steps = [...existing];
      const a = steps[index];
      const b = steps[target];
      if (!a || !b) return {};
      steps[index] = b;
      steps[target] = a;
      return { flows: { ...state.flows, [customId]: steps } };
    }),

  renameFlow: (oldCustomId, nextCustomId) =>
    set((state) => {
      if (oldCustomId === nextCustomId) return {};
      const existing = state.flows[oldCustomId];
      if (!existing) return {};

      const flows = { ...state.flows };
      delete flows[oldCustomId];
      flows[nextCustomId] = existing;
      return { flows };
    }),

  removeFlow: (customId) =>
    set((state) => {
      if (!state.flows[customId]) return {};
      const flows = { ...state.flows };
      delete flows[customId];
      return { flows };
    }),

  toList: () =>
    Object.entries(get().flows).flatMap(([customId, steps]) =>
      steps.map((step, index) => ({
        customId,
        actionType: step.type,
        config: stripConfig(step.config ?? {}),
        executionOrder: index,
      })),
    ),

  loadFromList: (list) =>
    set(() => {
      const grouped: Record<string, FlowStep[]> = {};
      for (const item of list) {
        (grouped[item.customId] ??= []).push(
          hydrateStep({ type: item.actionType, config: item.config ?? {} }),
        );
      }
      // Order within each custom_id is whatever the server returned, which is
      // already sorted by execution_order.
      return { flows: grouped };
    }),

  toRegistrations: () => {
    const flows = get().flows;
    const registrations: FlowRegistration[] = [];

    // Emit all top-level component flows
    for (const [customId, steps] of Object.entries(flows)) {
      if (steps.length === 0) continue;
      registrations.push({ customId, steps: steps.map(stripStep) });

      // Scan for open_modal steps with nested `then` branches
      for (const step of steps) {
        if (step.type === "open_modal" && step.config?.then && Array.isArray(step.config.then) && step.config.then.length > 0) {
          const modalCustomId = (typeof step.config.customId === "string" && step.config.customId.trim() !== "")
            ? step.config.customId.trim()
            : null;
          
          if (modalCustomId) {
            registrations.push({
              customId: modalCustomId,
              steps: step.config.then.map((entry) => stripStep(entry as FlowStep)),
            });
          }
        }
      }
    }

    return registrations;
  },

  reset: () => set({ flows: {} }),
}));

export default useActionStore;
