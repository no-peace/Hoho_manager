import { useMemo, useState, type ChangeEvent } from "react";
import {
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  CornerDownRight,
  Plus,
  Trash2,
} from "lucide-react";
import { AdaptiveFields, CheckFunctions, SetVariableModes } from "@dmb/shared";
import type { ActionConfig, CheckCondition, FlowStep } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, Select, TextArea, TextField } from "../ui/Field";
import { createStep, useActionStore } from "../../store/actionStore";

/**
 * Recursive flow-step editor.
 *
 * A flow is a list of steps, and a `check` step contains **two more lists**
 * (`then` / `else`) in its own config. Rendering that as a flat list would make
 * branching unrepresentable, so this component renders one list and calls itself
 * for each branch. The recursion is the whole point: a check inside a check works
 * without any special case.
 *
 * The nesting is stored in config rather than as sibling rows because the server
 * persists flows to a flat, ordered `action_definitions` table — a tree cannot be
 * expressed by `execution_order` alone. See `server/src/services/branches.ts`.
 */

interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}

/**
 * Field descriptors per action type. Keys are the same config keys the server
 * handlers read (`roleId`, `content`, …), so no translation layer is needed.
 *
 * `check` and `set_variable` are absent here on purpose: they need purpose-built
 * controls (a function picker, a mode picker, and for `check`, the branch lists)
 * and are rendered by the switch below. `stop` is a plain field.
 */
const CONFIG_FIELDS: Record<string, readonly ConfigField[]> = {
  dud: [],
  add_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  remove_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  toggle_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  send_ephemeral_reply: [{ key: "content", label: "Reply text", textarea: true }],
  send_dm: [{ key: "content", label: "DM text", textarea: true }],
  open_modal: [
    { key: "title", label: "Modal title", placeholder: "Tell us about you" },
    { key: "customId", label: "Modal custom id", placeholder: "modal:about" },
  ],
  send_message: [
    { key: "channelId", label: "Channel ID (defaults to here)", placeholder: "123456789012345678" },
    { key: "content", label: "Message", textarea: true },
  ],
  send_webhook_message: [
    { key: "webhookProfileId", label: "Webhook profile ID", placeholder: "1" },
    { key: "content", label: "Message", textarea: true },
  ],
  delete_message: [],
  create_thread: [{ key: "name", label: "Thread name", placeholder: "Support ticket" }],
  wait: [{ key: "seconds", label: "Seconds", placeholder: "1", type: "number" }],
  stop: [
    {
      key: "content",
      label: "Message (optional)",
      textarea: true,
      placeholder: "Leave empty to acknowledge the click silently",
    },
  ],
};

const CHECK_KEY = "check";
const SET_VARIABLE_KEY = "set_variable";

/** Past this the server refuses to recurse (`MAX_BRANCH_DEPTH`), so warn first. */
const WARN_DEPTH = 8;

const labelFor = (type: string): string => type.replace(/_/g, " ");

const asText = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

/** Read a `check` step's conditions, normalised so the UI never sees `undefined`. */
const readConditions = (config: ActionConfig): CheckCondition[] => {
  if (!Array.isArray(config.conditions)) return [];

  const parsed = config.conditions.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [{ a: record.a, b: record.b, loose: record.loose === true }];
  });

  return parsed.length > 0 ? parsed : [{ a: "", b: "", loose: false }];
};

/** Read a branch array out of a config, tolerating hand-edited JSON. */
const readBranch = (config: ActionConfig, key: "then" | "else"): FlowStep[] => {
  const value = config[key];
  if (!Array.isArray(value)) return [];

  return value.flatMap((entry) => {
    if (entry === null || typeof entry !== "object") return [];
    const record = entry as Record<string, unknown>;
    return [{ type: (record.type as FlowStep["type"]) ?? "dud", config: (record.config ?? {}) as ActionConfig }];
  });
};

export interface StepListProps {
  steps: FlowStep[];
  /** Receives the complete, edited list. */
  onChange: (steps: FlowStep[]) => void;
  /** 0 for the component's own flow; >0 inside a check branch. */
  depth: number;
}

