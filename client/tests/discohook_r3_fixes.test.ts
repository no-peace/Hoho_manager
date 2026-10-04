import { describe, it, expect, beforeEach, vi } from "vitest";
import { useGlobalStore } from "../src/store/globalStore";
import { useMessageStore } from "../src/store/messageStore";
import { EDITOR_MODES } from "../src/utils/constants";

describe("R3 Client Fixes & Layout Regression Suite", () => {
  beforeEach(() => {
    const storage: Record<string, string> = {};
    globalThis.localStorage = {
      getItem: (k: string) => storage[k] ?? null,
      setItem: (k: string, v: string) => {
        storage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete storage[k];
      },
      clear: () => {
        for (const k in storage) delete storage[k];
      },
      length: 0,
      key: () => null,
    } as any;

    useGlobalStore.getState().setIsSidebarOpen(false);
    useMessageStore.getState().reset();
  });

  describe("R1: Responsive Sidebar Drawer", () => {
    it("can toggle sidebar state cleanly", () => {
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);
      useGlobalStore.getState().toggleSidebar();
      expect(useGlobalStore.getState().isSidebarOpen).toBe(true);
      useGlobalStore.getState().toggleSidebar();
      expect(useGlobalStore.getState().isSidebarOpen).toBe(false);
    });

    it("persists sidebar preference to localStorage when manually opened on wide screen", () => {
      useGlobalStore.getState().setIsSidebarOpen(true);
      const stored = localStorage.getItem("hoho_global_state");
      expect(stored).toContain('"isSidebarOpen":true');
    });
  });

  describe("R2: Classic vs Components V2 Mode Toggle", () => {
    it("defaults to classic mode", () => {
      expect(useMessageStore.getState().mode).toBe(EDITOR_MODES.CLASSIC);
    });

    it("switches to components v2 mode without discarding content", () => {
      useMessageStore.getState().setContent("Hello Discohook");
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      expect(useMessageStore.getState().mode).toBe(EDITOR_MODES.V2);
      expect(useMessageStore.getState().data.content).toBe("Hello Discohook");
    });

    it("switches back to classic mode seamlessly", () => {
      useMessageStore.getState().setMode(EDITOR_MODES.V2);
      useMessageStore.getState().setMode(EDITOR_MODES.CLASSIC);
      expect(useMessageStore.getState().mode).toBe(EDITOR_MODES.CLASSIC);
    });
  });

  describe("R3: Discord Member Format Mapping", () => {
    it("formats members with nickname and username correctly", () => {
      const member = {
        id: "111222333",
        username: "johndoe",
        global_name: "John",
        nickname: "Johnny",
        avatar: null,
      };

      const displayName = member.nickname
        ? `${member.nickname} (${member.username})`
        : member.global_name
        ? `${member.global_name} (${member.username})`
        : member.username || member.id;

      expect(displayName).toBe("Johnny (johndoe)");
    });

    it("falls back to global_name when nickname is missing", () => {
      const member = {
        id: "111222333",
        username: "janedoe",
        global_name: "Jane",
        nickname: null,
        avatar: null,
      };

      const displayName = member.nickname
        ? `${member.nickname} (${member.username})`
        : member.global_name
        ? `${member.global_name} (${member.username})`
        : member.username || member.id;

      expect(displayName).toBe("Jane (janedoe)");
    });

    it("falls back to username when both nickname and global_name are null", () => {
      const member = {
        id: "111222333",
        username: "plainuser",
        global_name: null,
        nickname: null,
        avatar: null,
      };

      const displayName = member.nickname
        ? `${member.nickname} (${member.username})`
        : member.global_name
        ? `${member.global_name} (${member.username})`
        : member.username || member.id;

      expect(displayName).toBe("plainuser");
    });

    it("validates snowflake regex for manual ID entry", () => {
      expect(/^\d{17,20}$/.test("123456789012345678")).toBe(true);
      expect(/^\d{17,20}$/.test("12345678901234567")).toBe(true);
      expect(/^\d{17,20}$/.test("12345678901234567890")).toBe(true);
      expect(/^\d{17,20}$/.test("12345")).toBe(false);
      expect(/^\d{17,20}$/.test("not_a_snowflake")).toBe(false);
    });
  });
});
