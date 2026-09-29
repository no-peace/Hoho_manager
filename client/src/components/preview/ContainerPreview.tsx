import type { ComponentNode } from "@dmb/shared";
import { AutoComponent } from "./ComponentPreview";
import { decimalToHex } from "../../utils/discord";

/**
 * Container preview.
 *
 * Discord renders containers as a rounded card with an optional solid accent bar
 * down the left edge — implemented here with an absolutely positioned element
 * rather than a border, because a border would be clipped by the rounded corners.
 */
export interface ContainerPreviewProps {
  component: ComponentNode;
}

export const ContainerPreview = ({ component }: ContainerPreviewProps) => {
  const hasAccent = component.accent_color != null;

  return (
    <div className="relative max-w-[520px] overflow-hidden rounded-lg border border-[#3f4147] bg-[#2b2d31] p-4 pl-5">
      {hasAccent && (
        <span
          className="absolute inset-y-0 left-0 w-1"
          style={{ backgroundColor: decimalToHex(component.accent_color) }}
        />
      )}

      <div className="space-y-2">
        {(component.components ?? []).map((child) => (
          <AutoComponent key={child._id} component={child} />
        ))}
      </div>
    </div>
  );
};

export default ContainerPreview;
