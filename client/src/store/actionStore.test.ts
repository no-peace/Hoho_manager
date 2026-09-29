import { beforeEach, describe, expect, it } from "vitest";
import type { FlowStep } from "@dmb/shared";
import { createStep, useActionStore } from "./actionStore";

/**
 * Flow serialisation.
 *
 * A `check` step keeps its branches inside its own config, so the wire format is
 * a tree living in a flat `action_definitions` row. Two things can go wrong
 * quietly there: editor-only `_id`s leak into the database, and nested steps get
 * dropped because a shallow map never looked inside `config.then` / `config.else`.
 * Both are pinned here.
 */

const stopStep = (content: string): FlowStep => {
  const step = createStep("stop");
  return { ...step, config: { ...step.config, content } };
};

const checkStep = (then: FlowStep[], elseSteps: FlowStep[]): FlowStep => {
  const step = createStep("check");
  return { ...step, config: { ...step.config, then, else: elseSteps } };
};

beforeEach(() => {
  useActionStore.getState().reset();
});

describe("createStep defaults", () => {
  it("gives a check step empty branches so it persists a branchable shape", () => {
    const step = createStep("check");
    expect(step.config.then).toEqual([]);
    expect(step.config.else).toEqual([]);
    expect(step.config.function).toBe("equals");
  });

  it("gives a set_variable step a static mode", () => {
    expect(createStep("set_variable").config.varType).toBe("static");
  });

  it("gives a stop step an empty content field", () => {
    expect(createStep("stop").config).toEqual({ content: "" });
  });
});

describe("toRegistrations — nested branches", () => {
  it("keeps branch steps and drops every editor id, at every depth", () => {
    const inner = checkStep([stopStep("inner-then")], [stopStep("inner-else")]);
    const outer = checkStep([inner], [stopStep("outer-else")]);

    useActionStore.getState().setFlow("action:check", [outer]);

    const [registration] = useActionStore.getState().toRegistrations();
    expect(registration).toBeDefined();

    // Nothing editor-only survived, at the top level or inside the branches.
    expect(JSON.stringify(registration)).not.toContain("_id");

    const top = registration!.steps[0]!;
    expect(top.type).toBe("check");

    const thenBranch = top.config.then as FlowStep[];
    expect(thenBranch).toHaveLength(1);
    expect(thenBranch[0]!.type).toBe("check");
    expect(thenBranch[0]!.config.else).toEqual([{ type: "stop", config: { content: "inner-else" } }]);
  });

  it("normalises a hand-edited branch that is not an array to an empty one", () => {
    const damaged: FlowStep = {
      type: "check",
      config: { function: "equals", conditions: [], then: "nope", else: null },
    };

    useActionStore.getState().setFlow("action:check", [damaged]);
    const [registration] = useActionStore.getState().toRegistrations();

    expect(registration!.steps[0]!.config.then).toEqual([]);
    expect(registration!.steps[0]!.config.else).toEqual([]);
  });
});

describe("loadFromList / toList round trip", () => {
  it("restores a nested flow and re-serialises it identically", () => {
    const original = checkStep([stopStep("yes")], [stopStep("no")]);
    useActionStore.getState().setFlow("action:check", [original]);

    // What a template save would write, then read back on load.
    const stored = useActionStore.getState().toList();
    useActionStore.getState().reset();
    useActionStore.getState().loadFromList(stored);

    const reloaded = useActionStore.getState().getFlow("action:check");
    expect(reloaded).toHaveLength(1);
    // The editor needs ids again for React keys and reordering.
    expect(reloaded[0]!._id).toBeTruthy();

    expect(useActionStore.getState().toList()).toEqual(stored);
  });
});
