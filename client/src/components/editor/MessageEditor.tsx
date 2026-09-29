import { AlertTriangle, Hash, Image as ImageIcon, Plus, User } from "lucide-react";
import { Limits } from "@dmb/shared";
import { Button } from "../ui/Button";
import { TextArea, TextField } from "../ui/Field";
import { EmbedEditor } from "./EmbedEditor";
import { useMessage } from "../../hooks/useMessage";
import { EDITOR_MODES } from "../../utils/constants";
import { useMessageStore } from "../../store/messageStore";

/**
 * The editor column.
 *
 * Classic mode edits `content` + `embeds`; Components V2 mode replaces both with
 * a component tree, so the content/embed editors are hidden rather than silently
 * ignored. Identity overrides (username, avatar, thread name) apply to both modes
 * and live at the top.
 */
export const MessageEditor = () => {
  const { mode, data, problems } = useMessage();
  const setField = useMessageStore((state) => state.setField);
  const addEmbed = useMessageStore((state) => state.addEmbed);

  const isClassic = mode === EDITOR_MODES.CLASSIC;

  return (
    <div className="space-y-4">
      {/* Validation summary — the fastest way to know why a send failed. */}
      {problems.length > 0 && (
        <div className="rounded border border-danger/40 bg-danger/10 p-3">
          <p className="flex items-center gap-2 text-xs font-semibold text-danger">
            <AlertTriangle size={14} />
            {problems.length} problem{problems.length === 1 ? "" : "s"} to fix
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5 text-[11px] text-ink-muted">
            {problems.map((problem) => (
              <li key={problem}>{problem}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Identity overrides */}
      <section className="panel p-3">
        <h3 className="field-label">Message identity</h3>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TextField
            label="Username"
            placeholder="Defaults to the webhook/bot name"
            value={data.username}
            onChange={(event) => setField("username", event.target.value)}
          />
          <TextField
            label="Avatar URL"
            placeholder="https://…"
            value={data.avatar_url}
            onChange={(event) => setField("avatar_url", event.target.value)}
          />
        </div>
        <TextField
          className="mt-2"
          label="Thread name"
          hint="Only used when the webhook target is a forum channel."
          value={data.thread_name}
          onChange={(event) => setField("thread_name", event.target.value)}
        />
      </section>

      {isClassic ? (
        <>
          <section className="panel p-3">
            <TextArea
              label="Content"
              limit={Limits.content}
              rows={5}
              value={data.content}
              placeholder="Say something…"
              onChange={(event) => setField("content", event.target.value)}
            />
          </section>

          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="field-label !mb-0 flex items-center gap-1.5">
                <ImageIcon size={13} /> Embeds
                <span className="text-ink-faint">
                  {data.embeds.length}/{Limits.embed.embedsPerMessage}
                </span>
              </h3>
              <Button
                size="sm"
                variant="secondary"
                icon={Plus}
                onClick={addEmbed}
                disabled={data.embeds.length >= Limits.embed.embedsPerMessage}
              >
                Add embed
              </Button>
            </div>

            {data.embeds.length === 0 ? (
              <p className="rounded border border-dashed border-line px-3 py-6 text-center text-xs text-ink-faint">
                No embeds yet. Add one to build a classic rich message.
              </p>
            ) : (
              data.embeds.map((embed, index) => (
                <EmbedEditor key={embed._id} embed={embed} index={index} />
              ))
            )}
          </section>
        </>
      ) : (
        <section className="panel p-3">
          <h3 className="field-label flex items-center gap-1.5">
            <Hash size={13} /> Components V2
          </h3>
          <p className="text-xs leading-relaxed text-ink-muted">
            This message is built from components. Use the palette on the left to add containers,
            text displays, sections, galleries and action rows, then select any block to edit its
            properties.
          </p>
          <p className="mt-2 rounded bg-chrome px-2.5 py-2 text-[11px] text-ink-faint">
            <User size={11} className="mr-1 inline" />
            Components V2 messages ignore classic <code>content</code> and <code>embeds</code> —
            Discord rejects them if combined.
          </p>
        </section>
      )}
    </div>
  );
};

export default MessageEditor;
