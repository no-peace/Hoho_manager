import React from "react";
import { MessageFlags } from "@dmb/shared";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";
import { Button } from "../ui/Button";

interface FlagsModalProps {
  open: boolean;
  onClose: () => void;
}

export const FlagsModal: React.FC<FlagsModalProps> = ({ open, onClose }) => {
  const flags = useMessageStore((state) => state.data.flags ?? 0);
  const setMessageFlags = useMessageStore((state) => state.setMessageFlags);

  const hasFlag = (flag: number) => (flags & flag) === flag;

  const toggleFlag = (flag: number) => {
    const next = hasFlag(flag) ? flags & ~flag : flags | flag;
    setMessageFlags(next);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Message Flags"
      width="max-w-md"
      footer={
        <Button onClick={onClose} className="bg-[#5865f2] hover:bg-[#4752c4] text-white">
          Done
        </Button>
      }
    >
      <div className="space-y-4">
        <p className="text-xs text-[#949ba4]">
          Control how Discord displays and notifies recipients about this message.
        </p>

        <div className="space-y-3">
          <label className="flex items-start gap-3 p-3 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer transition-colors border border-[#1e1f22]">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2] focus:ring-[#5865f2]"
              checked={hasFlag(MessageFlags.SuppressNotifications)}
              onChange={() => toggleFlag(MessageFlags.SuppressNotifications)}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white block">Suppress Notifications (Silent)</span>
              <span className="text-xs text-[#949ba4] block mt-0.5">
                Recipients will not receive a push or desktop notification for this message.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer transition-colors border border-[#1e1f22]">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2] focus:ring-[#5865f2]"
              checked={hasFlag(MessageFlags.SuppressEmbeds)}
              onChange={() => toggleFlag(MessageFlags.SuppressEmbeds)}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white block">Suppress Embeds</span>
              <span className="text-xs text-[#949ba4] block mt-0.5">
                Hides all rich link previews and embeds included in this message.
              </span>
            </div>
          </label>

          <label className="flex items-start gap-3 p-3 rounded bg-[#2b2d31] hover:bg-[#35373c] cursor-pointer transition-colors border border-[#1e1f22]">
            <input
              type="checkbox"
              className="mt-0.5 rounded border-[#1e1f22] bg-[#1e1f22] text-[#5865f2] focus:ring-[#5865f2]"
              checked={hasFlag(MessageFlags.IsVoiceMessage)}
              onChange={() => toggleFlag(MessageFlags.IsVoiceMessage)}
            />
            <div className="flex-1 min-w-0">
              <span className="text-sm font-semibold text-white block">Voice Message</span>
              <span className="text-xs text-[#949ba4] block mt-0.5">
                Flags this message as a voice message.
              </span>
            </div>
          </label>
        </div>
      </div>
    </Modal>
  );
};

export default FlagsModal;
