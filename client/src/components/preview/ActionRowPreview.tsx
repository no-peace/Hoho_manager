import { ChevronDown, ExternalLink } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { ButtonStyle, ComponentType } from "@dmb/shared";

/**
 * Preview of an action row's controls.
 *
 * Buttons render with Discord's real colours so the preview communicates what a
 * click will *feel* like — a red "Danger" button reads very differently from a
 * blurple primary one, and that matters during design.
 */

const BUTTON_CLASSES: Record<number, string> = {
  [ButtonStyle.Primary]: "bg-[#5865f2] hover:bg-[#4752c4] text-white",
  [ButtonStyle.Secondary]: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  [ButtonStyle.Success]: "bg-[#248046] hover:bg-[#1a6334] text-white",
  [ButtonStyle.Danger]: "bg-[#da373c] hover:bg-[#a12828] text-white",
  [ButtonStyle.Link]: "bg-[#4e5058] hover:bg-[#6d6f78] text-white",
  [ButtonStyle.Premium]: "bg-[#4e5058] text-white",
};

const SELECT_TYPES: readonly number[] = [
  ComponentType.StringSelect,
  ComponentType.UserSelect,
  ComponentType.RoleSelect,
  ComponentType.ChannelSelect,
  ComponentType.MentionableSelect,
];

const ButtonPreview = ({ button }: { button: ComponentNode }) => {
  const isLink = button.style === ButtonStyle.Link;

  return (
    <button
      type="button"
      disabled={button.disabled}
      className={[
        "inline-flex h-8 items-center gap-1.5 rounded px-4 text-sm font-medium transition-colors",
        BUTTON_CLASSES[button.style ?? ButtonStyle.Primary] ?? BUTTON_CLASSES[ButtonStyle.Primary],
        button.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
    >
      {isLink && <ExternalLink size={14} />}
      {button.label ?? (isLink ? "Link" : "Button")}
    </button>
  );
};

const SelectPreview = ({ select }: { select: ComponentNode }) => (
  <div className="flex h-10 w-full max-w-[400px] items-center justify-between rounded border border-[#3f4147] bg-[#1e1f22] px-3 text-sm text-[#949ba4]">
    <span>{select.placeholder ?? "Make a selection"}</span>
    <ChevronDown size={16} />
  </div>
);

export interface ActionRowPreviewProps {
  component: ComponentNode;
}

export const ActionRowPreview = ({ component }: ActionRowPreviewProps) => (
  <div className="flex flex-wrap items-center gap-2">
    {(component.components ?? []).map((child) =>
      SELECT_TYPES.includes(child.type) ? (
        <SelectPreview key={child._id} select={child} />
      ) : (
        <ButtonPreview key={child._id} button={child} />
      ),
    )}
  </div>
);

export default ActionRowPreview;
