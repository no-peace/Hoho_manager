import { ButtonStyle, ComponentType, buildCustomId } from "@dmb/shared";
import type { ComponentNode, FlowStep, MessageData } from "@dmb/shared";
import { uid } from "./constants";

export interface StarterBlueprint {
  id: string;
  title: string;
  description: string;
  create: () => {
    message: Partial<MessageData>;
    flows: Array<{ customId: string; steps: FlowStep[] }>;
  };
}

const actionButton = (label: string, style: number): ComponentNode => {
  const id = uid();
  return {
    _id: id,
    type: ComponentType.Button,
    style,
    label,
    custom_id: `action:dud:{"_id":"${id}"}`,
  } satisfies ComponentNode;
};

const step = (type: FlowStep["type"], config: Record<string, unknown> = {}): FlowStep => ({
  _id: uid(),
  type,
  config,
});

const container = (components: ComponentNode[], accent_color: number): ComponentNode => ({
  _id: uid(),
  type: ComponentType.Container,
  accent_color,
  components,
});

const text = (content: string): ComponentNode => ({
  _id: uid(),
  type: ComponentType.TextDisplay,
  content,
});

const actionRow = (children: ComponentNode[]): ComponentNode => ({
  _id: uid(),
  type: ComponentType.ActionRow,
  components: children,
});

const makeMessage = (components: ComponentNode[]): Partial<MessageData> => ({
  content: "",
  embeds: [],
  components,
  flags: 32768,
});

export const STARTER_BLUEPRINTS: StarterBlueprint[] = [
  {
    id: "verification-gate",
    title: "Verification Gate",
    description: "Rules, a Verify button, and a starter role-grant flow.",
    create: () => {
      const button = actionButton("Verify", ButtonStyle.Success);
      return {
        message: makeMessage([container([
          text("# Verify to Continue\nRead the rules below, then press **Verify** to receive access."),
          text("• Be respectful\n• Keep content in the correct channels\n• Follow the server rules"),
          { _id: uid(), type: ComponentType.Separator, divider: true, spacing: 1 },
          actionRow([button]),
        ], 0x5865f2)]),
        flows: [{ customId: button.custom_id!, steps: [
          step("add_role", { roleId: "REPLACE_WITH_MEMBER_ROLE_ID" }),
          step("send_ephemeral_reply", { content: "Verification complete. Welcome to the server!" }),
        ] }],
      };
    },
  },
  {
    id: "self-role-panel",
    title: "Self-Role Panel",
    description: "A role picker with three sample options to customize.",
    create: () => {
      const selectId = uid();
      const select: ComponentNode = {
        _id: uid(),
        type: ComponentType.StringSelect,
        custom_id: `action:dud:{"_id":"${selectId}"}`,
        placeholder: "Choose your roles",
        min_values: 0,
        max_values: 3,
        options: [
          { _id: uid(), label: "Announcements", value: "announcements" },
          { _id: uid(), label: "Events", value: "events" },
          { _id: uid(), label: "Giveaways", value: "giveaways" },
        ],
      };
      return {
        message: makeMessage([container([
          text("# Choose Your Roles\nSelect the notifications and interests you want to receive."),
          actionRow([select]),
        ], 0x818cf8)]),
        flows: [{ customId: select.custom_id!, steps: [
          step("send_ephemeral_reply", { content: "Role selection received. Configure role IDs for each option before publishing." }),
        ] }],
      };
    },
  },
  {
    id: "support-launcher",
    title: "Support / Application Launcher",
    description: "An Open Form button with a modal submission flow.",
    create: () => {
      const button = actionButton("Open Form", ButtonStyle.Primary);
      return {
        message: makeMessage([container([
          text("# Need Help?\nOpen a support request or submit an application using the form below."),
          text("**Support team**\nWe usually respond as soon as a staff member is available."),
          actionRow([button]),
        ], 0x5865f2)]),
        flows: [{ customId: button.custom_id!, steps: [
          step("open_modal", {
            title: "Support Request",
            customId: buildCustomId("modal_submit", { id: "support_request" }),
            components: [{ type: 1, components: [
              { type: 4, custom_id: "reason", label: "How can we help?", style: 2, required: true, max_length: 1000 },
            ] }],
            then: [step("send_ephemeral_reply", { content: "Your request was submitted: {modal.reason}" })],
          }),
        ] }],
      };
    },
  },
  {
    id: "release-changelog",
    title: "Release Changelog Card",
    description: "A clean release card with highlights and a link button.",
    create: () => {
      const button = actionButton("View Full Changelog", ButtonStyle.Link);
      button.url = "https://example.com/changelog";
      delete button.custom_id;
      return {
        message: makeMessage([container([
          text("## HoHo Manager · v1.0.0\n**Release notes**"),
          text("### Highlights\n• New Components V2 editor\n• Improved drag-and-drop\n• Better preview and dispatch validation"),
          { _id: uid(), type: ComponentType.Separator, divider: true, spacing: 1 },
          actionRow([button]),
        ], 0x5865f2)]),
        flows: [],
      };
    },
  },
  {
    id: "live-status-board",
    title: "Live Status Board",
    description: "A green status panel with relative Discord timestamps.",
    create: () => ({
      message: makeMessage([container([
        text("# Service Status\n🟢 **All systems operational**"),
        text("**WEAO Status:** {status}\n**Last checked:** <t:1795094400:R>\n**Next update:** <t:1795098000:R>"),
        { _id: uid(), type: ComponentType.Separator, divider: true, spacing: 1 },
        text("Status values are editable placeholders. Replace them with your live status variables."),
      ], 0x57f287)]),
      flows: [],
    }),
  },
];
