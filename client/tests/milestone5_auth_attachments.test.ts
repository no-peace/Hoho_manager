import { describe, it, expect, beforeEach, vi } from "vitest";
import { useMessageStore } from "../src/store/messageStore";
import { useGlobalStore } from "../src/store/globalStore";
import { isPayloadEmpty } from "../src/utils/discord";
import { request, api } from "../src/api/client";

describe("Milestone 5: Auth State and File Attachments", () => {
  beforeEach(() => {
    useMessageStore.getState().reset();
    useGlobalStore.setState({ currentUser: null, authLoading: false });
    vi.restoreAllMocks();
  });

  describe("File Attachments Store State", () => {
    it("adds files and tracks in-memory attachedFiles", () => {
      const mockFile1 = new File(["dummy image content"], "avatar.png", { type: "image/png" });
      const mockFile2 = new File(["dummy document"], "notes.txt", { type: "text/plain" });

      useMessageStore.getState().addFiles([mockFile1, mockFile2]);

      const state = useMessageStore.getState();
      expect(state.attachedFiles).toHaveLength(2);
      expect(state.attachedFiles[0].name).toBe("avatar.png");
      expect(state.attachedFiles[0].type).toBe("image/png");
      expect(state.attachedFiles[0].spoiler).toBe(false);
      expect(state.attachedFiles[1].name).toBe("notes.txt");
    });

    it("toggles spoiler flag for attached files", () => {
      const mockFile = new File(["secret photo"], "secret.png", { type: "image/png" });
      useMessageStore.getState().addFiles([mockFile]);

      const fileId = useMessageStore.getState().attachedFiles[0].id;
      expect(useMessageStore.getState().attachedFiles[0].spoiler).toBe(false);

      useMessageStore.getState().toggleFileSpoiler(fileId);
      expect(useMessageStore.getState().attachedFiles[0].spoiler).toBe(true);

      useMessageStore.getState().toggleFileSpoiler(fileId);
      expect(useMessageStore.getState().attachedFiles[0].spoiler).toBe(false);
    });

    it("removes a file and clears all files cleanly", () => {
      const f1 = new File(["1"], "1.png", { type: "image/png" });
      const f2 = new File(["2"], "2.png", { type: "image/png" });
      useMessageStore.getState().addFiles([f1, f2]);

      const firstId = useMessageStore.getState().attachedFiles[0].id;
      useMessageStore.getState().removeFile(firstId);

      expect(useMessageStore.getState().attachedFiles).toHaveLength(1);
      expect(useMessageStore.getState().attachedFiles[0].name).toBe("2.png");

      useMessageStore.getState().clearFiles();
      expect(useMessageStore.getState().attachedFiles).toHaveLength(0);
    });

    it("excludes attachedFiles from localStorage partialize configuration", () => {
      // Ensure that File objects are not part of partialize to prevent localStorage serialization errors
      const f = new File(["test"], "test.png", { type: "image/png" });
      useMessageStore.getState().addFiles([f]);

      const fullState = useMessageStore.getState();
      expect(fullState.attachedFiles).toHaveLength(1);

      // Verify the persist config partialize behavior
      const persistOptions = (useMessageStore as any).persist?.getOptions?.();
      if (persistOptions?.partialize) {
        const persisted = persistOptions.partialize(fullState);
        expect(persisted).not.toHaveProperty("attachedFiles");
        expect(persisted).toHaveProperty("mode");
        expect(persisted).toHaveProperty("data");
      }
    });
  });

  describe("Payload Validation (isPayloadEmpty)", () => {
    it("reports empty when message has no content, no embeds, and no attachments", () => {
      const payload = { content: "" };
      expect(isPayloadEmpty(payload, false)).toBe(true);
    });

    it("reports non-empty when hasAttachments is true even if content is empty", () => {
      const payload = { content: "" };
      expect(isPayloadEmpty(payload, true)).toBe(false);
    });

    it("reports non-empty when content is present even without attachments", () => {
      const payload = { content: "Hello world" };
      expect(isPayloadEmpty(payload, false)).toBe(false);
    });

    it("reports non-empty when payload.attachments contains items", () => {
      const payload = { content: "", attachments: [{ id: "0", filename: "sample.png" }] };
      expect(isPayloadEmpty(payload, false)).toBe(false);
    });
  });

  describe("Global Auth Store & API Client", () => {
    it("manages currentUser in globalStore", () => {
      expect(useGlobalStore.getState().currentUser).toBeNull();

      useGlobalStore.getState().setCurrentUser({
        id: "123456789012345678",
        username: "testuser",
        global_name: "Test User",
        avatar: "avatarhash123",
        role: "admin",
        isAdmin: true,
      });

      expect(useGlobalStore.getState().currentUser?.id).toBe("123456789012345678");
      expect(useGlobalStore.getState().currentUser?.role).toBe("admin");
      expect(useGlobalStore.getState().currentUser?.isAdmin).toBe(true);
    });

    it("fetches current user and sets state", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            user: {
              id: "999888777666555444",
              username: "oauth_user",
              avatar: null,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );

      await useGlobalStore.getState().fetchCurrentUser();

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining("/api/auth/me"),
        expect.objectContaining({ credentials: "include" })
      );
      expect(useGlobalStore.getState().currentUser?.id).toBe("999888777666555444");
    });

    it("clears currentUser upon logout", async () => {
      useGlobalStore.getState().setCurrentUser({
        id: "999888777666555444",
        username: "oauth_user",
      });

      vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true, ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      await useGlobalStore.getState().logout();
      expect(useGlobalStore.getState().currentUser).toBeNull();
    });

    it("api.client handles FormData without JSON stringifying or Content-Type header override", async () => {
      const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true, mode: "bot" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        })
      );

      const formData = new FormData();
      formData.append("payload_json", JSON.stringify({ mode: "bot", payload: {} }));
      formData.append("files", new Blob(["file-bytes"]), "upload.txt");

      const result = await api.send(formData);

      expect(result).toEqual({ ok: true, mode: "bot" });
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const [, callInit] = fetchSpy.mock.calls[0];
      expect(callInit?.credentials).toBe("include");
      expect(callInit?.body).toBe(formData);
      // Content-Type should not be set manually so fetch can set the boundary
      const headers = callInit?.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBeUndefined();
    });
  });
});
