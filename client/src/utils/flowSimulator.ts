import type { ActionConfig, FlowStep } from "@dmb/shared";

export interface FlowSimulationContext {
  username?: string;
  userId?: string;
  serverName?: string;
  serverId?: string;
  heldRoleIds?: string[];
  modalInputs?: Record<string, string | string[] | boolean>;
  selectedValues?: string[];
}

export interface FlowSimulationTraceEntry {
  stepIndex: number;
  type: string;
  status: "executed" | "branch_then" | "branch_else" | "stopped" | "modal";
  summary: string;
  previewMessage?: {
    kind: "ephemeral" | "dm" | "channel";
    content: string;
  };
}

export interface FlowSimulationResult {
  trace: FlowSimulationTraceEntry[];
  variables: Record<string, string>;
  heldRoleIds: string[];
  stopped: boolean;
}

const asText = (value: unknown): string =>
  value == null ? "" : typeof value === "string" ? value : String(value);

const interpolate = (
  value: unknown,
  context: FlowSimulationContext,
  variables: Record<string, string>,
): string => {
  const input = asText(value);
  return input.replace(/\{(user|server|modal)\.([^}]+)\}/g, (_match, scope: string, key: string) => {
    if (scope === "user") {
      if (key === "username" || key === "name") return context.username ?? "DemoUser";
      if (key === "id") return context.userId ?? "123456789012345678";
    }
    if (scope === "server") {
      if (key === "name") return context.serverName ?? "Example Server";
      if (key === "id") return context.serverId ?? "987654321098765432";
    }
    if (scope === "modal") return asText(context.modalInputs?.[key] ?? variables[`modal.${key}`]);
    return variables[`${scope}.${key}`] ?? "";
  });
};

const readSteps = (value: unknown): FlowStep[] =>
  Array.isArray(value) ? value.filter((step): step is FlowStep =>
    Boolean(step && typeof step === "object" && typeof step.type === "string")) : [];

const compare = (left: string, operator: string, right: string): boolean => {
  switch (operator) {
    case "!=": return left !== right;
    case ">": return Number(left) > Number(right);
    case ">=": return Number(left) >= Number(right);
    case "<": return Number(left) < Number(right);
    case "<=": return Number(left) <= Number(right);
    case "includes": return left.includes(right);
    case "starts_with": return left.startsWith(right);
    case "ends_with": return left.endsWith(right);
    case "is_empty": return left.length === 0;
    case "is_not_empty": return left.length > 0;
    default: return left === right;
  }
};

export const simulateFlow = (
  steps: FlowStep[],
  context: FlowSimulationContext = {},
): FlowSimulationResult => {
  const trace: FlowSimulationTraceEntry[] = [];
  const variables: Record<string, string> = {};
  const heldRoleIds = new Set(context.heldRoleIds ?? []);
  let stepIndex = 0;
  let stopped = false;

  const run = (list: FlowStep[]): void => {
    for (const step of list) {
      if (stopped) return;
      const index = stepIndex++;
      const config = (step.config ?? {}) as ActionConfig;
      const text = (key: string) => interpolate(config[key], context, variables);

      if (step.type === "stop") {
        trace.push({ stepIndex: index, type: step.type, status: "stopped", summary: text("content") || "Flow stopped." });
        stopped = true;
        return;
      }

      if (step.type === "check") {
        const roleCheck = config.checkType === "member_has_role" || config.function === "member_has_role";
        let passed: boolean;
        if (roleCheck) {
          const roleId = text("roleId") || text("role") || text("value");
          passed = heldRoleIds.has(roleId);
        } else {
          passed = compare(text("left"), asText(config.op ?? config.operator ?? "=="), text("right"));
        }
        trace.push({
          stepIndex: index,
          type: step.type,
          status: passed ? "branch_then" : "branch_else",
          summary: passed ? "Condition passed; running Then branch." : "Condition failed; running Else branch.",
        });
        run(readSteps(passed ? config.pass ?? config.then : config.fail ?? config.else));
        continue;
      }

      if (step.type === "set_variable") {
        const name = text("name") || text("variable");
        const mode = asText(config.varType ?? "static");
        const value = mode === "get"
          ? variables[text("value")] ?? ""
          : mode === "adaptive"
            ? variables[text("value")] ?? text("value")
            : text("value");
        if (name) variables[name] = value;
        trace.push({ stepIndex: index, type: step.type, status: "executed", summary: name ? `Set { ${name} } = ${value || "(empty)"}` : "Skipped: variable name is empty." });
        continue;
      }

      if (step.type === "open_modal") {
        const modalFields = Array.isArray(config.components) ? config.components : [];
        const modalSummary = modalFields.length
          ? `Simulated modal submission with ${modalFields.length} field(s).`
          : "Simulated modal opened; no configured fields were found.";
        Object.entries(context.modalInputs ?? {}).forEach(([key, value]) => {
          variables[`modal.${key}`] = Array.isArray(value) ? value.join(", ") : String(value);
        });
        trace.push({ stepIndex: index, type: step.type, status: "modal", summary: modalSummary });
        run(readSteps(config.then));
        continue;
      }

      if (step.type === "add_role" || step.type === "remove_role" || step.type === "toggle_role") {
        const roleId = text("roleId") || text("role");
        if (roleId) {
          if (step.type === "add_role") heldRoleIds.add(roleId);
          else if (step.type === "remove_role") heldRoleIds.delete(roleId);
          else if (heldRoleIds.has(roleId)) heldRoleIds.delete(roleId);
          else heldRoleIds.add(roleId);
        }
        trace.push({ stepIndex: index, type: step.type, status: "executed", summary: roleId ? `${step.type.replace(/_/g, " ")} · ${roleId}` : "Skipped: role ID is empty." });
        continue;
      }

      if (step.type === "send_ephemeral_reply" || step.type === "send_dm" || step.type === "send_message") {
        const kind = step.type === "send_ephemeral_reply" ? "ephemeral" : step.type === "send_dm" ? "dm" : "channel";
        const content = text("content");
        trace.push({
          stepIndex: index,
          type: step.type,
          status: "executed",
          summary: kind === "ephemeral" ? "Simulated ephemeral reply." : kind === "dm" ? "Simulated direct message." : `Simulated channel message${text("channelId") ? ` to ${text("channelId")}` : ""}.`,
          previewMessage: { kind, content },
        });
        continue;
      }

      trace.push({ stepIndex: index, type: step.type, status: "executed", summary: `Simulated ${step.type.replace(/_/g, " ")}.` });
    }
  };

  run(steps);
  return { trace, variables, heldRoleIds: [...heldRoleIds], stopped };
};
