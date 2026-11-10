import { describe, expect, it, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MessageEditor } from "../MessageEditor";
import { useMessageStore } from "../../../store/messageStore";

describe("MessageEditor (UI-01 Webhook Profile Overrides)", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
  });

  it("renders collapsed Profile Override button displaying Default Bot Profile when unset", () => {
    render(<MessageEditor index={0} />);

    expect(screen.getByText(/Profile Override \(Webhook\)/i)).toBeDefined();
    expect(screen.getByText("Default Bot Profile")).toBeDefined();
  });

  it("expands panel on click and typing username updates message in store", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const usernameInput = screen.getByPlaceholderText("Announcements Bot") as HTMLInputElement;
    expect(usernameInput).toBeDefined();

    fireEvent.change(usernameInput, { target: { value: "Security Alerts" } });
    expect(useMessageStore.getState().data.username).toBe("Security Alerts");
  });

  it("displays character counter reflecting typed username length", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const usernameInput = screen.getByPlaceholderText("Announcements Bot");
    fireEvent.change(usernameInput, { target: { value: "12345" } });

    expect(screen.getByText("5/80")).toBeDefined();
  });

  it("displays validation error when username contains forbidden words (clyde/discord/system message)", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const usernameInput = screen.getByPlaceholderText("Announcements Bot");
    fireEvent.change(usernameInput, { target: { value: "discord staff" } });

    expect(screen.getByText(/Discord prohibits "discord" in webhook usernames/i)).toBeDefined();
  });

  it("displays validation error when username contains backticks", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const usernameInput = screen.getByPlaceholderText("Announcements Bot");
    fireEvent.change(usernameInput, { target: { value: "bot```name" } });

    expect(screen.getByText(/Username cannot contain backticks/i)).toBeDefined();
  });

  it("validates avatar URL: shows Valid badge for HTTPS URL", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const avatarInput = screen.getByPlaceholderText("https://cdn.discordapp.com/avatars/...");
    fireEvent.change(avatarInput, { target: { value: "https://example.com/avatar.png" } });

    expect(screen.getByText(/Valid/i)).toBeDefined();
  });

  it("triggers image load error on avatar img onError", () => {
    render(<MessageEditor index={0} />);

    const toggleButton = screen.getByRole("button", { name: /Profile Override \(Webhook\)/i });
    fireEvent.click(toggleButton);

    const avatarInput = screen.getByPlaceholderText("https://cdn.discordapp.com/avatars/...");
    fireEvent.change(avatarInput, { target: { value: "https://example.com/broken.png" } });

    const avatarImg = screen.getByAltText("Avatar");
    fireEvent.error(avatarImg);

    // After load error, Valid badge disappears and input gets error styling
    expect(screen.queryByText(/Valid/i)).toBeNull();
  });

  it("clears both username and avatar_url via Clear Profile Override button", () => {
    useMessageStore.getState().setField("username", "Pre-set Bot");
    useMessageStore.getState().setField("avatar_url", "https://example.com/avatar.png");

    render(<MessageEditor index={0} />);

    const clearButton = screen.getByTitle("Clear Profile Override");
    fireEvent.click(clearButton);

    expect(useMessageStore.getState().data.username).toBe("");
    expect(useMessageStore.getState().data.avatar_url).toBe("");
  });
});
