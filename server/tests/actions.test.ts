import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as discordService from "../src/services/discordService.js";
import { executeCustomId } from "../src/services/actionExecutor.js";
import { getActionHandler } from "../src/actions/index.js";
import { actionRepository } from "../src/repositories/index.js";
import type { ActionContext, DiscordApi } from "../src/actions/types.js";
import type { DiscordInteraction } from "@dmb/shared";
import { InteractionResponseType } from "@dmb/shared";

// Mock discord service with importOriginal so resolveBotToken and other utilities exist
vi.mock("../src/services/discordService.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/discordService.js")>();
  return {
    ...actual,
    addGuildMemberRole: vi.fn().mockResolvedValue(true),
    removeGuildMemberRole: vi.fn().mockResolvedValue(true),
    hasRole: vi.fn().mockResolvedValue(false),
    sendDirectMessage: vi.fn().mockResolvedValue({ id: "dm_1" } as any),
    sendChannelMessage: vi.fn().mockResolvedValue({ id: "chan_msg_1" } as any),
    sendChannelMessageWithToken: vi.fn().mockResolvedValue({ id: "token_msg_1" } as any),
    sendWebhook: vi.fn().mockResolvedValue({ id: "hook_msg_1" } as any),
    deleteChannelMessage: vi.fn().mockResolvedValue(true),
    createThreadFromMessage: vi.fn().mockResolvedValue({ id: "thread_1" }),
    resolveBotToken: vi.fn().mockResolvedValue("Bot.FakeToken"),
  };
});

