import { describe, expect, it } from "vitest";
import { ComponentType, type ComponentNode } from "@dmb/shared";
import { findFirstComponentByType } from "../tree";

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
