import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { RoleSelect } from "../StepList";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";

const { rolesRequest } = vi.hoisted(() => ({
  rolesRequest: vi.fn(),
}));

vi.mock("../../../api/client", () => ({
  default: {
    discord: {
      roles: rolesRequest,
    },
  },
  request: vi.fn(),
}));

describe("RoleSelect shared Discord role cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiscordCacheStore.setState({ roles: {} });
    rolesRequest.mockResolvedValue({
      roles: [{ id: "role-1", name: "Moderator", color: 0 }],
    });
  });

  it("coalesces role requests for multiple controls in the same guild", async () => {
    render(
      <>
        <RoleSelect guildId="guild-1" value="" onChange={vi.fn()} />
        <RoleSelect guildId="guild-1" value="" onChange={vi.fn()} />
      </>,
    );

    await waitFor(() => {
      expect(rolesRequest).toHaveBeenCalledTimes(1);
    });
  });
});
