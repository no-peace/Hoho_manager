import { ShieldCheck, AlertTriangle } from "lucide-react";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import { useGlobalStore } from "../../store/globalStore";

interface ServerBotAccessModalProps {
  open: boolean;
  onClose: () => void;
}

export const ServerBotAccessModal = ({
  open,
  onClose,
}: ServerBotAccessModalProps) => {
  const currentUser = useGlobalStore((state) => state.currentUser);
  const hasAccess = Boolean(currentUser?.isAdmin || currentUser?.hasDefaultBotAccess);

  return (
    <Modal open={open} onClose={onClose} title="Bot Access" width="max-w-lg">
      <div className="space-y-4 text-sm text-[#dbdee1]">
        <div className="rounded-lg border border-[#35373c] bg-[#1e1f22] p-4">
          <div className="flex items-center gap-2 font-bold text-white">
            {hasAccess ? (
              <ShieldCheck size={17} className="text-[#57f287]" />
            ) : (
              <AlertTriangle size={17} className="text-[#f0b232]" />
            )}
            {hasAccess ? "Server bot access enabled" : "Server bot access required"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#b5bac1]">
            HoHo Manager uses one Discord bot token configured by the server administrator.
            Custom bot tokens, webhook URL message sending, and per-message sender identity
            overrides are disabled.
          </p>
          {!hasAccess && (
            <p className="mt-2 text-xs leading-relaxed text-[#f0b232]">
              Ask a Head Admin to grant your Discord account staff access to the configured bot.
            </p>
          )}
        </div>
        <div className="flex justify-end">
          <Button size="sm" variant="secondary" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};
