import React, { useState } from "react";
import { Link } from "lucide-react";
import { motion } from "motion/react";
import { Modal } from "../../ui/Modal";
import { Button } from "../../ui/Button";
import {
  parseDiscordMessageLink,
  type ExtendedMessageData,
} from "../../../utils/discord";
import { fromQueryData, getEditorModeForDiscordMessage } from "../../../utils/exportImport";
import { useMessageStore } from "../../../store/messageStore";
import { request } from "../../../api/client";
import { UI_THEME_CONFIG } from "../../../config/uiThemeConfig";

export interface MessageLinkModalProps {
  open: boolean;
  onClose: () => void;
  message: ExtendedMessageData;
  ensureActive: () => void;
  setExtendedField: <K extends keyof ExtendedMessageData>(
    key: K,
    value: ExtendedMessageData[K],
  ) => void;
}

/**
 * Postel's Law: Accept full Discord URLs OR shorthand `channelId/messageId` or `guildId/channelId/messageId`
 */
const normalizeMessageLinkInput = (raw: string): string => {
  const trimmed = raw.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const parts = trimmed.split(/[\s/:-]+/).filter((p) => /^\d{17,20}$/.test(p));
  if (parts.length === 2) {
    return `https://discord.com/channels/@me/${parts[0]}/${parts[1]}`;
  }
  if (parts.length >= 3) {
    return `https://discord.com/channels/${parts[0]}/${parts[1]}/${parts[2]}`;
  }
  return trimmed;
};

export const MessageLinkModal: React.FC<MessageLinkModalProps> = ({
  open,
  onClose,
  message,
  ensureActive,
  setExtendedField,
}) => {
  const load = useMessageStore((state) => state.load);
  const [messageLinkInput, setMessageLinkInput] = useState(message.message_link || "");
  const [linkModeInput, setLinkModeInput] = useState<"reply" | "edit">(
    message.link_mode || "reply",
  );
  const [linkError, setLinkError] = useState<string | null>(null);
  const [shakeKey, setShakeKey] = useState(0);
  const [isLoadingLinkedMsg, setIsLoadingLinkedMsg] = useState(false);

  const handleSaveMessageLink = async (loadExistingContent = false) => {
    setLinkError(null);
    const normalized = normalizeMessageLinkInput(messageLinkInput);

    if (!normalized) {
      ensureActive();
      setExtendedField("message_link", undefined);
      setExtendedField("link_mode", undefined);
      setExtendedField("edit_channel_id", undefined);
      setExtendedField("edit_message_id", undefined);
      setExtendedField("message_reference", undefined);
      onClose();
      return;
    }

    const parsed = parseDiscordMessageLink(normalized);
    if (!parsed) {
      setLinkError(
        "Invalid link. Paste a Discord message URL or channelId/messageId pair.",
      );
      setShakeKey((k) => k + 1);
      return;
    }

    ensureActive();
    setExtendedField("message_link", normalized);
    setExtendedField("link_mode", linkModeInput);

    if (linkModeInput === "reply") {
      setExtendedField("message_reference", {
        message_id: parsed.messageId,
        channel_id: parsed.channelId,
        ...(parsed.guildId && parsed.guildId !== "@me" ? { guild_id: parsed.guildId } : {}),
        fail_if_not_exists: false,
      });
      setExtendedField("edit_channel_id", undefined);
      setExtendedField("edit_message_id", undefined);
    } else {
      setExtendedField("edit_channel_id", parsed.channelId);
      setExtendedField("edit_message_id", parsed.messageId);
      setExtendedField("message_reference", undefined);

      if (loadExistingContent) {
        setIsLoadingLinkedMsg(true);
        try {
          const res = await request<{ id: string; raw: any }>(
            `/api/send/channels/${parsed.channelId}/messages/${parsed.messageId}`,
          );
          if (res?.raw) {
            const hydrated = fromQueryData(res.raw) as ExtendedMessageData;
            const detectedMode = getEditorModeForDiscordMessage(res.raw);
            load({
              data: {
                ...hydrated,
                message_link: normalized,
                link_mode: "edit",
                edit_channel_id: parsed.channelId,
                edit_message_id: parsed.messageId,
              } as any,
              mode: detectedMode,
            });
          }
        } catch (err) {
          setLinkError(
            err instanceof Error ? err.message : "Could not load message from Discord",
          );
          setShakeKey((k) => k + 1);
          setIsLoadingLinkedMsg(false);
          return;
        }
        setIsLoadingLinkedMsg(false);
      }
    }

    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        <span className="flex items-center gap-1.5">
          <Link size={16} className="text-[#949cf7]" /> Set Discord Message Link
        </span>
      }
      width="max-w-md"
      footer={
        <>
          <Button variant="ghost" size="sm" onClick={onClose}>
            Cancel
          </Button>
          {linkModeInput === "edit" && (
            <Button
              variant="secondary"
              size="sm"
              loading={isLoadingLinkedMsg}
              onClick={() => void handleSaveMessageLink(true)}
            >
              Bind &amp; Load Message
            </Button>
          )}
          <Button
            variant="primary"
            size="sm"
            onClick={() => void handleSaveMessageLink(false)}
          >
            Save Link
          </Button>
        </>
      }
    >
      <motion.div
        key={shakeKey}
        animate={shakeKey > 0 ? UI_THEME_CONFIG.motion.validationShake : undefined}
        className="space-y-3.5"
      >
        <div className="grid grid-cols-2 gap-1.5 p-1 bg-[#1e1f22] rounded-lg border border-[#111214]">
          <button
            type="button"
            onClick={() => setLinkModeInput("reply")}
            className={`py-1.5 px-2.5 rounded text-xs font-bold transition-colors ${
              linkModeInput === "reply"
                ? "bg-[#5865f2] text-white"
                : "text-[#949ba4] hover:text-white"
            }`}
          >
            ↩ Reply to Message
          </button>
          <button
            type="button"
            onClick={() => setLinkModeInput("edit")}
            className={`py-1.5 px-2.5 rounded text-xs font-bold transition-colors ${
              linkModeInput === "edit"
                ? "bg-[#faa61a] text-[#111214]"
                : "text-[#949ba4] hover:text-white"
            }`}
          >
            ✎ Edit Existing Message
          </button>
        </div>

        <div className="space-y-1.5">
          <label className="block text-[11px] font-semibold text-[#b5bac1]">
            Discord Message URL or channelId/messageId
          </label>
          <input
            type="text"
            placeholder="https://discord.com/channels/guildId/channelId/messageId"
            value={messageLinkInput}
            onChange={(e) => {
              setMessageLinkInput(e.target.value);
              setLinkError(null);
            }}
            className="w-full bg-[#1e1f22] text-xs text-white px-2.5 py-2 rounded-lg border border-[#383a40] focus:border-[#5865f2] focus:outline-none font-mono"
          />
          <p className="text-[11px] text-[#949ba4]">
            {linkModeInput === "reply"
              ? "When sent via Bot, this message will natively reply to the linked Discord message."
              : "Binds this message to the linked channel & message ID so Bot Dispatch updates it in-place."}
          </p>
          {linkError && (
            <p className="text-[11px] text-[#f28b8b] bg-[#da373c]/10 border border-[#da373c]/30 rounded-lg px-2.5 py-1.5 break-words [overflow-wrap:anywhere]">
              {linkError}
            </p>
          )}
        </div>
      </motion.div>
    </Modal>
  );
};

export default MessageLinkModal;
