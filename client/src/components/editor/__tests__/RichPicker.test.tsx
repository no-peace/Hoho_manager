import { Profiler } from "react";
import { act, render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useDiscordCacheStore } from "../../../store/discordCacheStore";
import { useGlobalStore } from "../../../store/globalStore";
import { RichPicker } from "../RichPicker";

describe("RichPicker render isolation", () => {
  it("does not rerender for another guild's channel, role, or emoji cache updates", () => {
    useGlobalStore.setState({ selectedGuildId: "guild-a" });
    useDiscordCacheStore.setState({
      channels: {
        "guild-a": [{ id: "channel-a", name: "general", type: 0 }],
        "guild-b": [],
      },
      roles: {
        "guild-a": [{ id: "role-a", name: "Member", color: 0 }],
        "guild-b": [],
      },
      emojis: {
        "guild-a": [{ id: "emoji-a", name: "wave" }],
        "guild-b": [],
      },
    });

    let renders = 0;
    render(
      <Profiler id="rich-picker" onRender={() => { renders += 1; }}>
        <RichPicker onInsert={() => undefined} onClose={() => undefined} initialTab="mentions" />
      </Profiler>,
    );

    renders = 0;
    act(() => {
      useDiscordCacheStore.setState((state) => ({
        channels: { ...state.channels, "guild-b": [{ id: "channel-b", name: "other", type: 0 }] },
        roles: { ...state.roles, "guild-b": [{ id: "role-b", name: "Other", color: 0 }] },
        emojis: { ...state.emojis, "guild-b": [{ id: "emoji-b", name: "other" }] },
      }));
    });

    expect(renders).toBe(0);
  });
});
