import { describe, expect, it } from "vitest";
import { getUserIdPlaceholderSuggestions, isValidDiscordSnowflake } from "../userPlaceholderAutocomplete";

describe("user ID placeholder autocomplete", () => {
  it("allows partial IDs while the user is still typing", () => {
    expect(getUserIdPlaceholderSuggestions("user.123")?.[0]?.userId).toBe("123");
  });

  it("requires a valid 17–20 digit snowflake once a field separator is entered", () => {
    expect(getUserIdPlaceholderSuggestions("user.123.avatar")).toBeNull();
    expect(getUserIdPlaceholderSuggestions("user.123456789012345678.avatar")?.[0]?.userId)
      .toBe("123456789012345678");
  });

  it("offers only fields supported by the server author service", () => {
    const suggestions = getUserIdPlaceholderSuggestions("user.123456789012345678.avatar");
    expect(suggestions?.some((item) => item.tag.endsWith(".avatar}"))).toBe(true);
    expect(suggestions?.some((item) => item.tag.endsWith(".avatarurl}"))).toBe(false);
  });

  it("validates 17–20 digit Discord snowflakes", () => {
    expect(isValidDiscordSnowflake("12345678901234567")).toBe(true);
    expect(isValidDiscordSnowflake("12345678901234567890")).toBe(true);
    expect(isValidDiscordSnowflake("1234567890123456")).toBe(false);
    expect(isValidDiscordSnowflake("123456789012345678901")).toBe(false);
  });
});
