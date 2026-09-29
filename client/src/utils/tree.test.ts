import { describe, expect, it } from "vitest";
import {
  newActionRow,
  newButton,
  newContainer,
  newMediaGallery,
  newSection,
  newSeparator,
  newStringSelect,
  newTextDisplay,
} from "./componentsV2";
import { insertComponent, moveComponent, removeComponent, updateComponent } from "./tree";
import { stripInternal } from "./discord";

/**
 * The tree helpers are the backbone of every editor interaction — reordering,
 * nesting and deleting must all stay immutable and hit the right node.
 */

describe("updateComponent", () => {
  it("updates a deeply nested child by _id without mutating the input", () => {
    const child = newTextDisplay("before");
    const container = newContainer([child]);
    const tree = [container];

    const result = updateComponent(tree, child._id ?? "", (c) => ({
      content: `${c.content}!`,
    }));

    expect(result.found).toBe(true);
    expect(result.components[0]?.components?.[0]?.content).toBe("before!");
    // Original untouched (immutability).
    expect(tree[0]?.components?.[0]?.content).toBe("before");
  });

  it("reports found=false and returns the original array for unknown ids", () => {
    const tree = [newContainer([newTextDisplay("hi")])];
    const result = updateComponent(tree, "missing-id", () => ({ content: "nope" }));
    expect(result.found).toBe(false);
    expect(result.components).toEqual(tree);
  });
});

describe("removeComponent", () => {
  it("removes a nested child", () => {
    const a = newTextDisplay("a");
    const b = newTextDisplay("b");
    const tree = [newContainer([a, b])];

    const result = removeComponent(tree, a._id ?? "");
    expect(result.found).toBe(true);
    expect(result.components[0]?.components?.map((c) => c.content)).toEqual(["b"]);
  });

  it("removes a whole subtree when given a parent id", () => {
    const container = newContainer([newTextDisplay("inner")]);
    const sibling = newTextDisplay("sibling");
    const tree = [container, sibling];

    const result = removeComponent(tree, container._id ?? "");
    expect(result.found).toBe(true);
    expect(result.components).toEqual([sibling]);
  });
});

describe("insertComponent", () => {
  it("appends to a parent's children", () => {
    const container = newContainer([newTextDisplay("one")]);
    const item = newTextDisplay("two");

    const result = insertComponent([container], container._id ?? "", item);
    expect(result.found).toBe(true);
    expect(result.components[0]?.components?.length).toBe(2);
  });

  it("falls back to top level when the parent is unknown", () => {
    const item = newTextDisplay("orphan");
    const tree = [newContainer()];
    const result = insertComponent(tree, "no-such-parent", item);
    expect(result.found).toBe(true);
    expect(result.components.length).toBe(2);
  });

  it("appends to the top level when parentId is null", () => {
    const item = newTextDisplay("top");
    const result = insertComponent([], null, item);
    expect(result.components).toEqual([item]);
  });
});

describe("moveComponent", () => {
  it("swaps a component with its sibling inside a parent", () => {
    const a = newTextDisplay("a");
    const b = newTextDisplay("b");
    const c = newTextDisplay("c");
    const container = newContainer([a, b, c]);
    const containerId = container._id ?? "";

    const moved = moveComponent([container], a._id ?? "", 1, containerId);
    expect(moved.found).toBe(true);
    expect(moved.components[0]?.components?.map((x) => x.content)).toEqual(["b", "a", "c"]);
  });

  it("refuses to move past the edges", () => {
    const a = newTextDisplay("a");
    const b = newTextDisplay("b");
    const container = newContainer([a, b]);
    const containerId = container._id ?? "";

    expect(moveComponent([container], a._id ?? "", -1, containerId).found).toBe(false);
    expect(moveComponent([container], b._id ?? "", 1, containerId).found).toBe(false);
  });

  it("reports not-found for an unknown parent id instead of throwing", () => {
    const a = newTextDisplay("a");
    expect(moveComponent([a], a._id ?? "", 1, "no-such-parent").found).toBe(false);
  });

  it("moves at the top level when parentId is null", () => {
    const a = newTextDisplay("a");
    const b = newTextDisplay("b");
    const moved = moveComponent([a, b], a._id ?? "", 1);
    expect(moved.components.map((x) => x.content)).toEqual(["b", "a"]);
  });
});

describe("stripInternal", () => {
  it("removes _id from nested trees", () => {
    const section = newSection([newTextDisplay("hello")]);
    const json = JSON.stringify(stripInternal([section]));
    expect(json).not.toContain("_id");
    expect(json).toContain("hello");
  });

  it("leaves plain values alone", () => {
    expect(stripInternal("text")).toBe("text");
    expect(stripInternal(42)).toBe(42);
    expect(stripInternal(null)).toBeNull();
  });

  it("strips underscore-prefixed keys but keeps user content intact", () => {
    const payload = stripInternal({ _id: "x", content: "_not a key_" }) as Record<string, unknown>;
    expect(payload._id).toBeUndefined();
    expect(payload.content).toBe("_not a key_");
  });
});

describe("component factories", () => {
  it("give every node a unique _id", () => {
    const nodes = [
      newTextDisplay(),
      newSeparator(),
      newContainer(),
      newMediaGallery(),
      newButton(),
      newSection(),
      newStringSelect(),
      newActionRow(),
    ];
    const ids = new Set(nodes.map((n) => n._id));
    expect(ids.size).toBe(nodes.length);
  });

  it("type each factory to the right Discord component type", () => {
    expect(newTextDisplay().type).toBe(10);
    expect(newSeparator().type).toBe(14);
    expect(newContainer().type).toBe(17);
    expect(newMediaGallery().type).toBe(12);
    expect(newButton().type).toBe(2);
    expect(newSection().type).toBe(9);
    expect(newStringSelect().type).toBe(3);
    expect(newActionRow().type).toBe(1);
  });

  it("give buttons a custom_id, and link buttons a url instead", () => {
    expect(newButton().custom_id).toBe("action:dud");
    const link = newButton(5); // ButtonStyle.Link
    expect(link.url).toBe("https://discord.com");
    expect(link.custom_id).toBeUndefined();
  });
});
