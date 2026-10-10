import type { ComponentType as ReactComponentType } from "react";
import type { ComponentNode, GalleryItem, SelectOption } from "@dmb/shared";
import { ButtonStyle, ComponentType, Limits } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, Select, TextField } from "../ui/Field";
import { ColorPicker } from "../ui/ColorPicker";
import { DiscordMentionInput } from "./DiscordMentionInput";
import { BUTTON_STYLE_LABELS, uid } from "../../utils/constants";
import { buttonStylePatch, newGalleryItem } from "../../utils/componentsV2";
import { Plus, Trash2 } from "lucide-react";

export interface ComponentFormProps {
  component: ComponentNode;
  update: (patch: Partial<ComponentNode>) => void;
}

/* ── Content ──────────────────────────────────────────────────────────────── */

const TextDisplayForm = ({ component, update }: ComponentFormProps) => (
  <DiscordMentionInput
    label="Content"
    maxLength={Limits.components.textDisplay}
    rows={5}
    value={component.content ?? ""}
    placeholder="**Bold**, *italic*, # heading, - lists — markdown and mentions (@, #, :) are supported."
    onChange={(content) => update({ content })}
  />
);

const SectionForm = ({ component, update }: ComponentFormProps) => (
  <>
    <TextField
      label="Thumbnail URL"
      value={component.accessory?.media?.url ?? ""}
      placeholder="https://…"
      onChange={(event) =>
        update({
          accessory: {
            _id: component.accessory?._id ?? uid(),
            type: component.accessory?.type ?? ComponentType.Thumbnail,
            media: { url: event.target.value },
          },
        })
      }
    />
    <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4]">
      Section text items are individual TextDisplay components. Click on any TextDisplay child in
      the tree to edit its markdown, mentions, or timestamps.
    </p>
  </>
);

const MediaGalleryForm = ({ component, update }: ComponentFormProps) => {
  const items = component.items ?? [];

  const replaceItem = (index: number, patch: Partial<GalleryItem>): void => {
    const next = [...items];
    const existing = next[index];
    if (!existing) return;
    next[index] = { ...existing, ...patch };
    update({ items: next });
  };

  return (
    <>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
          Gallery items
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onClick={() => update({ items: [...items, newGalleryItem()] })}
        >
          Add
        </Button>
      </div>

      {items.length === 0 && (
        <p className="text-[11px] text-[#949ba4]">No images yet. Add one to start the gallery.</p>
      )}

      <div className="space-y-2">
        {items.map((item, index) => (
          <div key={item._id} className="flex items-end gap-2">
            <TextField
              className="flex-1"
              label={`Image ${index + 1}`}
              value={item.media.url}
              placeholder="https://…"
              onChange={(event) => replaceItem(index, { media: { url: event.target.value } })}
            />
            <IconButton
              icon={Trash2}
              label="Remove item"
              onClick={() => update({ items: items.filter((entry) => entry._id !== item._id) })}
            />
          </div>
        ))}
      </div>
    </>
  );
};

const FileForm = ({ component, update }: ComponentFormProps) => (
  <TextField
    label="File URL"
    value={component.file?.url ?? ""}
    placeholder="attachment://image.png or https://…"
    onChange={(event) => update({ file: { url: event.target.value } })}
  />
);

/* ── Layout ───────────────────────────────────────────────────────────────── */

const ContainerForm = ({ component, update }: ComponentFormProps) => (
  <>
    <ColorPicker
      label="Accent colour"
      value={component.accent_color ?? null}
      onChange={(accent_color) => update({ accent_color })}
    />
    <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4]">
      {component.components?.length ?? 0} child component(s). Use the inline "+ Add Component to
      Container" button on the canvas to add elements into this container.
    </p>
  </>
);

const SeparatorForm = ({ component, update }: ComponentFormProps) => (
  <>
    <Checkbox
      label="Show divider line"
      checked={component.divider !== false}
      onChange={(divider) => update({ divider })}
    />
    <Select
      label="Spacing"
      value={String(component.spacing ?? 1)}
      onChange={(event) => update({ spacing: Number(event.target.value) })}
      options={[
        { value: "1", label: "Small" },
        { value: "2", label: "Large" },
      ]}
    />
  </>
);

const ActionRowForm = ({ component, update }: ComponentFormProps) => {
  const children = component.components ?? [];

  const addChild = (type: number) => {
    update({
      components: [
        ...children,
        { _id: uid(), type, config: {} } as ComponentNode,
      ],
    });
  };

  return (
    <>
      <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4] mb-2">
        {children.length} control(s). An action row holds up to {Limits.components.actionRowButtons}{" "}
        buttons, or a single select menu.
      </p>
      <div className="flex gap-2">
        <Button
          size="sm"
          variant="secondary"
          disabled={
            children.length >= Limits.components.actionRowButtons ||
            children.some((c) => c.type !== ComponentType.Button)
          }
          onClick={() => addChild(ComponentType.Button)}
        >
          Add Button
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={children.length > 0}
          onClick={() => addChild(ComponentType.StringSelect)}
        >
          Add Select
        </Button>
      </div>
    </>
  );
};

/* ── Interactive (Strict Plain Text Labels) ────────────────────────────────── */

