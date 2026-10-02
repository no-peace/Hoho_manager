import {
  AlignLeft,
  AtSign,
  AppWindow,
  Hash,
  Image as ImageIcon,
  LayoutGrid,
  ListFilter,
  Minus,
  MousePointerClick,
  Paperclip,
  Shield,
  UserRound,
} from "lucide-react";
import { ComponentType } from "@dmb/shared";
import {
  COMPONENT_DEFS,
  canAddToActionRow,
  canNestIn,
  type ComponentGroup,
} from "../../utils/componentsV2";
import { findComponent } from "../../utils/tree";
import { useMessageStore } from "../../store/messageStore";
import type { IconComponent } from "../ui/icon";

/**
 * Palette of Components V2 blocks.
 *
 * Insertion is selection-aware: if the selected component is a valid parent (a
 * Container or ActionRow) the new component nests inside it, which is how users
 * expect an editor to behave. Incompatible types are disabled rather than hidden,
 * so the layout doesn't jump around while clicking.
 */

const ICONS: Record<number, IconComponent> = {
  [ComponentType.TextDisplay]: AlignLeft,
  [ComponentType.Section]: LayoutGrid,
  [ComponentType.MediaGallery]: ImageIcon,
  [ComponentType.File]: Paperclip,
  [ComponentType.Separator]: Minus,
  [ComponentType.Container]: AppWindow,
  [ComponentType.ActionRow]: MousePointerClick,
  [ComponentType.Button]: MousePointerClick,
  [ComponentType.StringSelect]: ListFilter,
  [ComponentType.UserSelect]: UserRound,
  [ComponentType.RoleSelect]: Shield,
  [ComponentType.MentionableSelect]: AtSign,
  [ComponentType.ChannelSelect]: Hash,
};

export const ComponentPalette = () => {
  const addComponent = useMessageStore((state) => state.addComponent);
  const selection = useMessageStore((state) => state.selection);
  const components = useMessageStore((state) => state.data.components);

  // Only a component selection can act as a nesting target.
  const selected =
    selection?.kind === "component" ? findComponent(components, selection.id) : null;

  const groups = COMPONENT_DEFS.reduce<Record<string, typeof COMPONENT_DEFS[number][]>>(
    (accumulator, def) => {
      (accumulator[def.group] ??= []).push(def);
      return accumulator;
    },
    {},
  );

  return (
    <div className="space-y-4">
      {selected && (
        <p className="rounded-md bg-raised px-2 py-1.5 text-[11px] text-ink-muted">
          Adding inside{" "}
          <span className="text-ink">
            {selected.type === ComponentType.ActionRow
              ? "Action Row"
              : selected.type === ComponentType.Section
                ? "Section"
                : "Container"}
          </span>
          . Select nothing to add at the top level.
        </p>
      )}

      {(Object.entries(groups) as [ComponentGroup, typeof COMPONENT_DEFS[number][]][]).map(
        ([group, defs]) => (
          <section key={group}>
            <h3 className="field-label">{group}</h3>
            <div className="space-y-1.5">
              {defs.map((def) => {
                const Icon = ICONS[def.type];
                const nests = selected ? canNestIn(selected.type, def.type) : false;
                const rowControls = selected?.type === ComponentType.ActionRow
                  ? selected.components ?? []
                  : [];
                const rowAllowsChild =
                  selected?.type !== ComponentType.ActionRow ||
                  canAddToActionRow(rowControls, def.type);
                const disabled = selected ? !nests || !rowAllowsChild : !def.topLevel;

                return (
                  <button
                    key={def.type}
                    type="button"
                    disabled={disabled}
                    onClick={() => addComponent(def.type, nests ? (selected?._id ?? null) : null)}
                    className={[
                      "flex w-full items-start gap-2.5 rounded-lg border px-2.5 py-2 text-left transition-colors",
                      disabled
                        ? "cursor-not-allowed border-line-soft/50 opacity-40"
                        : "border-line-soft bg-raised hover:border-blurple hover:bg-hover",
                    ].join(" ")}
                  >
                    {Icon && <Icon size={15} className="mt-0.5 shrink-0 text-blurple" />}
                    <span className="min-w-0">
                      <span className="block text-xs font-semibold text-ink">{def.label}</span>
                      <span className="block text-[11px] leading-snug text-ink-muted">
                        {def.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        ),
      )}
    </div>
  );
};

export default ComponentPalette;