export const StepList = ({ steps, onChange, depth }: StepListProps) => {
  const [addingType, setAddingType] = useState<string>("add_role");
  const nested = depth > 0;

  // Driven by `GET /api/config` (falling back to a bundled copy) so the picker
  // cannot drift from the server's action registry. `dud` is hidden — it exists
  // for the inline custom-id case, not as something to choose deliberately.
  const actionTypes = useActionStore((state) => state.actionTypes);
  const typeOptions = useMemo(
    () =>
      actionTypes
        .filter((action) => action.type !== "dud")
        .map((action) => ({ value: action.type, label: action.type.replace(/_/g, " ") })),
    [actionTypes],
  );

  const patch = (index: number, next: FlowStep): void => {
    onChange(steps.map((step, i) => (i === index ? next : step)));
  };

  const patchConfig = (index: number, config: ActionConfig): void => {
    const step = steps[index];
    if (!step) return;
    patch(index, { ...step, config });
  };

  const move = (index: number, direction: number): void => {
    const target = index + direction;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const a = next[index];
    const b = next[target];
    if (!a || !b) return;
    next[index] = b;
    next[target] = a;
    onChange(next);
  };

  const remove = (index: number): void => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const changeType = (index: number, type: string): void => {
    const step = steps[index];
    if (!step) return;
    // Keep the editor `_id` so React does not remount the card mid-edit.
    patch(index, { ...createStep(type as FlowStep["type"]), _id: step._id });
  };

  const renderFields = (index: number, step: FlowStep) => {
    const config = step.config ?? {};

    if (step.type === SET_VARIABLE_KEY) {
      const mode = asText(config.varType) || "static";

      return (
        <>
          <TextField
            label="Variable name"
            value={asText(config.name)}
            placeholder="userId"
            onChange={(event) => patchConfig(index, { ...config, name: event.target.value })}
          />
          <Select
            label="Value source"
            value={mode}
            onChange={(event) => patchConfig(index, { ...config, varType: event.target.value })}
            options={SetVariableModes.map((entry) => ({ value: entry.value, label: entry.label }))}
          />
          {mode === "adaptive" ? (
            <Select
              label="Reading"
              value={asText(config.value)}
              onChange={(event) => patchConfig(index, { ...config, value: event.target.value })}
              options={[
                { value: "", label: "Choose a field…" },
                ...AdaptiveFields.map((field) => ({ value: field, label: field })),
              ]}
            />
          ) : (
            <TextField
              label={mode === "get" ? "Variable to copy" : "Value"}
              value={asText(config.value)}
              placeholder={mode === "get" ? "userId" : "member"}
              onChange={(event) => patchConfig(index, { ...config, value: event.target.value })}
            />
          )}
        </>
      );
    }

    if (step.type === CHECK_KEY) {
      const conditions = readConditions(config);
      const fn = asText(config.function) || "equals";

      const writeConditions = (next: CheckCondition[]): void =>
        patchConfig(index, { ...config, conditions: next });

      return (
        <>
          <Select
            label="Condition"
            value={fn}
            onChange={(event) => patchConfig(index, { ...config, function: event.target.value })}
            options={CheckFunctions.map((entry) => ({ value: entry.value, label: entry.label }))}
          />

          <div className="space-y-2">
            {conditions.map((condition, conditionIndex) => (
              <div
                key={conditionIndex}
                className="space-y-2 rounded-md border border-line-soft bg-raised/40 p-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                    {conditions.length > 1 ? `Condition ${conditionIndex + 1}` : "Comparison"}
                  </span>
                  {conditions.length > 1 && (
                    <IconButton
                      icon={Trash2}
                      label="Remove condition"
                      size={11}
                      onClick={() =>
                        writeConditions(conditions.filter((_, i) => i !== conditionIndex))
                      }
                    />
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <TextField
                    label="Left"
                    value={asText(condition.a)}
                    placeholder="{{role}}"
                    onChange={(event) =>
                      writeConditions(
                        conditions.map((entry, i) =>
                          i === conditionIndex ? { ...entry, a: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                  <TextField
                    label={fn === "in" ? "In list" : "Right"}
                    value={asText(condition.b)}
                    placeholder={fn === "in" ? "a,b,c" : "member"}
                    onChange={(event) =>
                      writeConditions(
                        conditions.map((entry, i) =>
                          i === conditionIndex ? { ...entry, b: event.target.value } : entry,
                        ),
                      )
                    }
                  />
                </div>

                <Checkbox
                  label="Loose comparison (==)"
                  checked={condition.loose === true}
                  onChange={(loose) =>
                    writeConditions(
                      conditions.map((entry, i) =>
                        i === conditionIndex ? { ...entry, loose } : entry,
                      ),
                    )
                  }
                />
              </div>
            ))}

            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => writeConditions([...conditions, { a: "", b: "", loose: false }])}
            >
              Add condition
            </Button>
          </div>
        </>
      );
    }

    const fields = CONFIG_FIELDS[step.type] ?? [];

    return (
      <>
        {fields.map((field) => {
          const value = asText(config[field.key]);

          return field.textarea ? (
            <TextArea
              key={field.key}
              label={field.label}
              rows={3}
              value={value}
              placeholder={field.placeholder}
              onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                patchConfig(index, { ...config, [field.key]: event.target.value })
              }
            />
          ) : (
            <TextField
              key={field.key}
              label={field.label}
              type={field.type ?? "text"}
              value={value}
              placeholder={field.placeholder}
              onChange={(event: ChangeEvent<HTMLInputElement>) =>
                patchConfig(index, { ...config, [field.key]: event.target.value })
              }
            />
          );
        })}
      </>
    );
  };

  return (
    <div className={nested ? "space-y-2" : "space-y-2.5"}>
      {depth > WARN_DEPTH && (
        <p className="flex items-start gap-1.5 rounded bg-warning/10 px-2 py-1.5 text-[11px] text-warning">
          <AlertTriangle size={12} className="mt-0.5 shrink-0" />
          Branches this deep may stop running — the server refuses to recurse past 10 levels.
        </p>
      )}

      {steps.length === 0 ? (
        <p
          className={`rounded-lg border border-dashed border-line px-3 text-center text-[11px] text-ink-faint ${
            nested ? "py-2" : "py-4"
          }`}
        >
          {nested ? "No steps in this branch — it runs nothing." : "No steps yet."}
        </p>
      ) : (
        <ol className={nested ? "space-y-2" : "space-y-2.5"}>
          {steps.map((step, index) => (
            <li
              key={step._id ?? `${depth}-${index}`}
              className="rounded-lg border border-line-soft bg-chrome"
            >
              <div className="flex items-center gap-1 border-b border-line-soft px-2 py-1.5">
                {nested && <CornerDownRight size={11} className="shrink-0 text-ink-faint" />}
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-blurple/20 text-[10px] font-bold text-blurple-300">
                  {index + 1}
                </span>
                <span className="truncate text-[11px] font-semibold text-ink">
                  {labelFor(step.type)}
                </span>

                <span className="ml-auto flex items-center">
                  <IconButton
                    icon={ChevronUp}
                    label="Move step up"
                    size={12}
                    disabled={index === 0}
                    onClick={() => move(index, -1)}
                  />
                  <IconButton
                    icon={ChevronDown}
                    label="Move step down"
                    size={12}
                    disabled={index === steps.length - 1}
                    onClick={() => move(index, 1)}
                  />
                  <IconButton
                    icon={Trash2}
                    label="Remove step"
                    size={12}
                    onClick={() => remove(index)}
                  />
                </span>
              </div>

              <div className="space-y-2.5 p-2.5">
                <Select
                  label="Action"
                  value={step.type}
                  onChange={(event) => changeType(index, event.target.value)}
                  options={typeOptions}
                />

                {renderFields(index, step)}

                {step.type === CHECK_KEY && (
                  <div className="space-y-2 pt-1">
                    <BranchEditor
                      label="Then — condition passed"
                      steps={readBranch(step.config ?? {}, "then")}
                      depth={depth + 1}
                      onChange={(branch) =>
                        patchConfig(index, { ...(step.config ?? {}), then: branch })
                      }
                    />
                    <BranchEditor
                      label="Else — condition failed"
                      steps={readBranch(step.config ?? {}, "else")}
                      depth={depth + 1}
                      onChange={(branch) =>
                        patchConfig(index, { ...(step.config ?? {}), else: branch })
                      }
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="flex items-end gap-2">
        <Select
          className="flex-1"
          label={nested ? "Add to this branch" : "Add a step"}
          value={addingType}
          onChange={(event) => setAddingType(event.target.value)}
          options={typeOptions}
        />
        <Button
          size="sm"
          icon={Plus}
          onClick={() => onChange([...steps, createStep(addingType as FlowStep["type"])])}
        >
          Add
        </Button>
      </div>
    </div>
  );
};

/** A labelled, collapsible sub-list. Thin wrapper so the two branches look alike. */
const BranchEditor = ({
  label,
  steps,
  depth,
  onChange,
}: {
  label: string;
  steps: FlowStep[];
  depth: number;
  onChange: (steps: FlowStep[]) => void;
}) => {
  const [open, setOpen] = useState(true);

  return (
    <div className="rounded-md border border-line-soft bg-raised/30">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wide text-ink-muted transition-colors hover:text-ink"
      >
        {open ? <ChevronDown size={11} /> : <ChevronUp size={11} />}
        {label}
        <span className="ml-auto font-normal normal-case text-ink-faint">
          {steps.length} step{steps.length === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="border-t border-line-soft p-2">
          <StepList steps={steps} onChange={onChange} depth={depth} />
        </div>
      )}
    </div>
  );
};

export default StepList;
