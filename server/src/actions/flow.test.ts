import { describe, expect, it } from "vitest";
import { InteractionResponseType, MessageFlags } from "@dmb/shared";
import type { ActionConfig, DiscordInteraction } from "@dmb/shared";
import type { ActionContext } from "./types.js";
import { evaluateCheck } from "./check.js";
import * as check from "./check.js";
import * as setVariable from "./setVariable.js";
import * as stop from "./stop.js";

/**
 * Flow parity with Discohook: `check` branching, `stop`, and the three
 * `set_variable` modes.
 *
 * These are the parts of a flow a user builds in the editor, so their behaviour
 * is pinned here rather than only exercised through a live Discord click. The
 * condition evaluator and the variable writer are pure enough to test directly.
 */

const interaction = (overrides: Partial<DiscordInteraction> = {}): DiscordInteraction => ({
  id: "1",
  application_id: "app",
  type: 3,
  token: "tok",
  channel_id: "chan",
  guild_id: "guild",
  data: { custom_id: "action:dud", values: [] },
  member: { user: { id: "user-1", username: "ada", global_name: "Ada" } },
  ...overrides,
});

/** A context with only the fields these pure handlers actually read. */
const context = (
  config: ActionConfig,
  vars: Record<string, unknown> = {},
  overrides: Partial<DiscordInteraction> = {},
): ActionContext =>
  ({
    interaction: interaction(overrides),
    config,
    variables: vars,
  }) as unknown as ActionContext;

const eq = (a: unknown, b: unknown, loose = false) => ({
  function: "equals",
  conditions: [{ a, b, loose }],
});

describe("evaluateCheck — equals", () => {
  it("compares literals strictly by default", () => {
    expect(evaluateCheck(eq("a", "a"), {})).toBe(true);
    expect(evaluateCheck(eq("a", "b"), {})).toBe(false);
    // 1 !== "1", which is the point of strict-by-default.
    expect(evaluateCheck(eq(1, "1"), {})).toBe(false);
  });

  it("uses loose equality only when asked", () => {
    expect(evaluateCheck(eq(1, "1", true), {})).toBe(true);
    expect(evaluateCheck(eq(0, false, true), {})).toBe(true);
    expect(evaluateCheck(eq(0, false), {})).toBe(false);
  });

  it("treats a half-built step as passing so it cannot silently halt a flow", () => {
    expect(evaluateCheck({ function: "equals", conditions: [] }, {})).toBe(true);
    expect(evaluateCheck({}, {})).toBe(true);
  });

  it("defaults to equals when no function is set", () => {
    expect(evaluateCheck({ conditions: [{ a: "x", b: "x" }] }, {})).toBe(true);
  });
});

describe("evaluateCheck — variable resolution", () => {
  it("resolves {{name}} from the variable bag", () => {
    expect(evaluateCheck(eq("{{role}}", "member"), { role: "member" })).toBe(true);
  });

  it("supports the single-brace syntax used by the editor", () => {
    expect(evaluateCheck(eq("{role}", "member"), { role: "member" })).toBe(true);
  });

  it("tolerates whitespace inside the braces", () => {
    expect(evaluateCheck(eq("{{  role  }}", "member"), { role: "member" })).toBe(true);
  });

  it("tolerates whitespace inside single-brace placeholders", () => {
    expect(evaluateCheck(eq("{  role  }", "member"), { role: "member" })).toBe(true);
  });

  it("resolves dotted paths", () => {
    expect(evaluateCheck(eq("{{result.channel_id}}", "99"), { result: { channel_id: "99" } })).toBe(
      true,
    );
  });

  it("yields undefined (not a throw) for a missing path", () => {
    expect(evaluateCheck(eq("{{result.channel_id}}", "99"), {})).toBe(false);
    expect(evaluateCheck(eq("{{a.b.c.d}}", "x"), { a: "scalar" })).toBe(false);
  });

  it("leaves a plain string alone when it is not a whole-value placeholder", () => {
    expect(evaluateCheck(eq("hello {{name}}", "hello {{name}}"), {})).toBe(true);
  });
});

