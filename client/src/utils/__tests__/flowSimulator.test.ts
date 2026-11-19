import { describe, expect, it } from "vitest";
import type { FlowStep } from "@dmb/shared";
import { simulateFlow } from "../flowSimulator";

describe("simulateFlow", () => {
  it("runs the matching check branch and simulates role changes", () => {
    const steps: FlowStep[] = [
      { type: "check", config: { left: "{user.username}", op: "==", right: "DemoUser", then: [
        { type: "add_role", config: { roleId: "verified" } },
      ], else: [
        { type: "send_ephemeral_reply", config: { content: "Not verified" } },
      ] } },
    ];
    const result = simulateFlow(steps);
    expect(result.trace[0]?.status).toBe("branch_then");
    expect(result.heldRoleIds).toContain("verified");
    expect(result.trace).toHaveLength(2);
  });

  it("interpolates modal values and records simulated messages", () => {
    const steps: FlowStep[] = [
      { type: "open_modal", config: { components: [{ type: 18, component: { custom_id: "reason" } }], then: [
        { type: "send_ephemeral_reply", config: { content: "Received {modal.reason}" } },
      ] } },
    ];
    const result = simulateFlow(steps, { modalInputs: { reason: "Need help" } });
    expect(result.trace[0]?.status).toBe("modal");
    expect(result.trace[1]?.previewMessage?.content).toBe("Received Need help");
  });

  it("records ephemeral and direct-message outputs in the trace", () => {
    const result = simulateFlow([
      { type: "send_ephemeral_reply", config: { content: "Private response" } },
      { type: "send_dm", config: { content: "Hello {user.username}" } },
    ], { username: "FlowTester" });

    expect(result.trace[0]?.previewMessage).toEqual({
      kind: "ephemeral",
      content: "Private response",
    });
    expect(result.trace[1]?.previewMessage).toEqual({
      kind: "dm",
      content: "Hello FlowTester",
    });
  });

  it("stops execution after a stop step", () => {
    const result = simulateFlow([
      { type: "stop", config: { content: "Done" } },
      { type: "send_dm", config: { content: "Should not run" } },
    ]);
    expect(result.stopped).toBe(true);
    expect(result.trace).toHaveLength(1);
  });
});
