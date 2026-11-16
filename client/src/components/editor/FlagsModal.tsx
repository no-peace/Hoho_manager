import React from "react";
import { MessageFlags } from "@dmb/shared";
import { Modal } from "../ui/Modal";
import { useMessageStore } from "../../store/messageStore";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Field";

interface FlagsModalProps {
  open: boolean;
  onClose: () => void;
}

const FLAG_ITEMS = [
  { flag: MessageFlags.SuppressNotifications, title: "Suppress Notifications (Silent)", desc: "Recipients will not receive a push or desktop notification for this message." },
  { flag: MessageFlags.SuppressEmbeds, title: "Suppress Embeds", desc: "Hides all rich link previews and embeds included in this message." },
  { flag: MessageFlags.IsVoiceMessage, title: "Voice Message", desc: "Flags this message as a Discord voice message." },
] as const;

export const FlagsModal: React.FC<FlagsModalProps> = ({ open, onClose }) => {
  const flags = useMessageStore((state) => state.data.flags ?? 0);
  const setMessageFlags = useMessageStore((state) => state.setMessageFlags);
  const hasFlag = (flag: number) => (flags & flag) === flag;
  const toggleFlag = (flag: number) => setMessageFlags(hasFlag(flag) ? flags & ~flag : flags | flag);

  return (
    <Modal open={open} onClose={onClose} title="Message Flags" width="max-w-md"
      footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
      <div className="space-y-4">
        <p className="text-xs text-[#A1A8B8]">Control how Discord displays and notifies recipients about this message.</p>
        <div className="space-y-2.5">
          {FLAG_ITEMS.map((item) => {
            const checked = hasFlag(item.flag);
            return (
              <div key={item.flag} className={"rounded-xl border p-3 transition-[background-color,border-color,box-shadow,opacity] duration-150 ease-out " + (checked ? "bg-[#818CF8]/10 border-[#818CF8]/60" : "bg-[#161A23] border-[#1D2230]")}>
                <Checkbox checked={checked} onChange={() => toggleFlag(item.flag)} className="w-full items-start"
                  label={<span className="flex-1 min-w-0">
                    <span className="text-xs sm:text-sm font-semibold text-white block">{item.title}</span>
                    <span className="text-xs text-[#A1A8B8] block mt-0.5">{item.desc}</span>
                  </span>} />
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
};
export default FlagsModal;
