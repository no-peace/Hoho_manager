import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { AdaptiveFields, SetVariableModes } from "@dmb/shared";
import type { ActionConfig, FlowStep } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, Select, TextArea, TextField } from "../ui/Field";
import { createStep, useActionStore } from "../../store/actionStore";

interface ConfigField {
  key: string;
  label: string;
  placeholder?: string;
  textarea?: boolean;
  type?: string;
}

const CONFIG_FIELDS: Record<string, readonly ConfigField[]> = {
  dud: [],
  add_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  remove_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  toggle_role: [{ key: "roleId", label: "Role ID", placeholder: "123456789012345678" }],
  send_ephemeral_reply: [{ key: "content", label: "Reply text", textarea: true }],
  send_dm: [{ key: "content", label: "DM text", textarea: true }],
  send_message: [
    { key: "channelId", label: "Channel ID (defaults to current channel)", placeholder: "123456789012345678" },
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
const OPEN_MODAL_KEY = "open_modal";

const asText = (value: unknown): string =>
  typeof value === "string" ? value : value == null ? "" : String(value);

export interface ModalInputField {
  customId: string;
  label: string;
  style: number; // 1: Short, 2: Paragraph
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  maxLength?: number;
}

const parseModalComponents = (components: unknown): ModalInputField[] => {
  if (!Array.isArray(components)) return [];

  const fields: ModalInputField[] = [];
  for (const row of components) {
    if (row && typeof row === "object" && Array.isArray((row as any).components)) {
      for (const input of (row as any).components) {
        if (input && typeof input === "object") {
          fields.push({
            customId: input.custom_id || input.customId || `input_${fields.length + 1}`,
            label: input.label || "Question",
            style: Number(input.style) === 2 ? 2 : 1,
            placeholder: input.placeholder || "",
            required: input.required !== false,
            minLength: typeof input.min_length === "number" ? input.min_length : undefined,
            maxLength: typeof input.max_length === "number" ? input.max_length : undefined,
          });
        }
      }
    }
  }
  return fields;
};

const formatModalComponents = (fields: ModalInputField[]) => {
  return fields.slice(0, 5).map((field) => ({
    type: 1, // ActionRow
    components: [
      {
        type: 4, // TextInput
        custom_id: field.customId.trim() || `input_${Date.now()}`,
        label: field.label.trim() || "Question",
        style: field.style === 2 ? 2 : 1,
        placeholder: field.placeholder?.trim() || undefined,
        required: field.required !== false,
        min_length: field.minLength,
        max_length: field.maxLength,
      },
    ],
  }));
};

export interface StepListProps {
  steps: FlowStep[];
  onChange: (steps: FlowStep[]) => void;
  depth: number;
}

export const StepList = ({ steps, onChange, depth }: StepListProps) => {
  const [addingType, setAddingType] = useState<string>("add_role");
  const nested = depth > 0;

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

  const remove = (index: number): void => {
    onChange(steps.filter((_, i) => i !== index));
  };

  const changeType = (index: number, type: string): void => {
    const step = steps[index];
    if (!step) return;
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

    if (step.type === OPEN_MODAL_KEY) {
      const inputFields = parseModalComponents(config.components);

      const updateInputs = (nextInputs: ModalInputField[]) => {
        patchConfig(index, {
          ...config,
          components: formatModalComponents(nextInputs),
        });
      };

      const addInput = () => {
        if (inputFields.length >= 5) return;
        updateInputs([
          ...inputFields,
          {
            customId: `field_${inputFields.length + 1}`,
            label: `Question ${inputFields.length + 1}`,
            style: 1,
            placeholder: "",
            required: true,
          },
        ]);
      };

      const patchInput = (i: number, patchData: Partial<ModalInputField>) => {
        const next = [...inputFields];
        next[i] = { ...next[i], ...patchData };
        updateInputs(next);
      };

      const removeInput = (i: number) => {
        updateInputs(inputFields.filter((_, idx) => idx !== i));
      };

      return (
        <div className="space-y-3">
          <TextField
            label="Modal Title"
            value={asText(config.title)}
            placeholder="Application Form"
            onChange={(e) => patchConfig(index, { ...config, title: e.target.value })}
          />
          <TextField
            label="Modal Custom ID"
            value={asText(config.customId)}
            placeholder="app_modal"
            onChange={(e) => patchConfig(index, { ...config, customId: e.target.value })}
          />

          <div className="space-y-2 pt-1 border-t border-[#1e1f22]">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-[#b5bac1]">
                Form Inputs ({inputFields.length}/5)
              </span>
              {inputFields.length < 5 && (
                <Button size="sm" icon={Plus} onClick={addInput}>
                  Add Input
                </Button>
              )}
            </div>

            {inputFields.length === 0 ? (
              <p className="text-[11px] text-[#949ba4] py-2">
                Click &ldquo;Add Input&rdquo; to add a text question to this modal (up to 5 inputs).
              </p>
            ) : (
              <div className="space-y-2">
                {inputFields.map((input, fieldIdx) => (
                  <div
                    key={fieldIdx}
                    className="p-2.5 rounded bg-[#1e1f22]/70 border border-[#2b2d31] space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1">
                        <TextField
                          label="Field Label"
                          value={input.label}
                          placeholder="e.g. Why should we accept you?"
                          onChange={(e) => patchInput(fieldIdx, { label: e.target.value })}
                        />
                      </div>
                      <IconButton
                        icon={Trash2}
                        label="Delete input"
                        onClick={() => removeInput(fieldIdx)}
                        className="text-[#f28b8b] hover:bg-[#da373c]/10 mt-4"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        label="Variable Key (custom_id)"
                        value={input.customId}
                        placeholder="reason"
                        onChange={(e) => patchInput(fieldIdx, { customId: e.target.value })}
                      />
                      <Select
                        label="Input Style"
                        value={String(input.style)}
                        onChange={(e) => patchInput(fieldIdx, { style: Number(e.target.value) })}
                        options={[
                          { value: "1", label: "Short (Single Line)" },
                          { value: "2", label: "Paragraph (Multi-line)" },
                        ]}
                      />
                    </div>

                    <TextField
                      label="Placeholder (optional)"
                      value={input.placeholder ?? ""}
                      placeholder="Type your answer here..."
                      onChange={(e) => patchInput(fieldIdx, { placeholder: e.target.value })}
                    />

                    <Checkbox
                      label="Required"
                      checked={input.required !== false}
                      onChange={(required) => patchInput(fieldIdx, { required })}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (step.type === CHECK_KEY) {
      const left = asText(config.left);
      const op = asText(config.op || config.operator) || "==";
      const right = asText(config.right);

      const passSteps = Array.isArray(config.pass)
        ? config.pass
        : Array.isArray(config.then)
          ? config.then
          : [];
      const failSteps = Array.isArray(config.fail)
        ? config.fail
        : Array.isArray(config.else)
          ? config.else
          : [];

      return (
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-2">
            <TextField
              label="Left side"
              value={left}
              placeholder="{user.id}"
              onChange={(e) => patchConfig(index, { ...config, left: e.target.value })}
            />
            <Select
              label="Condition"
              value={op}
              onChange={(e) => patchConfig(index, { ...config, op: e.target.value, operator: e.target.value })}
              options={[
                { value: "==", label: "equals (==)" },
                { value: "!=", label: "not equals (!=)" },
                { value: ">", label: "greater than (>)" },
                { value: ">=", label: "greater or equal (>=)" },
                { value: "<", label: "less than (<)" },
                { value: "<=", label: "less or equal (<=)" },
                { value: "includes", label: "includes" },
                { value: "starts_with", label: "starts with" },
                { value: "ends_with", label: "ends with" },
                { value: "is_empty", label: "is empty" },
                { value: "is_not_empty", label: "is not empty" },
              ]}
            />
            <TextField
              label="Right side"
              value={right}
              placeholder="123456789"
              onChange={(e) => patchConfig(index, { ...config, right: e.target.value })}
            />
          </div>

          <BranchEditor
            label="Condition Passed (Then)"
            steps={passSteps}
            depth={depth + 1}
            onChange={(nextPass) => patchConfig(index, { ...config, pass: nextPass, then: nextPass })}
          />

          <BranchEditor
            label="Condition Failed (Else)"
            steps={failSteps}
            depth={depth + 1}
            onChange={(nextFail) => patchConfig(index, { ...config, fail: nextFail, else: nextFail })}
          />
        </div>
      );
    }

    const fields = CONFIG_FIELDS[step.type] ?? [];
    return (
      <>
        {fields.map((field) =>
          field.textarea ? (
            <TextArea
              key={field.key}
              label={field.label}
              value={asText(config[field.key])}
              placeholder={field.placeholder}
              onChange={(event) =>
                patchConfig(index, { ...config, [field.key]: event.target.value })
              }
            />
          ) : (
            <TextField
              key={field.key}
              label={field.label}
              type={field.type}
              value={asText(config[field.key])}
              placeholder={field.placeholder}
              onChange={(event) =>
                patchConfig(index, { ...config, [field.key]: event.target.value })
              }
            />
          ),
        )}
      </>
    );
  };

  return (
    <div className="space-y-2">
      {steps.map((step, index) => (
        <div
          key={step._id || index}
          className="rounded border border-[#1e1f22] bg-[#2b2d31] p-3 space-y-2.5 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2 border-b border-[#1e1f22] pb-2">
            <Select
              className="flex-1 max-w-[220px]"
              value={step.type}
              onChange={(event) => changeType(index, event.target.value)}
              options={typeOptions}
            />
            <div className="flex items-center gap-1">
              <IconButton
                icon={Trash2}
                label="Delete step"
                onClick={() => remove(index)}
                className="text-[#f28b8b] hover:bg-[#da373c]/10"
              />
            </div>
          </div>

          <div className="space-y-2 pt-1">{renderFields(index, step)}</div>
        </div>
      ))}

      <div className="flex items-end gap-2 pt-1">
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
    <div className="rounded-md border border-[#1e1f22] bg-[#1e1f22]/40">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1 px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-[#b5bac1] transition-colors hover:text-white"
      >
        {open ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
        {label}
        <span className="ml-auto font-normal normal-case text-[#949ba4]">
          {steps.length} step{steps.length === 1 ? "" : "s"}
        </span>
      </button>

      {open && (
        <div className="border-t border-[#1e1f22] p-2.5">
          <StepList steps={steps} onChange={onChange} depth={depth} />
        </div>
      )}
    </div>
  );
};

export default StepList;