import { describe, expect, it } from "vitest";
import { getUserIdPlaceholderSuggestions } from "../userPlaceholderAutocomplete";

describe("getUserIdPlaceholderSuggestions", () => {
  it("suggests fields while a Discord ID is being typed", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.133342345");

    expect(suggestions).not.toBeNull();
    expect(suggestions?.some(
      (item) => item.tag === "{user.133342345.name}",
    )).toBe(true);
    expect(suggestions?.some(
      (item) => item.tag === "{user.133342345.avatarurl}",
    )).toBe(true);
  });

  it("filters fields after the ID", () => {
    const suggestions = getUserIdPlaceholderSuggestions(
      "user.123456789012345678.ava",
    );

    expect(suggestions).not.toBeNull();
    expect(suggestions?.length).toBeGreaterThan(0);
    expect(suggestions?.every(
      (item) => item.tag.toLowerCase().includes(".ava"),
    )).toBe(true);
    expect(suggestions?.some(
      (item) => item.tag === "{user.123456789012345678.avatarurl}",
    )).toBe(true);
  });

  it("suggests fields after a complete ID and trailing dot", () => {
    const suggestions = getUserIdPlaceholderSuggestions(
      "user.123456789012345678.",
    );

    expect(suggestions?.some(
      (item) => item.tag === "{user.123456789012345678.username}",
    )).toBe(true);
  });

  it("does not treat ordinary user variables as ID-based variables", () => {
    expect(getUserIdPlaceholderSuggestions("user.")).toBeNull();
    expect(getUserIdPlaceholderSuggestions("user.name")).toBeNull();
  });

  it("does not accept more than 20 ID digits", () => {
    expect(
      getUserIdPlaceholderSuggestions("user.123456789012345678901"),
    ).toBeNull();
  });

  it("suggests the full standard user field set for an ID", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.123456789012345678.");
    const tags = suggestions?.map((item) => item.tag) ?? [];
    for (const field of ["roles", "clantag", "created", "created.relative", "joined", "joined.date"]) {
      expect(tags).toContain(`{user.123456789012345678.${field}}`);
    }
  });

  it("filters nested timestamp fields", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.123456789012345678.created.");
    expect(suggestions?.map((item) => item.tag)).toContain("{user.123456789012345678.created.relative}");
  });

  it("keeps the entered ID prefix in every replacement", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.133342345");

    expect(suggestions?.every(
      (item) => item.tag.startsWith("{user.133342345."),
    )).toBe(true);
  });
});