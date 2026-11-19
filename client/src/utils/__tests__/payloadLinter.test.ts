import { describe, expect, it } from "vitest";
import { ButtonStyle, ComponentType } from "@dmb/shared";
import type { MessageData } from "@dmb/shared";
import { lintPayloads } from "../payloadLinter";

const message = (overrides: Partial<MessageData> = {}): MessageData => ({
  content: "",
  embeds: [],
  components: [],
  username: "",
  avatar_url: "",
  thread_name: "",
  ...overrides,
});

describe("lintPayloads", () => {
  it("reports duplicate custom IDs and invalid link buttons", () => {
    const issues = lintPayloads([message({
      components: [
        { _id: "a", type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: "same" },
        { _id: "b", type: ComponentType.Button, style: ButtonStyle.Primary, custom_id: "same" },
        { _id: "link", type: ComponentType.Button, style: ButtonStyle.Link, url: "javascript:alert(1)" },
      ],
    })]);
    expect(issues.some((issue) => issue.message.includes("Duplicate custom_id"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("HTTP or HTTPS"))).toBe(true);
  });

  it("reports impossible String Select constraints and missing attachment references", () => {
    const issues = lintPayloads([message({
      components: [{
        _id: "select",
        type: ComponentType.StringSelect,
        min_values: 2,
        max_values: 4,
        options: [{ label: "One", value: "one" }],
      }],
      embeds: [{ _id: "embed", image: { url: "attachment://missing.png" } } as any],
    })]);
    expect(issues.some((issue) => issue.message.includes("max_values cannot exceed"))).toBe(true);
    expect(issues.some((issue) => issue.message.includes("no matching attached file"))).toBe(true);
  });

  it("counts Components V2 text and warns about empty messages", () => {
    const issues = lintPayloads([
      message({ flags: 32768, components: [{ type: ComponentType.TextDisplay, content: "x".repeat(4001) }] }),
      message(),
    ]);
    expect(issues.some((issue) => issue.message.includes("4,000"))).toBe(true);
    expect(issues.some((issue) => issue.severity === "warning" && issue.message.includes("empty"))).toBe(true);
  });
});
