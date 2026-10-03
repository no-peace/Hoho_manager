import { useEffect, useState } from "react";
import { Bot, Eye, Info } from "lucide-react";
import type { ComponentNode } from "@dmb/shared";
import { ComponentType, MessageFlags } from "@dmb/shared";
import { Markdown } from "./Markdown";
import { EmbedPreview } from "./EmbedPreview";
import { ContainerPreview } from "./ContainerPreview";
import { AutoComponent } from "./ComponentPreview";
import { useMessage } from "../../hooks/useMessage";
import { useGlobalStore } from "../../store/globalStore";
import { EDITOR_MODES } from "../../utils/constants";

/**
 * Live preview of the message as Discord would render it.
 *
 * This is the feedback loop that makes the editor usable, so it aims for visual
 * fidelity rather than structural reuse: embeds, Components V2 blocks and the
 * message chrome are all reproduced with Discord's real colours and spacing.
 *
 * The clock is captured once on mount and refreshed on a timer so the preview
 * doesn't jitter on every keystroke.
 */
const TopLevelComponent = ({ component }: { component: ComponentNode }) =>
  component.type === ComponentType.Container ? (
    <ContainerPreview component={component} />
  ) : (
    <AutoComponent component={component} />
  );

export const MessagePreview = () => {
  const { mode, data, payload, isEmpty } = useMessage();
  const { botIdentity } = useGlobalStore();
  const [now, setNow] = useState(() => new Date());

  // Refresh the "Today at …" label every minute.
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  const defaultDiscordAvatar = (() => {
    if (!botIdentity?.id || !/^\d+$/.test(botIdentity.id)) return null;
    try {
      return `https://cdn.discordapp.com/embed/avatars/${(BigInt(botIdentity.id) >> 22n) % 6n}.png`;
    } catch {
      return null;
    }
  })();
  const effectiveAvatar =
    data.avatar_url || botIdentity?.avatar || defaultDiscordAvatar;
  const effectiveUsername =
    data.username || botIdentity?.username || "Message Builder";
  const isV2 = mode === EDITOR_MODES.V2;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-line bg-chrome px-4 py-2.5">
        <h2 className="flex items-center gap-1.5 text-sm font-semibold text-ink-strong">
          <Eye size={14} /> Preview
        </h2>
        <span className="rounded-md bg-raised px-2 py-0.5 text-[10px] font-medium text-ink-muted">
          {isV2 ? "Components V2" : "Classic"}
        </span>
      </div>

      {/* Discord's chat background, kept literal so the preview reads as Discord. */}
      <div className="min-h-0 flex-1 overflow-y-auto bg-[#313338] p-4">
        {isEmpty ? (
          <p className="flex items-center gap-2 text-xs text-ink-faint">
            <Info size={13} /> Nothing to preview yet.
          </p>
        ) : (
          <div className="flex gap-3">
            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-blurple">
              {effectiveAvatar ? (
                <img
                  src={effectiveAvatar}
                  alt=""
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    if (defaultDiscordAvatar && e.currentTarget.src !== defaultDiscordAvatar) {
                      e.currentTarget.src = defaultDiscordAvatar;
                    } else {
                      e.currentTarget.style.display = "none";
                    }
                  }}
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Bot size={18} className="text-white" />
                </span>
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2">
                <span className="text-[15px] font-medium text-[#f2f3f5]">{effectiveUsername}</span>
                <span className="rounded bg-blurple px-1 py-px text-[10px] font-semibold text-white">
                  APP
                </span>
                <span className="text-xs text-[#949ba4]">
                  Today at {now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </p>

              <div className="mt-0.5 space-y-2">
                {/* Unified preview: render content, embeds, and components whenever present */}
                {payload.content && (
                  <Markdown content={payload.content} className="text-[15px] text-[#dbdee1]" />
                )}

                {data.embeds &&
                  data.embeds.map((embed) => <EmbedPreview key={embed._id} embed={embed} />)}

                {data.components &&
                  data.components.map((component) => (
                    <div key={component._id}>
                      <TopLevelComponent component={component} />
                    </div>
                  ))}
              </div>

              {isV2 && (
                <p className="mt-3 font-mono text-[10px] text-ink-faint">
                  flags: {MessageFlags.IsComponentsV2} (IsComponentsV2)
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MessagePreview;
