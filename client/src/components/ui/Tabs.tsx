import type { ReactNode } from "react";
import type { IconComponent } from "./icon";

/**
 * Tabs.
 *
 * Purely presentational — the caller owns which tab is active, which keeps this
 * usable for both the sidebar sections and the property panel's context tabs.
 */
export interface TabDef {
  id: string;
  label: string;
  icon?: IconComponent;
  badge?: ReactNode;
}

export interface TabsProps {
  tabs: readonly TabDef[];
  activeId: string;
  onChange: (id: string) => void;
  className?: string;
}

export const Tabs = ({ tabs, activeId, onChange, className = "" }: TabsProps) => (
  <div role="tablist" className={`flex gap-1 border-b border-line-soft ${className}`}>
    {tabs.map((tab) => {
      const active = tab.id === activeId;
      const Icon = tab.icon;
      return (
        <button
          key={tab.id}
          role="tab"
          type="button"
          aria-selected={active}
          onClick={() => onChange(tab.id)}
          className={[
            "relative -mb-px flex items-center gap-1.5 px-3 py-2 text-xs font-semibold transition-colors",
            active
              ? "border-b-2 border-blurple text-ink-strong"
              : "border-b-2 border-transparent text-ink-muted hover:text-ink",
          ].join(" ")}
        >
          {Icon && <Icon size={13} aria-hidden="true" />}
          {tab.label}
          {tab.badge != null && (
            <span className="rounded-full bg-raised px-1.5 text-[10px] text-ink-muted">
              {tab.badge}
            </span>
          )}
        </button>
      );
    })}
  </div>
);

export default Tabs;
