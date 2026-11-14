
import React from "react";
import {
  describe,
  expect,
  it,
  vi,
  beforeEach,
  afterEach,
} from "vitest";
import { act, render, screen } from "@testing-library/react";

const { resolveUsersMock } = vi.hoisted(() => ({
  resolveUsersMock: vi.fn(),
}));

// Correct path from src/components/preview/__tests__/
vi.mock("../../../api/client", () => ({
  default: {
    discord: {
      resolveUsers: (...args: unknown[]) => resolveUsersMock(...args),
    },
  },
}));

import {
  UserPlaceholderPreviewProvider,
  useUserPlaceholderPreview,
} from "../UserPlaceholderPreviewContent";

const USER_A = "123456789012345678";

const mockUser = {
  id: USER_A,
  username: "peace",
  globalName: "Peace",
  avatarUrl: "https://cdn.discordapp.com/avatars/test.png",
  profileUrl: `https://discord.com/users/${USER_A}`,
};

const Preview = ({ value }: { value: string }) => {
  const { resolveUserPlaceholders } = useUserPlaceholderPreview();

  return (
    <div data-testid="resolved">
      {resolveUserPlaceholders(value)}
    </div>
  );
};

describe("UserPlaceholderPreviewContext", () => {
  beforeEach(() => {
    vi.useFakeTimers();

    resolveUsersMock.mockReset();
    resolveUsersMock.mockResolvedValue({
      users: { [USER_A]: mockUser },
      failedIds: [],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves canonical avatar and leaves removed aliases unchanged", async () => {
    render(
      <UserPlaceholderPreviewProvider
        source={{
          content: `{user.${USER_A}.username}`,
          embeds: [
            {
              url: `{user.${USER_A}.url}`,
              image: { url: `{user.${USER_A}.avatar}` },
            },
          ],
        }}
      >
        <Preview
          value={[
            `{user.${USER_A}.username}`,
            `{user.${USER_A}.url}`,
            `{user.${USER_A}.avatarurl}`,
          ].join("|")}
        />
      </UserPlaceholderPreviewProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(resolveUsersMock).toHaveBeenCalledTimes(1);

    expect(screen.getByTestId("resolved").textContent).toBe(
      `peace|https://discord.com/users/${USER_A}|${mockUser.avatarUrl}`,
    );
  });

  it("does not resolve removed ID-scoped avatar aliases", async () => {
    const aliases = [
      `{user.${USER_A}.avatarurl}`,
      `{user.${USER_A}.icon}`,
      `{user.${USER_A}.pfp}`,
    ].join("|");
    render(
      <UserPlaceholderPreviewProvider source={aliases}>
        <Preview value={aliases} />
      </UserPlaceholderPreviewProvider>,
    );
    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });
    expect(screen.getByTestId("resolved").textContent).toBe(aliases);
  });

  it("keeps unknown fields unchanged", async () => {
    render(
      <UserPlaceholderPreviewProvider
        source={`{user.${USER_A}.unknown}`}
      >
        <Preview value={`{user.${USER_A}.unknown}`} />
      </UserPlaceholderPreviewProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(screen.getByTestId("resolved").textContent).toBe(
      `{user.${USER_A}.unknown}`,
    );
  });

  it("does not alter ordinary current-user placeholders", () => {
    render(
      <UserPlaceholderPreviewProvider source="{user.name}">
        <Preview value="{user.name}" />
      </UserPlaceholderPreviewProvider>,
    );

    expect(screen.getByTestId("resolved").textContent).toBe("{user.name}");
    expect(resolveUsersMock).not.toHaveBeenCalled();
  });

  it("does not request the same user ID more than once", async () => {
    render(
      <UserPlaceholderPreviewProvider
        source={{
          content: `{user.${USER_A}.name}`,
          embeds: [
            { author: { url: `{user.${USER_A}.url}` } },
            { image: { url: `{user.${USER_A}.avatarurl}` } },
          ],
        }}
      >
        <Preview value={`{user.${USER_A}.name}`} />
      </UserPlaceholderPreviewProvider>,
    );

    await act(async () => {
      await vi.advanceTimersByTimeAsync(300);
    });

    expect(resolveUsersMock).toHaveBeenCalledTimes(1);
    expect(resolveUsersMock).toHaveBeenCalledWith(
      [USER_A],
      expect.any(AbortSignal),
    );
  });
});
