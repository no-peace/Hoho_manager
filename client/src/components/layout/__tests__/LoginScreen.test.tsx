import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { LoginScreen, AUTH_ERROR_MESSAGES } from "../LoginScreen";

vi.mock("gsap", () => ({
  default: {
    context: () => ({ revert: vi.fn() }),
    timeline: () => ({ fromTo: vi.fn().mockReturnThis() }),
  },
}));

vi.mock("../../reactbits/ThreeHeroCanvas", () => ({
  ThreeHeroCanvas: () => <div aria-hidden="true" />,
}));

vi.mock("../../reactbits/ReactBitsPrimitives", () => ({
  ShinyText: ({ text }: { text: string }) => <span>{text}</span>,
  SpotlightCard: ({ children, className = "" }: React.PropsWithChildren<{ className?: string }>) => (
    <div className={className}>{children}</div>
  ),
  SplitTextReveal: ({ text }: { text: string }) => <span>{text}</span>,
}));

vi.mock("../../ui/CultSkiperPrimitives", () => ({
  SkiperDynamicStatusPill: ({ badge }: { badge: string }) => <span>{badge}</span>,
}));

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
    expect(screen.getByText(/Action triggered:/i)).toBeTruthy();
  });
});
