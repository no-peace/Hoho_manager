import { useState } from "react";
import { Layers, Send, Shapes } from "lucide-react";
import { ComponentPalette } from "../editor/ComponentPalette";
import { LayersPanel } from "../editor/LayersPanel";
import { SendPanel } from "../send/SendPanel";
import type { IconComponent } from "../ui/icon";

/**
 * The left rail.
 *
 * Two concerns share the space: authoring (palette + layers) and delivery (send
 * settings). A vertical tab rail — Discohook's editor pattern — keeps both
 * reachable without cramming the column.
 */

interface RailTab {
  id: string;
  label: string;
  icon: IconComponent;
}

const TABS: readonly RailTab[] = [
  { id: "build", label: "Build", icon: Shapes },
  { id: "send", label: "Send", icon: Send },
];

export const Sidebar = () => {
  const [tab, setTab] = useState<string>("build");

  return (
    <aside className="flex w-72 shrink-0 flex-col border-r border-line bg-chrome">
      <div className="tab-rail m-3 flex-col items-stretch">
        {TABS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={[
              "tab-item flex w-full items-center gap-2 text-start",
              tab === id ? "tab-item-active" : "tab-item-idle",
            ].join(" ")}
          >
            <Icon size={14} aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">
        {tab === "build" ? (
          <div className="space-y-5">
            <ComponentPalette />

            <section>
              <h3 className="field-label flex items-center gap-1.5">
                <Layers size={13} /> Layers
              </h3>
              <LayersPanel />
            </section>
          </div>
        ) : (
          <SendPanel />
        )}
      </div>
    </aside>
  );
};

export default Sidebar;
