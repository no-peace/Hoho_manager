import { Plus, Trash2 } from "lucide-react";
// Aliased because `ComponentType` below is Discord's numeric component enum.
import type { ComponentType as ReactComponentType } from "react";
import type { ComponentNode, GalleryItem, SelectOption } from "@dmb/shared";
import { ButtonStyle, ComponentType, Limits } from "@dmb/shared";
import { Button, IconButton } from "../ui/Button";
import { Checkbox, Select, TextArea, TextField } from "../ui/Field";
import { ColorPicker } from "../ui/ColorPicker";
import { BUTTON_STYLE_LABELS, uid } from "../../utils/constants";
import { newGalleryItem } from "../../utils/componentsV2";

/**
 * Property forms, one per component type.
 *
 * `COMPONENT_FORMS` maps a Discord component type to the form that edits it, so
 * the property panel is a single lookup rather than a long conditional. Every
 * form edits through an `update` callback the panel supplies, which routes to
 * `updateComponentById` and walks the tree by `_id`.
 */

export interface ComponentFormProps {
  component: ComponentNode;
  update: (patch: Partial<ComponentNode>) => void;
}

/* ── Content ──────────────────────────────────────────────────────────────── */

const TextDisplayForm = ({ component, update }: ComponentFormProps) => (
  <TextArea
    label="Content"
    limit={Limits.components.textDisplay}
    rows={5}
    value={component.content ?? ""}
    placeholder="**Bold**, *italic*, # heading, - lists — markdown is supported."
    onChange={(event) => update({ content: event.target.value })}
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
          // Rebuilt rather than spread, so the accessory always keeps a `type`
          // even when the section was imported without one.
          accessory: {
            _id: component.accessory?._id ?? uid(),
            type: component.accessory?.type ?? ComponentType.Thumbnail,
            media: { url: event.target.value },
          },
        })
      }
    />
    <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
      Section text is edited in the component tree on the left. A section holds up to three
      text displays plus one accessory.
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
        <span className="field-label !mb-0">Gallery items</span>
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
        <p className="text-[11px] text-ink-faint">No images yet. Add one to start the gallery.</p>
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
    <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
      {component.components?.length ?? 0} child component(s). Use the palette on the left to add
      more while this container is selected.
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

const ActionRowForm = ({ component }: ComponentFormProps) => (
  <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
    {component.components?.length ?? 0} control(s). An action row holds up to{" "}
    {Limits.components.actionRowButtons} buttons, or a single select menu.
  </p>
);

/* ── Interactive ──────────────────────────────────────────────────────────── */

const ButtonForm = ({ component, update }: ComponentFormProps) => {
  const isLink = component.style === ButtonStyle.Link;

  return (
    <>
      <TextField
        label="Label"
        limit={Limits.components.label}
        value={component.label ?? ""}
        onChange={(event) => update({ label: event.target.value })}
      />

      <Select
        label="Style"
        value={String(component.style ?? ButtonStyle.Primary)}
        onChange={(event) => update({ style: Number(event.target.value) })}
        options={Object.entries(BUTTON_STYLE_LABELS).map(([value, label]) => ({ value, label }))}
      />

      {isLink ? (
        <TextField
          label="URL"
          value={component.url ?? ""}
          placeholder="https://discord.com"
          onChange={(event) => update({ url: event.target.value })}
        />
      ) : (
        <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
          What this button does is configured on the <span className="text-ink">Flow</span> tab
          above.
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
        onChange={(event) => update({ placeholder: event.target.value })}
      />

      <div className="mb-1.5 flex items-center justify-between">
        <span className="field-label !mb-0">Options</span>
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
            <TextField
              className="flex-1"
              label={`Option ${index + 1}`}
              value={option.label}
              onChange={(event) => replaceOption(index, { label: event.target.value })}
            />
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

      <p className="rounded bg-chrome px-2 py-1.5 text-[11px] text-ink-faint">
        What this select does is configured on the <span className="text-ink">Flow</span> tab
        above.
      </p>
    </>
  );
};

/**
 * Selection menus share one form: the placeholder/action fields are identical,
 * and the option list only applies to string selects.
 */
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
  [ComponentType.UserSelect]: StringSelectForm,
  [ComponentType.RoleSelect]: StringSelectForm,
  [ComponentType.MentionableSelect]: StringSelectForm,
  [ComponentType.ChannelSelect]: StringSelectForm,
};

export default COMPONENT_FORMS;
