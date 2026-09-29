import { useMemo, useState } from "react";
import { AlertTriangle, Wand2 } from "lucide-react";
import type { ComponentNode, FlowStep } from "@dmb/shared";
import { buildCustomId, parseCustomId } from "@dmb/shared";
import { useActionStore } from "../../store/actionStore";
import { useMessageStore } from "../../store/messageStore";
import { StepList } from "./StepList";

/**
 * Flow tab for a button or select.
 *
 * A flow is an ordered list of steps that run top to bottom when the component
 * is clicked — e.g. *add role → check → send DM*. The list is mirrored into two
 * places:
 *
 *   1. The component's `custom_id`, which carries only the **first** step's
 *      params. That keeps ad-hoc webhook sends (where the server is not
 *      involved) working for simple single-step actions.
 *   2. The action store, keyed by `custom_id`, which is saved with a template or
 *      registered with `/api/send` so longer chains can run server-side.
 *
 * `custom_id` is capped at 100 characters, so a long chain can never live
 * entirely in the id — that is exactly why the store exists.
 *
 * Editing itself lives in {@link StepList}, which renders one list and calls
 * itself for a `check` step's `then` / `else` branches. This component owns only
 * the top level, because only the top level changes the `custom_id`.
 */

const cleanedConfig = (config: Record<string, unknown>): Record<string, unknown> =>
  Object.fromEntries(
    Object.entries(config).filter(([, value]) => value !== "" && value !== undefined),
  );

export interface FlowBuilderProps {
  component: ComponentNode;
}

export const FlowBuilder = ({ component }: FlowBuilderProps) => {
  const flows = useActionStore((state) => state.flows);
  const updateComponentById = useMessageStore((state) => state.updateComponentById);
  const [warning, setWarning] = useState<string | null>(null);

  const customId = component.custom_id ?? "";
  const componentId = component._id ?? "";

  // Prefer the stored flow; fall back to whatever the custom_id encodes so an
  // imported message still shows its first step.
  const steps: FlowStep[] = useMemo(() => {
    const stored = flows[customId];
    if (stored && stored.length > 0) return stored;

    const parsed = parseCustomId(customId);
    if (!parsed) return [];
    return [{ _id: "inline", type: parsed.type as FlowStep["type"], config: parsed.params }];
  }, [flows, customId]);

  /**
   * Persist a new step list and keep the component's `custom_id` in step with it.
   * The id is derived from the first step only, both to stay unique per component
   * and to keep the inline fallback meaningful. Branch steps inside a `check` do
   * not affect the id — they always execute server-side.
   */
  const commit = (nextSteps: FlowStep[]): void => {
    const store = useActionStore.getState();
    const first = nextSteps[0];

    let nextCustomId = customId;
    if (first) {
      const config = cleanedConfig(first.config ?? {});
      try {
        nextCustomId = buildCustomId(first.type, config);
        setWarning(null);
      } catch {
        // The params alone overflow 100 chars. Drop them from the id — the full
        // config is still registered server-side, so the flow keeps working. A
        // webhook-only send would lose them, so say so.
        try {
          nextCustomId = buildCustomId(first.type);
        } catch {
          nextCustomId = customId;
        }
        setWarning(
          "This step's settings are too long to fit in the button id, so they only run when the flow is registered (template or bot-token send).",
        );
      }
    } else {
      nextCustomId = "action:dud";
    }

    if (nextCustomId === customId) {
      store.setFlow(customId, nextSteps);
      return;
    }

    // Write under the old key first, then move it, so nothing is dropped.
    store.setFlow(customId, nextSteps);
    store.renameFlow(customId, nextCustomId);
    updateComponentById(componentId, { custom_id: nextCustomId });
  };

  // Branch steps are the only thing that forces server-side execution for this
  // component, so the note below keys off them rather than step count.
  const hasBranches = steps.some((step) => {
    if (step.type !== "check") return false;
    const branchLength = (key: "then" | "else"): number => {
      const value = step.config?.[key];
      return Array.isArray(value) ? value.length : 0;
    };
    return branchLength("then") > 0 || branchLength("else") > 0;
  });

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-[11px] font-semibold text-ink-muted">
        <Wand2 size={12} className="text-blurple" />
        Flow — steps run top to bottom when this is clicked
      </p>

      <StepList steps={steps} onChange={commit} depth={0} />

      <p className="break-all font-mono text-[10px] text-ink-faint">
        custom_id: {customId || "—"} ({customId.length}/100)
      </p>

      {(steps.length > 1 || hasBranches) && (
        <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
          Multi-step and branching flows run on the server. Save this as a template, or send it in{" "}
          <span className="text-ink">bot token</span> mode so the steps are registered before the
          message goes out.
        </p>
      )}

      {warning && (
        <p className="flex items-start gap-1.5 rounded bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}
    </div>
  );
};

export default FlowBuilder;