describe("server/actions: Action Execution Engine & 17 Handlers Suite", () => {
  let mockDiscordApi: DiscordApi;
  let mockContext: ActionContext;

  beforeEach(() => {
    vi.clearAllMocks();

    mockDiscordApi = {
      addGuildMemberRole: vi.fn().mockResolvedValue(true),
      removeGuildMemberRole: vi.fn().mockResolvedValue(true),
      hasRole: vi.fn().mockResolvedValue(false),
      sendDirectMessage: vi.fn().mockResolvedValue({ id: "dm_1" } as any),
      sendChannelMessage: vi.fn().mockResolvedValue({ id: "chan_msg_1" } as any),
      sendChannelMessageWithToken: vi.fn().mockResolvedValue({ id: "token_msg_1" } as any),
      sendWebhook: vi.fn().mockResolvedValue({ id: "hook_msg_1" } as any),
      deleteChannelMessage: vi.fn().mockResolvedValue(true),
      createThreadFromMessage: vi.fn().mockResolvedValue({ id: "thread_1" }),
    };

    const interaction: DiscordInteraction = {
      id: "int_test_100",
      application_id: "app_100",
      token: "tok_test",
      version: 1,
      type: 3,
      guild_id: "guild_123",
      channel_id: "channel_456",
      member: {
        user: {
          id: "user_789",
          username: "Commander",
          discriminator: "0001",
        },
        roles: ["role_alpha", "role_beta"],
      },
      data: {
        custom_id: "action:dud",
        component_type: 2,
      },
    };

    mockContext = {
      interaction,
      config: {},
      variables: {},
      botToken: "Bot.FakeToken",
      discord: mockDiscordApi,
      repositories: {
        webhookProfiles: {
          getWebhookUrl: vi.fn().mockResolvedValue("https://discord.com/api/webhooks/1/tok"),
        } as any,
      },
      logger: {
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
      } as any,
    };
    vi.spyOn(discordService, "resolveBotToken").mockResolvedValue("Bot.FakeToken");
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("Action Execution Engine (actionExecutor.ts)", () => {
    it("extracts comprehensive user, channel, server, and timestamp variables", async () => {
      const interaction: DiscordInteraction = {
        id: "int_1",
        application_id: "app_1",
        token: "tok_1",
        version: 1,
        type: 3,
        guild_id: "998877665544332211",
        channel_id: "112233445566778899",
        member: {
          user: {
            id: "123456789012345678",
            username: "Astronaut",
            discriminator: "0",
          },
          nick: "Astro",
          roles: ["role_pilot"],
        },
        message: {
          id: "888888888888888888",
        },
        data: {
          custom_id: 'action:send_ephemeral_reply:{"content":"Hello {user.mention} in {channel.mention}!"}',
          component_type: 2,
        },
      };

      const result = await executeCustomId(interaction.data.custom_id, interaction);
      expect(result.handled).toBe(true);
      expect(result.response).toBeDefined();
      expect(result.response?.type).toBe(InteractionResponseType.ChannelMessageWithSource);
      expect((result.response?.data as any)?.content).toBe(
        "Hello <@123456789012345678> in <#112233445566778899>!",
      );
    });

    it("extracts modal submitted input values into input.<id> and modal.<id>", async () => {
      const interaction: DiscordInteraction = {
        id: "int_modal",
        application_id: "app_1",
        token: "tok_modal",
        version: 1,
        type: 5, // ModalSubmit
        data: {
          custom_id: 'action:send_ephemeral_reply:{"content":"Feedback: {input.feedback_input}"}',
          components: [
            {
              type: 1, // ActionRow
              components: [
                {
                  type: 4, // TextInput
                  custom_id: "feedback_input",
                  value: "Great platform!",
                },
              ],
            },
          ],
        },
      };

      const result = await executeCustomId(interaction.data.custom_id, interaction);
      expect(result.handled).toBe(true);
      expect((result.response?.data as any)?.content).toBe("Feedback: Great platform!");
    });

    it("enforces MAX_BRANCH_DEPTH = 10 recursion limit (INV-6)", async () => {
      // Build 11-level deep recursive check flow
      const buildOverlyDeepFlow = (depth: number): any => {
        if (depth > 11) {
          return [{ type: "send_ephemeral_reply", config: { content: "Deep!" } }];
        }
        return [
          {
            type: "check",
            config: {
              left: "1",
              op: "==",
              right: "1",
              then: buildOverlyDeepFlow(depth + 1),
            },
          },
        ];
      };

      vi.spyOn(actionRepository, "findByCustomId").mockResolvedValueOnce([
        {
          id: 1,
          action_type: "check",
          config: {
            left: "1",
            op: "==",
            right: "1",
            then: buildOverlyDeepFlow(1),
          },
        } as any,
      ]);

      const interaction: DiscordInteraction = {
        id: "int_depth",
        application_id: "app_1",
        token: "tok_depth",
        version: 1,
        type: 3,
        data: { custom_id: "action:deep_test", component_type: 2 },
      };

      const result = await executeCustomId("action:deep_test", interaction);
      expect(result.handled).toBe(true);
      expect((result.response?.data as any)?.content).toContain("That flow nests too deeply to run.");
    });
  });

  describe("All 17 Action Handlers", () => {
    // 1. check
    describe("actions/check.ts", () => {
      const runCheck = async (config: any, variables: Record<string, any> = {}) => {
        const handler = getActionHandler("check");
        return handler?.run({ ...mockContext, config, variables });
      };

      it("evaluates == and != operators correctly", async () => {
        await expect(runCheck({ left: "abc", op: "==", right: "abc" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "10", op: "!=", right: "20" })).resolves.toBeUndefined();
      });

      it("evaluates numeric comparisons >, <, >=, <=", async () => {
        await expect(runCheck({ left: "25", op: ">", right: "10" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "5", op: "<", right: "10" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "10", op: ">=", right: "10" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "10", op: "<=", right: "10" })).resolves.toBeUndefined();
      });

      it("evaluates string operators: contains, starts_with, ends_with, is_empty", async () => {
        await expect(runCheck({ left: "apple pie", op: "contains", right: "pie" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "hello world", op: "starts_with", right: "hello" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "image.png", op: "ends_with", right: ".png" })).resolves.toBeUndefined();
        await expect(runCheck({ left: "", op: "is_empty" })).resolves.toBeUndefined();
      });

      it("evaluates array containment: in operator", async () => {
        await expect(
          runCheck({ function: "in", conditions: [{ a: "admin", b: "mod, admin, owner" }] }),
        ).resolves.toBeUndefined();
      });

      it("evaluates role membership: member_has_role", async () => {
        const vars = { "member.roles": ["role_mod", "role_vip"] };
        await expect(
          runCheck({ checkType: "member_has_role", roleId: "role_mod" }, vars),
        ).resolves.toBeUndefined();
      });
    });

    // 2. setVariable
    describe("actions/setVariable.ts", () => {
      it("sets static, adaptive, and get variables", async () => {
        const handler = getActionHandler("set_variable");
        const vars: Record<string, any> = { source_var: "copy_me" };

        // static
        await handler?.run({ ...mockContext, variables: vars, config: { name: "k1", varType: "static", value: "v1" } });
        expect(vars.k1).toBe("v1");

        // adaptive
        await handler?.run({ ...mockContext, variables: vars, config: { name: "k2", varType: "adaptive", value: "user.id" } });
        expect(vars.k2).toBe("user_789");

        // get
        await handler?.run({ ...mockContext, variables: vars, config: { name: "k3", varType: "get", value: "source_var" } });
        expect(vars.k3).toBe("copy_me");
      });
    });

    // 3. addRole
    describe("actions/addRole.ts", () => {
      it("calls discord.addGuildMemberRole and replies", async () => {
        const handler = getActionHandler("add_role");
        const res = await handler?.run({ ...mockContext, config: { roleId: "role_new" } });
        expect(mockDiscordApi.addGuildMemberRole).toHaveBeenCalledWith("guild_123", "user_789", "role_new", "Bot.FakeToken");
        expect((res?.data as any)?.content).toContain("role_new");
      });
    });

    // 4. removeRole
    describe("actions/removeRole.ts", () => {
      it("calls discord.removeGuildMemberRole", async () => {
        const handler = getActionHandler("remove_role");
        await handler?.run({ ...mockContext, config: { roleId: "role_old" } });
        expect(mockDiscordApi.removeGuildMemberRole).toHaveBeenCalledWith("guild_123", "user_789", "role_old", "Bot.FakeToken");
      });
    });

    // 5. toggleRole
    describe("actions/toggleRole.ts", () => {
      it("removes role if member already has it", async () => {
        mockContext.interaction.member!.roles = ["role_toggle"];
        (mockDiscordApi.hasRole as any).mockResolvedValueOnce(true);
        const handler = getActionHandler("toggle_role");
        await handler?.run({ ...mockContext, config: { roleId: "role_toggle" } });
        expect(mockDiscordApi.removeGuildMemberRole).toHaveBeenCalled();
      });

      it("adds role if member does not have it", async () => {
        mockContext.interaction.member!.roles = [];
        const handler = getActionHandler("toggle_role");
        await handler?.run({ ...mockContext, config: { roleId: "role_toggle" } });
        expect(mockDiscordApi.addGuildMemberRole).toHaveBeenCalled();
      });
    });

    // 6. sendEphemeralReply
    describe("actions/sendEphemeralReply.ts", () => {
      it("returns ChannelMessageWithSource with ephemeral flag", async () => {
        const handler = getActionHandler("send_ephemeral_reply");
        const res = await handler?.run({ ...mockContext, config: { content: "Secret response!" } });
        expect(res?.type).toBe(InteractionResponseType.ChannelMessageWithSource);
        expect(res?.data?.flags).toBe(64);
        expect(res?.data?.content).toBe("Secret response!");
      });
    });

    // 7. sendMessage
    describe("actions/sendMessage.ts", () => {
      it("sends message to channel via bot token", async () => {
        const handler = getActionHandler("send_message");
        await handler?.run({ ...mockContext, config: { channelId: "target_chan", content: "Public announcement" } });
        expect(mockDiscordApi.sendChannelMessageWithToken).toHaveBeenCalled();
      });
    });

    // 8. sendDm
    describe("actions/sendDm.ts", () => {
      it("dispatches DM to interacting user", async () => {
        const handler = getActionHandler("send_dm");
        await handler?.run({ ...mockContext, config: { content: "Direct ping" } });
        expect(mockDiscordApi.sendDirectMessage).toHaveBeenCalledWith("user_789", expect.anything(), "Bot.FakeToken");
      });
    });

    // 9. sendWebhookMessage
    describe("actions/sendWebhookMessage.ts", () => {
      it("returns an explicit disabled response without calling webhook delivery", async () => {
        const handler = getActionHandler("send_webhook_message");
        const response = await handler?.run({
          ...mockContext,
          config: { webhookUrl: "https://discord.com/api/webhooks/1/tok", content: "Hook msg" },
        });
        expect(response?.data?.content).toContain("disabled");
        expect(mockDiscordApi.sendWebhook).not.toHaveBeenCalled();
      });
    });

    // 10. openModal
    describe("actions/openModal.ts", () => {
      it("returns Modal response with custom_id and title", async () => {
        const handler = getActionHandler("open_modal");
        const res = await handler?.run({
          ...mockContext,
          config: {
            title: "Support Ticket",
            customId: "ticket_modal",
            components: [
              {
                type: 1,
                components: [{ type: 4, custom_id: "issue", label: "Describe issue" }],
              },
            ],
          },
        });
        expect(res?.type).toBe(InteractionResponseType.Modal);
        expect(res?.data?.title).toBe("Support Ticket");
      });
    });

    // 11. modalSubmit
    describe("actions/modalSubmit.ts", () => {
      it("handles modal submit", async () => {
        const handler = getActionHandler("modal_submit");
        const res = await handler?.run({ ...mockContext, config: { content: "Modal received" } });
        expect(res?.type).toBe(InteractionResponseType.ChannelMessageWithSource);
      });
    });

    // 12. createThread
    describe("actions/createThread.ts", () => {
      it("creates a thread from message", async () => {
        const handler = getActionHandler("create_thread");
        await handler?.run({
          ...mockContext,
          interaction: { ...mockContext.interaction, message: { id: "msg_anchor" } as any },
          config: { name: "Discussion Thread" },
        });
        expect(mockDiscordApi.createThreadFromMessage).toHaveBeenCalled();
      });
    });

    // 13. deleteMessage
    describe("actions/deleteMessage.ts", () => {
      it("deletes message in channel", async () => {
        const handler = getActionHandler("delete_message");
        await handler?.run({
          ...mockContext,
          interaction: { ...mockContext.interaction, message: { id: "msg_to_delete" } as any },
          config: {},
        });
        expect(mockDiscordApi.deleteChannelMessage).toHaveBeenCalled();
      });
    });

    // 14. dud
    describe("actions/dud.ts", () => {
      it("no-op action returns undefined", async () => {
        const handler = getActionHandler("dud");
        const res = await handler?.run(mockContext);
        expect(res).toBeUndefined();
      });
    });

    // 15. stop
    describe("actions/stop.ts", () => {
      it("stops execution chain by returning an empty update response", async () => {
        const handler = getActionHandler("stop");
        const res = await handler?.run(mockContext);
        expect(res?.type).toBe(InteractionResponseType.DeferredUpdateMessage);
      });
    });

    // 16. wait
    describe("actions/wait.ts", () => {
      it("pauses execution for configured seconds", async () => {
        vi.useFakeTimers();
        try {
          const handler = getActionHandler("wait");
          const waitPromise = handler?.run({ ...mockContext, config: { seconds: 1 } });
          await vi.advanceTimersByTimeAsync(1000);
          const res = await waitPromise;
          expect(res).toBeUndefined();
        } finally {
          vi.useRealTimers();
        }
      });
    });

    // 17. responses
    describe("actions/responses.ts", () => {
      it("builds standard ephemeral error and success messages", async () => {
        const { actionFailed, acknowledge } = await import("../src/actions/responses.js");
        const fail = actionFailed("Something went wrong");
        expect(fail.type).toBe(InteractionResponseType.ChannelMessageWithSource);
        expect(fail.data?.content).toContain("Something went wrong");
        expect(fail.data?.flags).toBe(64);

        const ack = acknowledge();
        expect(ack.type).toBe(InteractionResponseType.DeferredUpdateMessage);
      });
    });
  });
});
