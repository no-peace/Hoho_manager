import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Wand2 } from "lucide-react";
import { ComponentType } from "@dmb/shared";
import type { ComponentNode, FlowStep } from "@dmb/shared";
import { buildCustomId, parseCustomId } from "@dmb/shared";
import { useActionStore } from "../../store/actionStore";
import { useMessageStore } from "../../store/messageStore";
import { StepList } from "./StepList";

/**
 * Flow tab for a button or select.
 *
 * A flow is an ordered list of steps that run top to bottom when the component
 * is clicked  e.g. *add role → check → send DM*. The list is mirrored into two
 * places:
 *
 *   1. The component's `custom_id`, which carries only the **first** step's
 *      params. That keeps ad-hoc webhook sends (where the server is not
 *      involved) working for simple single-step actions.
 *   2. The action store, keyed by `custom_id`, which is saved with a template or
 *      registered with `/api/send` so longer chains can run server-side.
 *
 * `custom_id` is capped at 100 characters, so a long chain can never live
 * entirely in the id  that is exactly why the store exists.
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
    if (!parsed || parsed.type === "dud") return [];
    return [{ _id: "inline", type: parsed.type as FlowStep["type"], config: parsed.params }];
  }, [flows, customId]);

  /**
   * Persist a new step list and keep the component's `custom_id` in step with it.
   * The id is derived from the first step only, both to stay unique per component
   * and to keep the inline fallback meaningful. Branch steps inside a `check` do
   * not affect the id  they always execute server-side.
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
        // The params alone overflow 100 chars. Drop them from the id  the full
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
      nextCustomId = `action:dud:{"_id":"${componentId || Math.random().toString(36).slice(2, 10)}"}`;
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
  const triggerLabel = component.type === ComponentType.Button ? "Button interaction" : "Select menu interaction";

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
      <div className="rounded-[10px] border border-[#818CF8]/35 bg-[#161A23] p-3.5">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="rounded-md border border-[#A78BFA]/25 bg-[#A78BFA]/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold tracking-wide text-[#A78BFA]">TRIGGER</span>
          <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#34D399]"><CheckCircle2 size={11} /> Auto-saved</span>
        </div>
        <div className="flex items-start gap-2">
          <Wand2 size={16} className="mt-0.5 shrink-0 text-[#818CF8]" />
          <div className="min-w-0 flex-1">
            <h3 className="text-xs font-semibold text-[#F1F3F9]">{asText(component.label) || triggerLabel}</h3>
            <p className="mt-0.5 text-[11px] leading-relaxed text-[#A1A8B8]">Runs when a user interacts with this {triggerLabel.toLowerCase()} in Discord.</p>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#202531] pt-2">
          <span className="text-[10px] text-[#6F788A]">Trigger custom ID</span>
          <code className="min-w-0 truncate font-mono text-[10px] text-[#A5B4FC]" title={customId}>{customId || "Generated when the first step is added"}</code>
        </div>
        <p className="mt-1 text-right font-mono text-[9px] text-[#6F788A]">{customId.length}/100 characters</p>
      </div>

      <StepList steps={steps} onChange={commit} depth={0} />

      {(steps.length > 1 || hasBranches) && (
        <p className="rounded bg-[#10131A] px-2 py-1.5 text-[11px] text-[#6F788A]">
          Multi-step and branching flows run on the server. Save this as a template, or send it in{" "}
          <span className="text-[#F1F3F9]">bot token</span> mode so the steps are registered before the
          message goes out.
        </p>
      )}

      {warning && (
        <p className="flex items-start gap-1.5 rounded bg-[#FBBF24]/10 px-2 py-1.5 text-[11px] text-[#FBBF24]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}
    </div>
  );
};

export default FlowBuilder;
