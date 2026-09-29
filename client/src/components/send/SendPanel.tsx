import { useEffect } from "react";
import { AlertCircle, CheckCircle2, RefreshCw, Send } from "lucide-react";
import { Button } from "../ui/Button";
import { Select, TextField } from "../ui/Field";
import { useSend } from "../../hooks/useSend";
import { useMessageStore } from "../../store/messageStore";
import { useProfileStore } from "../../store/profileStore";
import { SEND_MODES } from "../../utils/constants";
import type { SendModeValue } from "../../utils/constants";

/**
 * Where the message goes.
 *
 * The two modes are presented as a choice because they have genuinely different
 * trade-offs, and the UI states them plainly:
 *   - Webhook: sent from your browser straight to Discord. Simple, but the URL is
 *     visible to the page.
 *   - Bot: sent through the API so the token stays server-side. Needs a channel id
 *     and the server's admin key.
 */
const MODE_OPTIONS: readonly { id: SendModeValue; label: string }[] = [
  { id: SEND_MODES.WEBHOOK, label: "Webhook URL" },
  { id: SEND_MODES.BOT, label: "Bot token" },
];

export const SendPanel = () => {
  const { sendMessage, isConfigured, sendMode } = useSend();

  const webhookUrl = useProfileStore((state) => state.webhookUrl);
  const channelId = useProfileStore((state) => state.channelId);
  const threadId = useProfileStore((state) => state.threadId);
  const botProfileId = useProfileStore((state) => state.botProfileId);
  const webhookProfiles = useProfileStore((state) => state.webhookProfiles);
  const botProfiles = useProfileStore((state) => state.botProfiles);
  const fetchProfiles = useProfileStore((state) => state.fetchProfiles);
  const profilesStatus = useProfileStore((state) => state.status);

  const setSendMode = useProfileStore((state) => state.setSendMode);
  const setWebhookUrl = useProfileStore((state) => state.setWebhookUrl);
  const setChannelId = useProfileStore((state) => state.setChannelId);
  const setThreadId = useProfileStore((state) => state.setThreadId);
  const setBotProfileId = useProfileStore((state) => state.setBotProfileId);

  const send = useMessageStore((state) => state.send);
  const resetSendState = useMessageStore((state) => state.resetSendState);

  useEffect(() => {
    void fetchProfiles();
  }, [fetchProfiles]);

  return (
    <div className="space-y-3">
      {/* Mode switch */}
      <div className="tab-rail" role="group" aria-label="Send mode">
        {MODE_OPTIONS.map((option) => (
          <button
            key={option.id}
            type="button"
            aria-pressed={sendMode === option.id}
            onClick={() => setSendMode(option.id)}
            className={[
              "tab-item flex-1 text-center text-xs",
              sendMode === option.id ? "tab-item-active" : "tab-item-idle",
            ].join(" ")}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sendMode === SEND_MODES.WEBHOOK ? (
        <>
          <TextField
            label="Webhook URL"
            value={webhookUrl}
            placeholder="https://discord.com/api/webhooks/…"
            onChange={(event) => setWebhookUrl(event.target.value)}
          />

          <TextField
            label="Thread ID (optional)"
            value={threadId}
            placeholder="Post into a thread"
            onChange={(event) => setThreadId(event.target.value)}
          />

          {webhookProfiles.length > 0 && (
            <Select
              label="Saved webhooks"
              value=""
              onChange={(event) => {
                const profile = webhookProfiles.find(
                  (candidate) => String(candidate.id) === event.target.value,
                );
                if (profile) setWebhookUrl(profile.url);
              }}
              options={[
                { value: "", label: "Choose a saved webhook…" },
                ...webhookProfiles.map((profile) => ({
                  value: String(profile.id),
                  label: profile.name,
                })),
              ]}
            />
          )}

          <p className="rounded-md bg-raised px-2 py-1.5 text-[11px] text-ink-faint">
            Sent directly from your browser to Discord — the server is not involved.
          </p>
        </>
      ) : (
        <>
          <TextField
            label="Channel ID"
            value={channelId}
            placeholder="123456789012345678"
            onChange={(event) => setChannelId(event.target.value)}
          />

          {botProfiles.length > 0 && (
            <Select
              label="Bot profile"
              value={String(botProfileId ?? "")}
              onChange={(event) =>
                setBotProfileId(event.target.value ? Number(event.target.value) : null)
              }
              options={[
                { value: "", label: "Server default token" },
                ...botProfiles.map((profile) => ({
                  value: String(profile.id),
                  label: profile.name,
                })),
              ]}
            />
          )}

          <p className="rounded-md bg-raised px-2 py-1.5 text-[11px] text-ink-faint">
            Proxied through <code>POST /api/send</code> so the bot token never reaches the browser.
          </p>
        </>
      )}

      <div className="flex items-center gap-2">
        <Button
          icon={Send}
          onClick={() => void sendMessage()}
          disabled={!isConfigured}
          loading={send.status === "sending"}
          className="flex-1"
        >
          {send.status === "sending" ? "Sending…" : "Send message"}
        </Button>
        <Button
          variant="ghost"
          icon={RefreshCw}
          onClick={() => void fetchProfiles()}
          loading={profilesStatus === "loading"}
          title="Reload profiles"
        />
      </div>

      {!isConfigured && (
        <p className="flex items-start gap-1.5 text-[11px] text-ink-faint">
          <AlertCircle size={12} className="mt-0.5 shrink-0" />
          {sendMode === SEND_MODES.BOT
            ? "Enter a channel ID to enable sending."
            : "Enter a webhook URL to enable sending."}
        </p>
      )}

      {send.status === "success" && (
        <p className="flex items-start gap-1.5 rounded bg-online/15 px-2 py-1.5 text-[11px] text-[#6bd68f]">
          <CheckCircle2 size={12} className="mt-0.5 shrink-0" />
          Message sent successfully.
        </p>
      )}

      {send.status === "error" && (
        <div className="rounded bg-danger/15 px-2 py-1.5">
          <p className="flex items-start gap-1.5 text-[11px] text-[#f28b8b]">
            <AlertCircle size={12} className="mt-0.5 shrink-0" />
            {send.error}
          </p>
          <button
            type="button"
            className="mt-1 text-[10px] text-ink-faint underline"
            onClick={resetSendState}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
};

export default SendPanel;
