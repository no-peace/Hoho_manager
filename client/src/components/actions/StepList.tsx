import { useMemo, useState, useEffect } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Shield,
} from "lucide-react";
import { AdaptiveFields, SetVariableModes } from "@dmb/shared";
import type { ActionConfig, FlowStep } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, Select, TextArea, TextField } from "../ui/Field";
import { createStep, useActionStore } from "../../store/actionStore";
import { useGlobalStore } from "../../store/globalStore";

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

export const DiscordModalPreview = ({
  title,
  inputs,
}: {
  title: string;
  inputs: ModalInputField[];
}) => {
  return (
    <div className="rounded-lg bg-[#313338] border border-[#1e1f22] overflow-hidden shadow-xl font-sans w-full my-2">
      <div className="bg-[#2b2d31] px-4 py-3 border-b border-[#1e1f22] flex items-center justify-between">
        <h4 className="text-sm font-bold text-white truncate">
          {title || "Modal Preview"}
        </h4>
        <span className="text-xs text-[#949ba4] font-semibold cursor-default">✕</span>
      </div>

      <div className="p-4 space-y-3 bg-[#313338]">
        {inputs.length === 0 ? (
          <p className="text-xs text-[#949ba4] text-center py-3">No input fields added yet</p>
        ) : (
          inputs.map((inp, idx) => (
            <div key={idx} className="space-y-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#b5bac1]">
                {inp.label || `Question ${idx + 1}`}
                {inp.required !== false && <span className="text-[#da373c] ml-1">*</span>}
              </label>
              {inp.style === 2 ? (
                <div className="min-h-[60px] rounded bg-[#1e1f22] border border-[#111214] p-2 text-xs text-[#949ba4] select-none">
                  {inp.placeholder || "Paragraph response..."}
                </div>
              ) : (
                <div className="h-8 rounded bg-[#1e1f22] border border-[#111214] px-2.5 flex items-center text-xs text-[#949ba4] select-none">
                  {inp.placeholder || "Short answer..."}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="bg-[#2b2d31] px-4 py-2.5 flex items-center justify-end gap-2 border-t border-[#1e1f22]">
        <span className="text-xs text-[#dbdee1] px-2.5 py-1">Cancel</span>
        <button
          type="button"
          className="bg-[#5865f2] text-white text-xs font-semibold px-3.5 py-1 rounded shadow-sm"
        >
          Submit
        </button>
      </div>
    </div>
  );
};

export const RoleSelect: React.FC<{
  guildId: string | null;
  value: string;
  onChange: (val: string) => void;
}> = ({ guildId, value, onChange }) => {
  const [roles, setRoles] = useState<Array<{ id: string; name: string; color: number }>>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!guildId) return;
    let cancelled = false;
    setLoading(true);
    import("../../api/client").then(({ api }) => {
      api.discord.roles(guildId)
        .then((res) => {
          if (!cancelled && res?.roles) setRoles(res.roles);
        })
        .catch(() => {})
        .finally(() => {
          if (!cancelled) setLoading(false);
        });
    });
    return () => { cancelled = true; };
  }, [guildId]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-[#dbdee1]">Discord Role</label>
        {loading && <span className="text-[10px] text-[#5865f2] animate-pulse">Loading roles...</span>}
      </div>
      {roles.length > 0 && (
        <Select
          label="Server Role"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          options={[
            { value: "", label: "-- Select a role --" },
            ...roles.map((r) => ({ value: r.id, label: `@${r.name}` })),
          ]}
        />
      )}
      <TextField
        label={roles.length > 0 ? "Or enter Role ID manually" : "Role ID"}
        value={value}
        placeholder="123456789012345678"
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
};

export interface StepListProps {
  steps: FlowStep[];
  onChange: (steps: FlowStep[]) => void;
  depth: number;
}

export const StepList = ({ steps, onChange, depth }: StepListProps) => {
  const [addingType, setAddingType] = useState<string>("add_role");
  const nested = depth > 0;
  const selectedGuildId = useGlobalStore((state) => state.selectedGuildId);

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

      const moveInput = (idx: number, delta: number) => {
        const target = idx + delta;
        if (target < 0 || target >= inputFields.length) return;
        const next = [...inputFields];
        const [removed] = next.splice(idx, 1);
        next.splice(target, 0, removed);
        updateInputs(next);
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

          {/* Discord Modal Live Preview Mockup */}
          <div className="pt-1">
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#949ba4] block mb-1">
              Live Modal Mockup
            </span>
            <DiscordModalPreview
              title={asText(config.title) || "Application Form"}
              inputs={inputFields}
            />
          </div>

          <div className="pt-2 pb-1">
            <BranchEditor
              label="When Modal is Submitted (Then)"
              steps={Array.isArray(config.then) ? config.then : []}
              depth={depth + 1}
              onChange={(nextThen) => patchConfig(index, { ...config, then: nextThen })}
            />
          </div>

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
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          disabled={fieldIdx === 0}
                          onClick={() => moveInput(fieldIdx, -1)}
                          className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-20 transition-colors"
                          title="Move Question Up"
                        >
                          <ChevronUp size={13} />
                        </button>
                        <button
                          type="button"
                          disabled={fieldIdx === inputFields.length - 1}
                          onClick={() => moveInput(fieldIdx, 1)}
                          className="p-1 rounded text-[#949ba4] hover:text-white hover:bg-[#35373c] disabled:opacity-20 transition-colors"
                          title="Move Question Down"
                        >
                          <ChevronDown size={13} />
                        </button>
                        <span className="text-[11px] font-bold text-[#b5bac1] ml-1">
                          #{fieldIdx + 1}
                        </span>
                      </div>
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

                    {/* Character Limits */}
                    <div className="grid grid-cols-2 gap-2">
                      <TextField
                        label="Min Length (0 - 4000)"
                        type="number"
                        value={input.minLength !== undefined ? String(input.minLength) : ""}
                        placeholder="0"
                        onChange={(e) =>
                          patchInput(fieldIdx, {
                            minLength: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                      <TextField
                        label="Max Length (1 - 4000)"
                        type="number"
                        value={input.maxLength !== undefined ? String(input.maxLength) : ""}
                        placeholder="4000"
                        onChange={(e) =>
                          patchInput(fieldIdx, {
                            maxLength: e.target.value === "" ? undefined : Number(e.target.value),
                          })
                        }
                      />
                    </div>

                    {/* Variable Syntax Helper Pills */}
                    <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-[#2b2d31]">
                      <span className="text-[10px] text-[#949ba4]">Variable:</span>
                      <span
                        className="text-[10px] font-mono bg-[#111214] text-[#5865f2] px-1.5 py-0.5 rounded border border-[#5865f2]/40"
                        title="Direct variable"
                      >
                        {"{{"}{input.customId}{"}}"}
                      </span>
                      <span
                        className="text-[10px] font-mono bg-[#111214] text-[#949ba4] px-1.5 py-0.5 rounded border border-[#35373c]"
                        title="Scoped variable"
                      >
                        {"{{"}input.{input.customId}{"}}"}
                      </span>
                    </div>

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
      const isMemberHasRole = config.checkType === "member_has_role" || config.function === "member_has_role";
      const roleMode = asText(config.roleMode || config.mode) || "static";
      const roleId = asText(config.roleId || config.role || config.value);
      const target = asText(config.target) || "member";

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
          {/* Check Type Toggle */}
          <div className="flex items-center gap-1 bg-[#1e1f22] p-1 rounded border border-[#111214]">
            <button
              type="button"
              onClick={() => patchConfig(index, { ...config, checkType: "member_has_role", function: "member_has_role" })}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                isMemberHasRole ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
              }`}
            >
              <Shield size={13} /> Member has role
            </button>
            <button
              type="button"
              onClick={() => {
                const next = { ...config };
                delete next.checkType;
                if (next.function === "member_has_role") delete next.function;
                patchConfig(index, next);
              }}
              className={`flex-1 py-1 px-2 rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 ${
                !isMemberHasRole ? "bg-[#5865f2] text-white" : "text-[#949ba4] hover:text-white"
              }`}
            >
              Comparison (A == B)
            </button>
          </div>

          {isMemberHasRole ? (
            <div className="space-y-3 bg-[#1e1f22] p-3 rounded-lg border border-[#2b2d31]">
              <div className="grid grid-cols-2 gap-2">
                <Select
                  label="Target Member"
                  value={target}
                  onChange={(e) => patchConfig(index, { ...config, target: e.target.value })}
                  options={[
                    { value: "member", label: "Triggering User (Clicker)" },
                    { value: "selected_member", label: "Selected User / Context" },
                  ]}
                />
                <Select
                  label="Role Selection Mode"
                  value={roleMode}
                  onChange={(e) => patchConfig(index, { ...config, roleMode: e.target.value, mode: e.target.value })}
                  options={[
                    { value: "static", label: "Static (Guild Role / ID)" },
                    { value: "adaptive", label: "Adaptive ({variable})" },
                    { value: "mirror", label: "Mirror / Get (from user)" },
                  ]}
                />
              </div>

              {roleMode === "static" ? (
                <RoleSelect
                  guildId={selectedGuildId}
                  value={roleId}
                  onChange={(val) => patchConfig(index, { ...config, roleId: val, role: val, value: val })}
                />
              ) : roleMode === "adaptive" ? (
                <TextField
                  label="Role Variable (Adaptive)"
                  value={roleId}
                  placeholder="selected_role or {target_role_id}"
                  hint="Reads role ID dynamically from flow variable"
                  onChange={(e) => patchConfig(index, { ...config, roleId: e.target.value, role: e.target.value, value: e.target.value })}
                />
              ) : (
                <TextField
                  label="Mirror Source Variable"
                  value={roleId}
                  placeholder="author.roles or target.role_id"
                  hint="Mirrors role from external context or variable"
                  onChange={(e) => patchConfig(index, { ...config, roleId: e.target.value, role: e.target.value, value: e.target.value })}
                />
              )}
            </div>
          ) : (
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
          )}

          <BranchEditor
            label={isMemberHasRole ? "Has Role (Then)" : "Condition Passed (Then)"}
            steps={passSteps}
            depth={depth + 1}
            onChange={(nextPass) => patchConfig(index, { ...config, pass: nextPass, then: nextPass })}
          />

          <BranchEditor
            label={isMemberHasRole ? "Does Not Have Role (Else)" : "Condition Failed (Else)"}
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