describe("evaluateCheck — and / or / not / in", () => {
  it("`and` requires every condition", () => {
    const config = { function: "and", conditions: [{ a: "{{a}}", b: "1" }, { a: "{{b}}", b: "2" }] };
    expect(evaluateCheck(config, { a: "1", b: "2" })).toBe(true);
    expect(evaluateCheck(config, { a: "1", b: "9" })).toBe(false);
  });

  it("`or` requires any condition", () => {
    const config = { function: "or", conditions: [{ a: "{{a}}", b: "1" }, { a: "{{b}}", b: "2" }] };
    expect(evaluateCheck(config, { a: "no", b: "2" })).toBe(true);
    expect(evaluateCheck(config, { a: "no", b: "no" })).toBe(false);
  });

  it("`not` passes only when nothing matches", () => {
    const config = { function: "not", conditions: [{ a: "{{a}}", b: "1" }] };
    expect(evaluateCheck(config, { a: "no" })).toBe(true);
    expect(evaluateCheck(config, { a: "1" })).toBe(false);
  });

  it("`in` matches an array container", () => {
    const config = { function: "in", conditions: [{ a: "{{pick}}", b: "{{list}}" }] };
    expect(evaluateCheck(config, { pick: "b", list: ["a", "b", "c"] })).toBe(true);
    expect(evaluateCheck(config, { pick: "z", list: ["a", "b", "c"] })).toBe(false);
  });

  it("`in` matches a comma-separated string container", () => {
    // This is the shape a `set_variable` step produces for select menus.
    const config = { function: "in", conditions: [{ a: "b", b: "{{picks}}" }] };
    expect(evaluateCheck(config, { picks: "a, b , c" })).toBe(true);
    expect(evaluateCheck(config, { picks: "a,c" })).toBe(false);
  });
});

describe("check handler — editor condition", () => {
  it("continues when left/op/right passes and rejects when it fails", async () => {
    expect(await check.run(context({ left: "3", op: ">", right: "2" }))).toBeUndefined();
    expect(await check.run(context({ left: "1", op: ">", right: "2" }))).toMatchObject({
      data: { content: expect.stringContaining("This interaction isn't available for you.") },
    });
  });
});

describe("stop", () => {
  it("replies ephemerally when content is set", async () => {
    const response = await stop.run(context({ content: "All done" }));
    expect(response).toEqual({
      type: InteractionResponseType.ChannelMessageWithSource,
      data: { content: "All done", flags: MessageFlags.Ephemeral },
    });
  });

  it("accepts `message` as an alias for `content`", async () => {
    const response = await stop.run(context({ message: "Done" }));
    expect(response?.data?.content).toBe("Done");
  });

  it("acknowledges silently when nothing is set", async () => {
    const response = await stop.run(context({}));
    expect(response).toEqual({ type: InteractionResponseType.DeferredUpdateMessage });
  });
});

describe("set_variable", () => {
  it("stores a static literal and never responds", async () => {
    const vars: Record<string, unknown> = {};
    const response = await setVariable.run(context({ name: "plan", value: "pro", varType: "static" }, vars));
    expect(response).toBeUndefined();
    expect(vars.plan).toBe("pro");
  });

  it("defaults to static when varType is absent", async () => {
    const vars: Record<string, unknown> = {};
    await setVariable.run(context({ name: "a", value: "1" }, vars));
    expect(vars.a).toBe("1");
  });

  it("reads an adaptive field off the interaction", async () => {
    const vars: Record<string, unknown> = {};
    await setVariable.run(context({ name: "who", value: "user.id", varType: "adaptive" }, vars));
    expect(vars.who).toBe("user-1");
  });

  it("joins select-menu values for adaptive `selected`", async () => {
    const vars: Record<string, unknown> = {};
    await setVariable.run(
      context({ name: "picked", value: "selected", varType: "adaptive" }, vars, {
        data: { custom_id: "action:dud", values: ["red", "blue"] },
      }),
    );
    expect(vars.picked).toBe("red,blue");
  });

  it("resolves an unknown adaptive field to null rather than throwing", async () => {
    const vars: Record<string, unknown> = {};
    await setVariable.run(context({ name: "x", value: "nope", varType: "adaptive" }, vars));
    expect(vars.x).toBeNull();
  });

  it("`get` mirrors another variable by name", async () => {
    const vars: Record<string, unknown> = { source: "kept" };
    await setVariable.run(context({ name: "copy", value: "source", varType: "get" }, vars));
    expect(vars.copy).toBe("kept");
  });

  it("`get` of a missing variable resolves to null", async () => {
    const vars: Record<string, unknown> = {};
    await setVariable.run(context({ name: "copy", value: "ghost", varType: "get" }, vars));
    expect(vars.copy).toBeNull();
  });

  it("does nothing without a name", async () => {
    const vars: Record<string, unknown> = {};
    const response = await setVariable.run(context({ value: "x" }, vars));
    expect(response).toBeUndefined();
    expect(vars).toEqual({});
  });

  it("exposes the adaptive field list the editor reads", () => {
    expect(setVariable.ADAPTIVE_FIELDS).toContain("user.id");
    expect(setVariable.ADAPTIVE_FIELDS).toContain("selected");
  });
});
