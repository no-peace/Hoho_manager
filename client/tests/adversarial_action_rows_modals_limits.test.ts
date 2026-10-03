import { describe, it, expect, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { useMessageStore } from "../src/store/messageStore";
import { useActionStore, createStep } from "../src/store/actionStore";
import {
  newButton,
  newActionRow,
  newContainer,
  newTextDisplay,
  newStringSelect,
  newUserSelect,
  newRoleSelect,
  newMentionableSelect,
  newChannelSelect,
  newSelectOption,
  canAddToActionRow,
  canNestIn,
  buttonStylePatch,
  isInteractiveComponent,
  createComponent,
} from "../src/utils/componentsV2";
import {
  toDiscordPayload,
  validateMessage,
  stripInternal,
  isPayloadEmpty,
} from "../src/utils/discord";
import {
  findComponent,
  moveComponent,
  insertComponent,
  removeComponent,
  updateComponent,
} from "../src/utils/tree";
import {
  ButtonStyle,
  ComponentType,
  Limits,
  MessageFlags,
  type ComponentNode,
  type MessageData,
  type FlowStep,
} from "@dmb/shared";
import { DiscordModalPreview, type ModalInputField } from "../src/components/actions/StepList";

describe("Adversarial Stress Harness: Action Rows, Modals & Component Limits", () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    globalThis.localStorage = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = String(v);
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        mockStorage = {};
      },
      length: 0,
      key: () => null,
    } as any;

    useMessageStore.getState().reset();
    useActionStore.getState().reset();
  });

  /* ──────────────────────────────────────────────────────────────────────────
     1. Action Row Limits (Exactly 5 rows max, exactly 5 buttons per row max)
     ────────────────────────────────────────────────────────────────────────── */
  describe("1. Action Row & Button Limits Enforcement", () => {
    it("1.1. Allows message with 0 action rows without errors", () => {
      const doc: MessageData = {
        content: "Pure text message",
        embeds: [],
        components: [],
        username: "",
        avatar_url: "",
        thread_name: "",
      };
      const errors = validateMessage(doc, "classic");
      expect(errors).toHaveLength(0);
    });

    it("1.2. Allows exactly 5 top-level Action Rows with 1 button each", () => {
      const rows: ComponentNode[] = Array.from({ length: 5 }, (_, i) => ({
        _id: `row_${i}`,
        type: ComponentType.ActionRow,
        components: [
          {
            _id: `btn_${i}`,
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: `Button ${i}`,
            custom_id: `action:btn_${i}`,
          },
        ],
      }));

      const doc: MessageData = {
        content: "5 Action Rows",
        embeds: [],
        components: rows,
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toHaveLength(0);
    });

    it("1.3. Rejects 6 top-level Action Rows with limit error on the 6th row", () => {
      const rows: ComponentNode[] = Array.from({ length: 6 }, (_, i) => ({
        _id: `row_${i}`,
        type: ComponentType.ActionRow,
        components: [
          {
            _id: `btn_${i}`,
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: `Button ${i}`,
            custom_id: `action:btn_${i}`,
          },
        ],
      }));

      const doc: MessageData = {
        content: "6 Action Rows",
        embeds: [],
        components: rows,
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toHaveLength(1);
      expect(errors[0]).toContain("components[5]: A message cannot contain more than 5 Action Rows");
    });

    it("1.4. Recursively counts container-nested Action Rows toward the 5 row limit", () => {
      // 3 top-level Action Rows + 1 Container holding 3 Action Rows = 6 Action Rows total
      const topRows: ComponentNode[] = Array.from({ length: 3 }, (_, i) => ({
        _id: `top_row_${i}`,
        type: ComponentType.ActionRow,
        components: [
          {
            _id: `top_btn_${i}`,
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: `Top ${i}`,
            custom_id: `action:top_${i}`,
          },
        ],
      }));

      const nestedRows: ComponentNode[] = Array.from({ length: 3 }, (_, i) => ({
        _id: `nested_row_${i}`,
        type: ComponentType.ActionRow,
        components: [
          {
            _id: `nested_btn_${i}`,
            type: ComponentType.Button,
            style: ButtonStyle.Secondary,
            label: `Nested ${i}`,
            custom_id: `action:nested_${i}`,
          },
        ],
      }));

      const container: ComponentNode = {
        _id: "container_1",
        type: ComponentType.Container,
        components: nestedRows,
      };

      const doc: MessageData = {
        content: "",
        embeds: [],
        components: [...topRows, container],
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      // In V2 mode where containers are validated
      const errors = validateMessage(doc, "v2");
      expect(errors.some((e) => e.includes("A message cannot contain more than 5 Action Rows"))).toBe(true);
    });

    it("1.5. Rejects empty Action Rows (0 controls)", () => {
      const emptyRow: ComponentNode = {
        _id: "empty_row",
        type: ComponentType.ActionRow,
        components: [],
      };

      const doc: MessageData = {
        content: "Empty row test",
        embeds: [],
        components: [emptyRow],
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toContain("components[0]: Action Row needs at least one button or select menu");
    });

    it("1.6. Allows exactly 5 buttons in a single Action Row", () => {
      const fiveButtons: ComponentNode[] = Array.from({ length: 5 }, (_, i) => ({
        _id: `btn_${i}`,
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: `Button ${i}`,
        custom_id: `action:btn_${i}`,
      }));

      const row: ComponentNode = {
        _id: "row_five",
        type: ComponentType.ActionRow,
        components: fiveButtons,
      };

      const doc: MessageData = {
        content: "Five buttons row",
        embeds: [],
        components: [row],
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toHaveLength(0);
    });

    it("1.7. Rejects 6 buttons in a single Action Row (exceeds 5 button limit)", () => {
      const sixButtons: ComponentNode[] = Array.from({ length: 6 }, (_, i) => ({
        _id: `btn_${i}`,
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: `Button ${i}`,
        custom_id: `action:btn_${i}`,
      }));

      const row: ComponentNode = {
        _id: "row_six",
        type: ComponentType.ActionRow,
        components: sixButtons,
      };

      const doc: MessageData = {
        content: "Six buttons row",
        embeds: [],
        components: [row],
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toContain("components[0]: Action Row allows at most 5 controls");
    });

    it("1.8. canAddToActionRow strictly gates 5-button capacity", () => {
      const buttons: ComponentNode[] = Array.from({ length: 4 }, (_, i) => ({
        _id: `btn_${i}`,
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: `Btn ${i}`,
      }));

      // At 4 buttons: can add 5th button
      expect(canAddToActionRow(buttons, ComponentType.Button)).toBe(true);

      // Add 5th button
      const fiveButtons = [
        ...buttons,
        { _id: "btn_4", type: ComponentType.Button, style: ButtonStyle.Primary, label: "Btn 4" },
      ];

      // At 5 buttons: can NOT add 6th button
      expect(canAddToActionRow(fiveButtons, ComponentType.Button)).toBe(false);

      // Cannot add select menu to a row with buttons
      expect(canAddToActionRow(buttons, ComponentType.StringSelect)).toBe(false);
      expect(canAddToActionRow(fiveButtons, ComponentType.StringSelect)).toBe(false);
    });

    it("1.9. Rejects Action Row containing non-interactive components like TextDisplay", () => {
      const rowWithText: ComponentNode = {
        _id: "invalid_row",
        type: ComponentType.ActionRow,
        components: [
          {
            _id: "text_child",
            type: ComponentType.TextDisplay,
            content: "Illegal inside ActionRow",
          },
        ],
      };

      const doc: MessageData = {
        content: "",
        embeds: [],
        components: [rowWithText],
        username: "",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toContain("components[0]: Action Row children must be buttons or select menus");
    });

    it("1.10. Rejects invalid button styles (outside 1..6)", () => {
      const invalidStyleButton: ComponentNode = {
        _id: "btn_bad_style",
        type: ComponentType.Button,
        style: 99 as any,
        label: "Broken Style",
        custom_id: "action:dud",
      };

      const row: ComponentNode = {
        _id: "row_1",
        type: ComponentType.ActionRow,
        components: [invalidStyleButton],
      };

      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors.some((e) => e.includes("Button style must be a supported Discord style"))).toBe(true);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     2. Horizontal Button Reordering & Edge Boundaries
     ────────────────────────────────────────────────────────────────────────── */
  describe("2. Horizontal Button Reordering & Edge Boundaries", () => {
    it("2.1. Blocks moving first button left (index 0, direction -1 is a no-op)", () => {
      const store = useMessageStore.getState();
      const b0 = { ...newButton(ButtonStyle.Primary), _id: "b0", label: "B0" };
      const b1 = { ...newButton(ButtonStyle.Secondary), _id: "b1", label: "B1" };
      const b2 = { ...newButton(ButtonStyle.Success), _id: "b2", label: "B2" };
      const row = { _id: "r1", type: ComponentType.ActionRow, components: [b0, b1, b2] };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" },
      });

      // Attempt to move leftmost button left (-1)
      store.moveComponentById("b0", -1, "r1");

      const components = useMessageStore.getState().data.components[0].components!;
      expect(components.map((c) => c._id)).toEqual(["b0", "b1", "b2"]);
    });

    it("2.2. Blocks moving last button right (last index, direction +1 is a no-op)", () => {
      const store = useMessageStore.getState();
      const b0 = { ...newButton(ButtonStyle.Primary), _id: "b0", label: "B0" };
      const b1 = { ...newButton(ButtonStyle.Secondary), _id: "b1", label: "B1" };
      const b2 = { ...newButton(ButtonStyle.Success), _id: "b2", label: "B2" };
      const row = { _id: "r1", type: ComponentType.ActionRow, components: [b0, b1, b2] };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" },
      });

      // Attempt to move rightmost button right (+1)
      store.moveComponentById("b2", 1, "r1");

      const components = useMessageStore.getState().data.components[0].components!;
      expect(components.map((c) => c._id)).toEqual(["b0", "b1", "b2"]);
    });

    it("2.3. Handles single-button row reordering gracefully without error", () => {
      const store = useMessageStore.getState();
      const b0 = { ...newButton(ButtonStyle.Primary), _id: "solo_btn", label: "Solo" };
      const row = { _id: "r_solo", type: ComponentType.ActionRow, components: [b0] };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" },
      });

      store.moveComponentById("solo_btn", -1, "r_solo");
      expect(useMessageStore.getState().data.components[0].components?.map((c) => c._id)).toEqual(["solo_btn"]);

      store.moveComponentById("solo_btn", 1, "r_solo");
      expect(useMessageStore.getState().data.components[0].components?.map((c) => c._id)).toEqual(["solo_btn"]);
    });

    it("2.4. Traverses a middle button across all positions from left to right and back", () => {
      const store = useMessageStore.getState();
      const b0 = { ...newButton(ButtonStyle.Primary), _id: "b0", label: "B0" };
      const b1 = { ...newButton(ButtonStyle.Secondary), _id: "b1", label: "B1" };
      const b2 = { ...newButton(ButtonStyle.Success), _id: "b2", label: "B2" };
      const b3 = { ...newButton(ButtonStyle.Danger), _id: "b3", label: "B3" };
      const b4 = { ...newButton(ButtonStyle.Primary), _id: "b4", label: "B4" };
      const row = { _id: "r1", type: ComponentType.ActionRow, components: [b0, b1, b2, b3, b4] };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" },
      });

      const getOrder = () => useMessageStore.getState().data.components[0].components!.map((c) => c._id);
      expect(getOrder()).toEqual(["b0", "b1", "b2", "b3", "b4"]);

      // Move b2 left -> pos 1
      store.moveComponentById("b2", -1, "r1");
      expect(getOrder()).toEqual(["b0", "b2", "b1", "b3", "b4"]);

      // Move b2 left -> pos 0
      store.moveComponentById("b2", -1, "r1");
      expect(getOrder()).toEqual(["b2", "b0", "b1", "b3", "b4"]);

      // Move b2 left again at edge -> no-op
      store.moveComponentById("b2", -1, "r1");
      expect(getOrder()).toEqual(["b2", "b0", "b1", "b3", "b4"]);

      // Move b2 right 4 times to reach far right end
      store.moveComponentById("b2", 1, "r1");
      expect(getOrder()).toEqual(["b0", "b2", "b1", "b3", "b4"]);
      store.moveComponentById("b2", 1, "r1");
      expect(getOrder()).toEqual(["b0", "b1", "b2", "b3", "b4"]);
      store.moveComponentById("b2", 1, "r1");
      expect(getOrder()).toEqual(["b0", "b1", "b3", "b2", "b4"]);
      store.moveComponentById("b2", 1, "r1");
      expect(getOrder()).toEqual(["b0", "b1", "b3", "b4", "b2"]);

      // Move b2 right again at far edge -> no-op
      store.moveComponentById("b2", 1, "r1");
      expect(getOrder()).toEqual(["b0", "b1", "b3", "b4", "b2"]);
    });

    it("2.5. Correctly reorders buttons within a Container-nested Action Row", () => {
      const store = useMessageStore.getState();
      const b0 = { ...newButton(ButtonStyle.Primary), _id: "cnt_b0", label: "CB0" };
      const b1 = { ...newButton(ButtonStyle.Secondary), _id: "cnt_b1", label: "CB1" };
      const b2 = { ...newButton(ButtonStyle.Success), _id: "cnt_b2", label: "CB2" };
      const nestedRow = { _id: "nested_r", type: ComponentType.ActionRow, components: [b0, b1, b2] };
      const container = {
        _id: "c_root",
        type: ComponentType.Container,
        accent_color: 0xff0000,
        components: [nestedRow],
      };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [container], username: "", avatar_url: "", thread_name: "" },
      });

      // Move cnt_b1 left (-1) inside nested_r
      store.moveComponentById("cnt_b1", -1, "nested_r");

      const rootContainer = useMessageStore.getState().data.components[0];
      expect(rootContainer.accent_color).toBe(0xff0000); // Container intact
      const updatedNestedRow = rootContainer.components![0];
      expect(updatedNestedRow.components?.map((c) => c._id)).toEqual(["cnt_b1", "cnt_b0", "cnt_b2"]);
    });

    it("2.6. Isolates reordering: reordering in Row 1 does not affect Row 2", () => {
      const store = useMessageStore.getState();
      const r1_b0 = { ...newButton(ButtonStyle.Primary), _id: "r1_b0" };
      const r1_b1 = { ...newButton(ButtonStyle.Secondary), _id: "r1_b1" };
      const r2_b0 = { ...newButton(ButtonStyle.Success), _id: "r2_b0" };
      const r2_b1 = { ...newButton(ButtonStyle.Danger), _id: "r2_b1" };

      const row1 = { _id: "row_1", type: ComponentType.ActionRow, components: [r1_b0, r1_b1] };
      const row2 = { _id: "row_2", type: ComponentType.ActionRow, components: [r2_b0, r2_b1] };

      useMessageStore.setState({
        data: { content: "", embeds: [], components: [row1, row2], username: "", avatar_url: "", thread_name: "" },
      });

      store.moveComponentById("r1_b1", -1, "row_1");

      const comp1 = useMessageStore.getState().data.components[0].components!;
      const comp2 = useMessageStore.getState().data.components[1].components!;
      expect(comp1.map((c) => c._id)).toEqual(["r1_b1", "r1_b0"]);
      expect(comp2.map((c) => c._id)).toEqual(["r2_b0", "r2_b1"]); // Unchanged
    });

    it("2.7. buttonStylePatch cleanly toggles between Interactive and Link styles", () => {
      const btn = { ...newButton(ButtonStyle.Primary), custom_id: "action:my_flow" };

      // Switch to Link: custom_id dropped, url set, _action_custom_id preserved
      const linkPatch = buttonStylePatch(btn, ButtonStyle.Link);
      expect(linkPatch.style).toBe(ButtonStyle.Link);
      expect(linkPatch.url).toBe("https://discord.com");
      expect(linkPatch.custom_id).toBeUndefined();
      expect(linkPatch._action_custom_id).toBe("action:my_flow");

      // Switch back to Primary: custom_id restored from _action_custom_id, url cleared
      const switchedBtn: ComponentNode = { ...btn, ...linkPatch };
      const primaryPatch = buttonStylePatch(switchedBtn, ButtonStyle.Primary);
      expect(primaryPatch.style).toBe(ButtonStyle.Primary);
      expect(primaryPatch.custom_id).toBe("action:my_flow");
      expect(primaryPatch.url).toBeUndefined();
      expect(primaryPatch._action_custom_id).toBeUndefined();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     3. 5 Select Menu Types & Discord Wire Serialization
     ────────────────────────────────────────────────────────────────────────── */
  describe("3. 5 Select Menu Types & Discord Wire Serialization", () => {
    it("3.1. String Select (type 3): validates options and serializes correctly", () => {
      const strSelect = newStringSelect();
      expect(strSelect.type).toBe(ComponentType.StringSelect);
      expect(strSelect.type).toBe(3);
      expect(strSelect.options).toHaveLength(1);
      expect(strSelect.options![0].label).toBe("Option 1");

      const row = newActionRow([strSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toHaveLength(0);

      // Serialization in Classic mode
      const payload = toDiscordPayload({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(payload.components).toHaveLength(1);
      const wireRow = payload.components![0];
      expect(wireRow.type).toBe(ComponentType.ActionRow);
      expect(wireRow._id).toBeUndefined();
      const wireSelect = wireRow.components![0];
      expect(wireSelect.type).toBe(3);
      expect(wireSelect._id).toBeUndefined();
      expect(wireSelect.options![0]._id).toBeUndefined();
      expect(wireSelect.options![0].value).toBe("option_1");
    });

    it("3.2. String Select rejects empty options list", () => {
      const emptySelect: ComponentNode = {
        _id: "empty_sel",
        type: ComponentType.StringSelect,
        custom_id: "action:dud",
        options: [],
      };
      const row = newActionRow([emptySelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toContain("components[0]: String Select needs at least one option");
    });

    it("3.3. User Select (type 5): factory and wire serialization without requiring manual options", () => {
      const userSelect = newUserSelect();
      expect(userSelect.type).toBe(ComponentType.UserSelect);
      expect(userSelect.type).toBe(5);
      expect(userSelect.min_values).toBe(1);
      expect(userSelect.max_values).toBe(1);
      expect(userSelect.options).toBeUndefined();

      const row = newActionRow([userSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toHaveLength(0);

      const payload = toDiscordPayload({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      const wireSelect = payload.components![0].components![0];
      expect(wireSelect.type).toBe(5);
      expect(wireSelect._id).toBeUndefined();
      expect(wireSelect.placeholder).toBe("Select a user");
    });

    it("3.4. Role Select (type 6): factory and wire serialization", () => {
      const roleSelect = newRoleSelect();
      expect(roleSelect.type).toBe(ComponentType.RoleSelect);
      expect(roleSelect.type).toBe(6);
      expect(roleSelect.min_values).toBe(1);
      expect(roleSelect.max_values).toBe(1);

      const row = newActionRow([roleSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toHaveLength(0);

      const payload = toDiscordPayload({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      const wireSelect = payload.components![0].components![0];
      expect(wireSelect.type).toBe(6);
      expect(wireSelect.placeholder).toBe("Select a role");
    });

    it("3.5. Mentionable Select (type 7): factory and wire serialization", () => {
      const mentionableSelect = newMentionableSelect();
      expect(mentionableSelect.type).toBe(ComponentType.MentionableSelect);
      expect(mentionableSelect.type).toBe(7);
      expect(mentionableSelect.min_values).toBe(1);
      expect(mentionableSelect.max_values).toBe(1);

      const row = newActionRow([mentionableSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toHaveLength(0);

      const payload = toDiscordPayload({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      const wireSelect = payload.components![0].components![0];
      expect(wireSelect.type).toBe(7);
      expect(wireSelect.placeholder).toBe("Select a user or role");
    });

    it("3.6. Channel Select (type 8): factory and wire serialization", () => {
      const channelSelect = newChannelSelect();
      expect(channelSelect.type).toBe(ComponentType.ChannelSelect);
      expect(channelSelect.type).toBe(8);
      expect(channelSelect.min_values).toBe(1);
      expect(channelSelect.max_values).toBe(1);

      const row = newActionRow([channelSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toHaveLength(0);

      const payload = toDiscordPayload({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      const wireSelect = payload.components![0].components![0];
      expect(wireSelect.type).toBe(8);
      expect(wireSelect.placeholder).toBe("Select a channel");
    });

    it("3.7. Rejects select menu sharing an Action Row with another component", () => {
      const btn = newButton(ButtonStyle.Primary);
      const sel = newStringSelect();
      const mixedRow = newActionRow([btn, sel]);

      const errors = validateMessage({ content: "test", embeds: [], components: [mixedRow], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toContain("components[0]: A select menu must be alone in its Action Row");
    });

    it("3.8. Validates min_values and max_values boundaries across all select menus", () => {
      const badSelect = {
        ...newUserSelect(),
        min_values: 5,
        max_values: 2, // min > max is invalid
      };
      const row = newActionRow([badSelect]);
      const errors = validateMessage({ content: "test", embeds: [], components: [row], username: "", avatar_url: "", thread_name: "" }, "classic");
      expect(errors).toContain("components[0]: Minimum selections cannot exceed maximum selections");
    });

    it("3.9. isInteractiveComponent identifies all 5 select menus as interactive", () => {
      expect(isInteractiveComponent(newStringSelect())).toBe(true);
      expect(isInteractiveComponent(newUserSelect())).toBe(true);
      expect(isInteractiveComponent(newRoleSelect())).toBe(true);
      expect(isInteractiveComponent(newMentionableSelect())).toBe(true);
      expect(isInteractiveComponent(newChannelSelect())).toBe(true);

      // Link button and separator are not interactive
      expect(isInteractiveComponent(newButton(ButtonStyle.Link))).toBe(false);
      expect(isInteractiveComponent(newTextDisplay())).toBe(false);
    });

    it("3.10. Successfully holds and serializes all 5 distinct Select Menu types across 5 Action Rows", () => {
      const rows = [
        newActionRow([newStringSelect()]),
        newActionRow([newUserSelect()]),
        newActionRow([newRoleSelect()]),
        newActionRow([newMentionableSelect()]),
        newActionRow([newChannelSelect()]),
      ];

      const doc: MessageData = {
        content: "5 Distinct Select Menus",
        embeds: [],
        components: rows,
        username: "Bot",
        avatar_url: "",
        thread_name: "",
      };

      const errors = validateMessage(doc, "classic");
      expect(errors).toHaveLength(0);

      const payload = toDiscordPayload(doc, "classic");
      expect(payload.components).toHaveLength(5);
      const childTypes = payload.components!.map((r) => r.components![0].type);
      expect(childTypes).toEqual([3, 5, 6, 7, 8]);
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     4. Modal Input Limits, Reordering & Boundary Enforcement
     ────────────────────────────────────────────────────────────────────────── */
  describe("4. Modal Input Limits & Question Reordering", () => {
    // Model modal helper logic mirroring StepList contract
    const formatModalComponents = (fields: ModalInputField[]) => {
      return fields.slice(0, 5).map((field) => ({
        type: 1, // ActionRow
        components: [
          {
            type: 4, // TextInput
            custom_id: field.customId.trim() || `input_${Date.now()}`,
            label: field.label.trim() || "Question",
            style: field.style === 2 ? 2 : 1,
            placeholder: field.placeholder?.trim() || undefined,
            required: field.required !== false,
            min_length: field.minLength,
            max_length: field.maxLength,
          },
        ],
      }));
    };

    const moveInput = (list: ModalInputField[], idx: number, delta: number) => {
      const target = idx + delta;
      if (target < 0 || target >= list.length) return list;
      const next = [...list];
      const [removed] = next.splice(idx, 1);
      next.splice(target, 0, removed);
      return next;
    };

    it("4.1. Enforces exactly 5 maximum inputs when formatting modal payload", () => {
      const inputs: ModalInputField[] = Array.from({ length: 8 }, (_, i) => ({
        customId: `q_${i + 1}`,
        label: `Question ${i + 1}`,
        style: 1,
        required: true,
      }));

      const formatted = formatModalComponents(inputs);
      expect(formatted).toHaveLength(5); // Capped at exactly 5 Action Rows
      expect(formatted[0].components[0].custom_id).toBe("q_1");
      expect(formatted[4].components[0].custom_id).toBe("q_5");
    });

    it("4.2. Blocks moving top question up (idx 0, delta -1 is a no-op)", () => {
      const inputs: ModalInputField[] = [
        { customId: "q1", label: "Question 1", style: 1 },
        { customId: "q2", label: "Question 2", style: 2 },
      ];

      const result = moveInput(inputs, 0, -1);
      expect(result.map((q) => q.customId)).toEqual(["q1", "q2"]);
    });

    it("4.3. Blocks moving bottom question down (last idx, delta +1 is a no-op)", () => {
      const inputs: ModalInputField[] = [
        { customId: "q1", label: "Question 1", style: 1 },
        { customId: "q2", label: "Question 2", style: 2 },
      ];

      const result = moveInput(inputs, 1, 1);
      expect(result.map((q) => q.customId)).toEqual(["q1", "q2"]);
    });

    it("4.4. Preserves field attributes during middle question reordering", () => {
      const inputs: ModalInputField[] = [
        { customId: "q1", label: "Q1", style: 1, required: true, minLength: 5, maxLength: 50 },
        { customId: "q2", label: "Q2", style: 2, required: false, minLength: 0, maxLength: 1000 },
        { customId: "q3", label: "Q3", style: 1, required: true, placeholder: "Enter code" },
      ];

      // Move Q2 up
      const movedUp = moveInput(inputs, 1, -1);
      expect(movedUp.map((q) => q.customId)).toEqual(["q2", "q1", "q3"]);
      expect(movedUp[0].style).toBe(2);
      expect(movedUp[0].required).toBe(false);
      expect(movedUp[0].minLength).toBe(0);
      expect(movedUp[0].maxLength).toBe(1000);

      // Move Q2 down back to middle
      const movedDown = moveInput(movedUp, 0, 1);
      expect(movedDown.map((q) => q.customId)).toEqual(["q1", "q2", "q3"]);
      expect(movedDown[1].customId).toBe("q2");
    });

    it("4.5. Preserves boundary character limits: min_length: 0 and max_length: 4000", () => {
      const inputWithBoundaries: ModalInputField[] = [
        {
          customId: "code_review",
          label: "Your Feedback",
          style: 2,
          minLength: 0,
          maxLength: 4000,
        },
      ];

      const formatted = formatModalComponents(inputWithBoundaries);
      const textInput = formatted[0].components[0];
      expect(textInput.min_length).toBe(0);
      expect(textInput.max_length).toBe(4000);
      expect(textInput.type).toBe(4); // TextInput
    });

    it("4.6. Renders DiscordModalPreview mockup without throwing and displays questions", () => {
      const inputs: ModalInputField[] = [
        { customId: "f_name", label: "Full Name", style: 1, placeholder: "John Doe", required: true },
        { customId: "f_bio", label: "About You", style: 2, placeholder: "Paragraph...", required: false },
      ];

      const html = renderToStaticMarkup(
        createElement(DiscordModalPreview, {
          title: "Staff Application",
          inputs,
        })
      );

      expect(html).toContain("Staff Application");
      expect(html).toContain("Full Name");
      expect(html).toContain("About You");
      expect(html).toContain("Submit");
    });

    it("4.7. Renders empty DiscordModalPreview gracefully with fallback message", () => {
      const html = renderToStaticMarkup(
        createElement(DiscordModalPreview, {
          title: "Empty Form",
          inputs: [],
        })
      );

      expect(html).toContain("Empty Form");
      expect(html).toContain("No input fields added yet");
    });

    it("4.8. Registers modal flow and sub-chain registrations in useActionStore", () => {
      const store = useActionStore.getState();

      const modalStep: FlowStep = {
        _id: "step_modal_1",
        type: "open_modal",
        config: {
          title: "Feedback Form",
          customId: "modal_feedback",
          components: formatModalComponents([
            { customId: "input_comment", label: "Comment", style: 2, required: true },
          ]),
          then: [
            {
              _id: "step_reply_1",
              type: "send_ephemeral_reply",
              config: { content: "Thank you for submitting!" },
            },
          ],
        },
      };

      store.setFlow("btn_trigger", [modalStep]);

      const registrations = store.toRegistrations();
      expect(registrations.length).toBeGreaterThanOrEqual(2);

      // Registration 1: Button flow
      const btnReg = registrations.find((r) => r.customId === "btn_trigger");
      expect(btnReg).toBeDefined();
      expect(btnReg!.steps[0].type).toBe("open_modal");

      // Registration 2: Modal submit handler registered under modal customId
      const modalReg = registrations.find((r) => r.customId === "modal_feedback");
      expect(modalReg).toBeDefined();
      expect(modalReg!.steps[0].type).toBe("send_ephemeral_reply");
      expect(modalReg!.steps[0].config.content).toBe("Thank you for submitting!");
      // Verified _id stripped recursively
      expect((modalReg!.steps[0] as any)._id).toBeUndefined();
    });
  });

  /* ──────────────────────────────────────────────────────────────────────────
     5. Payload Serialization & stripInternal Deep Cleansing
     ────────────────────────────────────────────────────────────────────────── */
  describe("5. Payload Serialization & stripInternal Deep Cleansing", () => {
    it("5.1. Recursively drops _id and _action_custom_id from deep trees", () => {
      const deeplyNested = {
        _id: "root_id",
        _action_custom_id: "action_1",
        type: ComponentType.Container,
        components: [
          {
            _id: "child_id_1",
            type: ComponentType.Container,
            components: [
              {
                _id: "row_id",
                type: ComponentType.ActionRow,
                components: [
                  {
                    _id: "btn_id",
                    _action_custom_id: "stashed_id",
                    type: ComponentType.Button,
                    label: "Deep Button",
                    custom_id: "action:deep",
                  },
                ],
              },
            ],
          },
        ],
      };

      const stripped = stripInternal(deeplyNested) as any;
      const jsonStr = JSON.stringify(stripped);

      expect(jsonStr).not.toMatch(/"_id"\s*:/);
      expect(jsonStr).not.toMatch(/"_action[^"]*"\s*:/);
      expect(stripped.components[0].components[0].components[0].custom_id).toBe("action:deep");
      expect(stripped.components[0].components[0].components[0].label).toBe("Deep Button");
    });

    it("5.2. Cleanses _id from select menu options and media gallery items", () => {
      const complexComponent: ComponentNode = {
        _id: "select_comp",
        type: ComponentType.StringSelect,
        custom_id: "action:dud",
        options: [
          { _id: "opt_1", label: "Label 1", value: "val_1" },
          { _id: "opt_2", label: "Label 2", value: "val_2" },
        ],
      };

      const stripped = stripInternal(complexComponent) as any;
      expect(stripped._id).toBeUndefined();
      expect(stripped.options[0]._id).toBeUndefined();
      expect(stripped.options[1]._id).toBeUndefined();
      expect(stripped.options[0].value).toBe("val_1");
    });

    it("5.3. Cleanses _id from embed fields", () => {
      const embedWithFields = {
        _id: "embed_1",
        title: "Title",
        description: "Desc",
        fields: [
          { _id: "f_1", name: "Field 1", value: "Val 1", inline: true },
          { _id: "f_2", name: "Field 2", value: "Val 2", inline: false },
        ],
      };

      const stripped = stripInternal(embedWithFields) as any;
      expect(stripped._id).toBeUndefined();
      expect(stripped.fields[0]._id).toBeUndefined();
      expect(stripped.fields[1]._id).toBeUndefined();
      expect(stripped.fields[0].name).toBe("Field 1");
    });

    it("5.4. Preserves null values while discarding undefined values", () => {
      const objWithNullAndUndefined = {
        _id: "drop_me",
        accent_color: null,
        description: undefined,
        title: "Hello",
      };

      const stripped = stripInternal(objWithNullAndUndefined) as any;
      expect(stripped._id).toBeUndefined();
      expect(stripped.accent_color).toBeNull();
      expect("description" in stripped).toBe(false);
      expect(stripped.title).toBe("Hello");
    });

    it("5.5. toDiscordPayload in classic mode strips embeds and filters non-ActionRow components", () => {
      const doc: MessageData = {
        content: "Classic Message",
        embeds: [
          {
            _id: "emb_id",
            title: "Classic Embed",
            fields: [{ _id: "f1", name: "Name", value: "Value" }],
          },
        ],
        components: [
          { _id: "text_comp", type: ComponentType.TextDisplay, content: "Ignore in classic" },
          {
            _id: "row_comp",
            type: ComponentType.ActionRow,
            components: [{ _id: "btn_1", type: ComponentType.Button, label: "Click", custom_id: "action:dud" }],
          },
        ],
        username: "ClassicBot",
        avatar_url: "https://example.com/avatar.png",
        thread_name: "thread-name",
      };

      const payload = toDiscordPayload(doc, "classic");
      expect(payload.content).toBe("Classic Message");
      expect(payload.username).toBe("ClassicBot");
      expect(payload.avatar_url).toBe("https://example.com/avatar.png");
      expect(payload.thread_name).toBe("thread-name");
      expect(payload.flags).toBeUndefined();

      // Only ActionRow preserved, TextDisplay ignored
      expect(payload.components).toHaveLength(1);
      expect(payload.components![0].type).toBe(ComponentType.ActionRow);
      expect(payload.components![0]._id).toBeUndefined();

      // Embed stripped of _id
      expect(payload.embeds).toHaveLength(1);
      expect(payload.embeds![0]._id).toBeUndefined();
      expect(payload.embeds![0].fields![0]._id).toBeUndefined();
    });

    it("5.6. toDiscordPayload in v2 mode includes IsComponentsV2 flag and omits classic content/embeds", () => {
      const doc: MessageData = {
        content: "Should not be on wire in V2",
        embeds: [{ title: "Should not be on wire in V2" }],
        components: [
          { _id: "c1", type: ComponentType.Container, components: [] },
          { _id: "r1", type: ComponentType.ActionRow, components: [] },
        ],
        username: "V2Bot",
        avatar_url: "",
        thread_name: "",
      };

      const payload = toDiscordPayload(doc, "v2");
      expect(payload.flags).toBe(MessageFlags.IsComponentsV2);
      expect(payload.content).toBeUndefined();
      expect(payload.embeds).toBeUndefined();
      expect(payload.components).toHaveLength(2);
      expect(payload.components![0]._id).toBeUndefined();
      expect(payload.components![1]._id).toBeUndefined();
    });

    it("5.7. Correctly detects empty payloads using isPayloadEmpty", () => {
      expect(isPayloadEmpty({})).toBe(true);
      expect(isPayloadEmpty({ content: "" })).toBe(true);
      expect(isPayloadEmpty({ embeds: [] })).toBe(true);
      expect(isPayloadEmpty({ components: [] })).toBe(true);

      expect(isPayloadEmpty({ content: "Hello" })).toBe(false);
      expect(isPayloadEmpty({ embeds: [{ title: "T" }] })).toBe(false);
      expect(isPayloadEmpty({ components: [newActionRow()] })).toBe(false);
    });
  });
});
