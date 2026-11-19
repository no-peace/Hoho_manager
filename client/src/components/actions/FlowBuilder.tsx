import { useMemo, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { ComponentType, type ComponentNode, type FlowStep } from "@dmb/shared";
import { buildCustomId, parseCustomId } from "@dmb/shared";
import { uid } from "../../utils/constants";
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
  const triggerLabel = component.type === ComponentType.Button ? "Button Click" : "Select Option";

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

    const usedCustomIds = new Set<string>();
    const collectCustomIds = (nodes: ComponentNode[]): void => {
      for (const node of nodes) {
        if (node._id !== componentId && typeof node.custom_id === "string") {
          usedCustomIds.add(node.custom_id);
        }
        if (node.components) collectCustomIds(node.components);
        if (node.accessory) collectCustomIds([node.accessory]);
      }
    };
    collectCustomIds(useMessageStore.getState().data.components ?? []);

    const createUniqueCustomId = (
      type: FlowStep["type"],
      config: Record<string, unknown>,
    ): string => {
      const stableId = componentId || uid();
      for (let attempt = 0; attempt < 10; attempt += 1) {
        const suffix = attempt === 0 ? stableId : `${stableId}-${attempt}`;
        const candidate = buildCustomId(type, { ...config, _componentId: suffix });
        if (!usedCustomIds.has(candidate)) return candidate;
      }
      throw new Error("Could not create a unique component custom_id.");
    };

    let nextCustomId = customId;
    if (first) {
      const config = cleanedConfig(first.config ?? {});
      try {
        nextCustomId = createUniqueCustomId(first.type, config);
        setWarning(null);
      } catch {
        // Keep the first action type and stable component identity when its
        // complete settings exceed Discord's 100-character custom_id limit.
        try {
          nextCustomId = createUniqueCustomId(first.type, {});
        } catch {
          nextCustomId = customId;
        }
        setWarning(
          "This step's settings are too long to fit in the button id, so they only run when the flow is registered (template or Server Bot mode send).",
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
  const hasBranches = steps.some((step) => {
    if (step.type !== "check") return false;
    const branchLength = (key: "then" | "else"): number => {
      const value = step.config?.[key];
      return Array.isArray(value) ? value.length : 0;
    };
    return branchLength("then") > 0 || branchLength("else") > 0;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 border-b border-[#272D3A] pb-3">
        <div className="min-w-0">
          <span className="block text-[0.6875rem] font-semibold uppercase tracking-wider text-[#A1A8B8]">
            Interaction Flow
          </span>
          <span className="block break-all font-mono text-xs text-[#818CF8]">
            {customId || "No custom ID yet"}
          </span>
        </div>
        <div className="shrink-0 text-right">
          <span className="block text-[0.6875rem] text-[#6F788A]">Trigger Event</span>
          <span className="text-xs font-medium text-[#F1F3F9]">{triggerLabel}</span>
        </div>
      </div>

      <div className="rounded-lg border border-[#272D3A] bg-[#10131A] p-3 text-xs text-[#A1A8B8]">
        Define what happens when a user interacts with this component in Discord.
        <span className="mt-1 block text-[0.6875rem] text-[#6F788A]">
          Multi-step and branching actions require a registered server-side flow. Use Server Bot mode when dispatching the message.
        </span>
      </div>

      <StepList steps={steps} onChange={commit} depth={0} />

      {(steps.length > 1 || hasBranches) && (
        <p className="rounded bg-[#10131A] px-2 py-1.5 text-[0.6875rem] text-[#6F788A]">
          Multi-step and branching flows run on the server. Save this as a template, or send it in{" "}
          <span className="text-[#F1F3F9]">Server Bot mode</span> so the steps are registered before the
          message goes out.
        </p>
      )}

      {warning && (
        <p className="flex items-start gap-1.5 rounded bg-[#FBBF24]/10 px-2 py-1.5 text-[0.6875rem] text-[#FBBF24]">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          {warning}
        </p>
      )}
    </div>
  );
};

export default FlowBuilder;
