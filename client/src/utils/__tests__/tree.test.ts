import { describe, expect, it } from "vitest";
import { ComponentType, type ComponentNode } from "@dmb/shared";
import { findFirstComponentByType, reorderComponent } from "../tree";

describe("findFirstComponentByType", () => {
  it("finds a nested TextDisplay inside a Container", () => {
    const nestedText = {
      _id: "nested-text",
      type: ComponentType.TextDisplay,
      content: "Nested content",
    };
    const components = [
      {
        _id: "container",
        type: ComponentType.Container,
        components: [nestedText],
      },
    ] as ComponentNode[];

    expect(findFirstComponentByType(components, ComponentType.TextDisplay)).toEqual(nestedText);
  });

  it("returns the first matching component in depth-first order", () => {
    const firstText = {
      _id: "first-text",
      type: ComponentType.TextDisplay,
      content: "First",
    };
    const laterText = {
      _id: "later-text",
      type: ComponentType.TextDisplay,
      content: "Later",
    };
    const components = [
      { _id: "section", type: ComponentType.Section, components: [firstText] },
      laterText,
    ] as ComponentNode[];

    expect(findFirstComponentByType(components, ComponentType.TextDisplay)).toEqual(firstText);
  });

  it("returns null when the requested type is absent", () => {
    const components = [
      { _id: "separator", type: ComponentType.Separator },
    ] as ComponentNode[];

    expect(findFirstComponentByType(components, ComponentType.TextDisplay)).toBeNull();
  });
});

describe("reorderComponent", () => {
  const button = (id: string): ComponentNode => ({ _id: id, type: ComponentType.Button });
  const text = (id: string): ComponentNode => ({ _id: id, type: ComponentType.TextDisplay, content: id });

  it("moves top-level components forward and backward", () => {
    const original = [text("a"), text("b"), text("c")];
    const forward = reorderComponent(original, "a", "c");
    expect(forward.found).toBe(true);
    expect(forward.components.map((item) => item._id)).toEqual(["b", "c", "a"]);
    const backward = reorderComponent(forward.components, "a", "b");
    expect(backward.components.map((item) => item._id)).toEqual(["a", "b", "c"]);
    expect(original.map((item) => item._id)).toEqual(["a", "b", "c"]);
  });

  it("reorders only children inside the requested Container", () => {
    const original: ComponentNode[] = [
      { _id: "container", type: ComponentType.Container, components: [text("one"), text("two"), text("three")] },
      text("outside"),
    ];
    const result = reorderComponent(original, "one", "three", "container");
    expect(result.found).toBe(true);
    expect(result.components[0]?.components?.map((item) => item._id)).toEqual(["two", "three", "one"]);
    expect(result.components[1]?._id).toBe("outside");
  });

  it("reorders Action Row buttons within their parent", () => {
    const original: ComponentNode[] = [
      { _id: "row", type: ComponentType.ActionRow, components: [button("first"), button("second")] },
    ];
    const result = reorderComponent(original, "second", "first", "row");
    expect(result.components[0]?.components?.map((item) => item._id)).toEqual(["second", "first"]);
  });

  it("returns a no-op for missing IDs or identical IDs", () => {
    const original = [text("a"), text("b")];
    expect(reorderComponent(original, "missing", "b").found).toBe(false);
    expect(reorderComponent(original, "a", "missing").found).toBe(false);
    expect(reorderComponent(original, "a", "a").found).toBe(false);
  });
});
