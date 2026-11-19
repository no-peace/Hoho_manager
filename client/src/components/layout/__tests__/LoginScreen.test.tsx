import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginScreen, AUTH_ERROR_MESSAGES } from "../LoginScreen";


describe("LoginScreen mobile and desktop regressions", () => {
  beforeEach(() => {
    vi.stubGlobal("matchMedia", window.matchMedia);
  });

  it("renders a scrollable viewport with exactly one Discord login CTA", () => {
    render(<LoginScreen />);
    const root = screen.getByTestId("login-screen-scroll-root");

    expect(root.className).toContain("h-dvh");
    expect(root.className).toContain("overflow-y-auto");
    expect(screen.getAllByRole("button", { name: /Login with Discord/i })).toHaveLength(1);
  });

  it("shows a readable OAuth error message", () => {
    render(<LoginScreen authError="oauth_denied" />);
    expect(screen.getByRole("alert").textContent).toContain(AUTH_ERROR_MESSAGES.oauth_denied);
  });

  it("switches showcase tabs and displays demo action feedback", () => {
    render(<LoginScreen />);
    fireEvent.click(screen.getByRole("tab", { name: /Button & Modal Flows/i }));

    expect(screen.getByText(/No-Code Button & Modal Workflows/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Submit Application/i }));
    expect(screen.getByRole("status").textContent).toContain('Only you can see this · Triggered "Submit Application" flow');
  });

  it("renders the studio atmosphere and preserves the 5/7 showcase grid", () => {
    render(<LoginScreen />);
    const root = screen.getByTestId("login-screen-scroll-root");
    expect(root.className).toContain("hoho-studio-backdrop");
    expect(root.querySelector(".hoho-studio-grid-overlay")).toBeTruthy();
    expect(root.querySelector(".hoho-grid-beam-x")).toBeTruthy();
    expect(root.querySelector(".hoho-grid-beam-y")).toBeTruthy();
    expect(root.querySelector(".lg\\:col-span-5")).toBeTruthy();
    expect(root.querySelector(".lg\\:col-span-7")).toBeTruthy();
    expect(root.querySelector("main")?.className).toContain("lg:items-stretch");
    expect(screen.getByRole("button", { name: /Login with Discord/i })).toBeTruthy();

    const studioLink = screen.getByRole("link", { name: "Studio" });
    expect(studioLink.getAttribute("aria-current")).toBe("page");
    expect(screen.getByRole("navigation", { name: "Public navigation" })).toBeTruthy();
  });

});