const ButtonForm = ({ component, update }: ComponentFormProps) => {
  const isLink = component.style === ButtonStyle.Link;
  const isPremium = component.style === ButtonStyle.Premium;

  return (
    <>
      <TextField
        label="Label"
        limit={Limits.components.label}
        value={component.label ?? ""}
        placeholder="Button Text"
        onChange={(event) => update({ label: event.target.value })}
      />

      <Select
        label="Style"
        value={String(component.style ?? ButtonStyle.Primary)}
        onChange={(event) => update(buttonStylePatch(component, Number(event.target.value)))}
        options={Object.entries(BUTTON_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
      />

      {isLink ? (
        <TextField
          label="URL"
          value={component.url ?? ""}
          placeholder="https://discord.com"
          onChange={(event) => update({ url: event.target.value })}
        />
      ) : isPremium ? (
        <TextField
          label="SKU ID"
          value={component.sku_id ?? ""}
          placeholder="Discord store item ID"
          onChange={(event) => update({ sku_id: event.target.value })}
        />
      ) : (
        <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4]">
          What this button executes is configured on the <span className="text-white font-semibold">Flow</span> tab above.
        </p>
      )}

      <Checkbox
        label="Disabled"
        checked={Boolean(component.disabled)}
        onChange={(disabled) => update({ disabled })}
      />
    </>
  );
};

const StringSelectForm = ({ component, update }: ComponentFormProps) => {
  const options = component.options ?? [];

  const replaceOption = (index: number, patch: Partial<SelectOption>): void => {
    const next = [...options];
    const existing = next[index];
    if (!existing) return;
    next[index] = { ...existing, ...patch };
    update({ options: next });
  };

  return (
    <>
      <TextField
        label="Placeholder"
        limit={Limits.components.placeholder}
        value={component.placeholder ?? ""}
        placeholder="Choose an option…"
        onChange={(event) => update({ placeholder: event.target.value })}
      />

      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wider text-[#949ba4]">
          Options
        </span>
        <Button
          size="sm"
          variant="ghost"
          icon={Plus}
          onClick={() =>
            update({
              options: [
                ...options,
                { _id: uid(), label: "Option", value: `option_${options.length + 1}` },
              ],
            })
          }
        >
          Add
        </Button>
      </div>

      <div className="space-y-2">
        {options.map((option, index) => (
          <div key={option._id} className="flex items-end gap-2">
            <div className="grid min-w-0 flex-1 grid-cols-2 gap-2">
              <TextField
                label={`Option ${index + 1} label`}
                limit={Limits.components.selectOptionLabel}
                value={option.label}
                onChange={(event) => replaceOption(index, { label: event.target.value })}
              />
              <TextField
                label="Value"
                limit={Limits.components.selectOptionLabel}
                value={option.value}
                onChange={(event) => replaceOption(index, { value: event.target.value })}
              />
            </div>
            <IconButton
              icon={Trash2}
              label="Remove option"
              onClick={() => update({ options: options.filter((entry) => entry._id !== option._id) })}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <TextField
          label="Min values"
          type="number"
          min={0}
          value={component.min_values ?? 1}
          onChange={(event) => update({ min_values: Number(event.target.value) })}
        />
        <TextField
          label="Max values"
          type="number"
          min={1}
          value={component.max_values ?? 1}
          onChange={(event) => update({ max_values: Number(event.target.value) })}
        />
      </div>

      <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4]">
        What this select triggers is configured on the <span className="text-white font-semibold">Flow</span> tab above.
      </p>
    </>
  );
};

const EntitySelectForm = ({ component, update }: ComponentFormProps) => (
  <>
    <TextField
      label="Placeholder"
      limit={Limits.components.placeholder}
      value={component.placeholder ?? ""}
      onChange={(event) => update({ placeholder: event.target.value })}
    />

    <div className="grid grid-cols-2 gap-2">
      <TextField
        label="Min values"
        type="number"
        min={0}
        max={Limits.components.options}
        value={component.min_values ?? 1}
        onChange={(event) => update({ min_values: Number(event.target.value) })}
      />
      <TextField
        label="Max values"
        type="number"
        min={1}
        max={Limits.components.options}
        value={component.max_values ?? 1}
        onChange={(event) => update({ max_values: Number(event.target.value) })}
      />
    </div>

    <p className="rounded bg-[#1e1f22] border border-[#232428] px-2.5 py-2 text-[11px] text-[#949ba4]">
      Discord supplies the available users, roles, or channels when this menu opens.
    </p>
  </>
);

export const COMPONENT_FORMS: Record<number, ReactComponentType<ComponentFormProps>> = {
  [ComponentType.TextDisplay]: TextDisplayForm,
  [ComponentType.Section]: SectionForm,
  [ComponentType.MediaGallery]: MediaGalleryForm,
  [ComponentType.File]: FileForm,
  [ComponentType.Container]: ContainerForm,
  [ComponentType.Separator]: SeparatorForm,
  [ComponentType.ActionRow]: ActionRowForm,
  [ComponentType.Button]: ButtonForm,
  [ComponentType.StringSelect]: StringSelectForm,
  [ComponentType.UserSelect]: EntitySelectForm,
  [ComponentType.RoleSelect]: EntitySelectForm,
  [ComponentType.MentionableSelect]: EntitySelectForm,
  [ComponentType.ChannelSelect]: EntitySelectForm,
};

export default COMPONENT_FORMS;