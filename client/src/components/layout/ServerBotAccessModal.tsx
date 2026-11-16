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
      <div className="space-y-4 text-sm text-[#F1F3F9]">
        <div className="rounded-xl border border-[#272D3A] bg-[#10131A] p-3.5">
          <div className="flex items-center gap-2 font-bold text-white">
            {hasAccess ? (
              <ShieldCheck size={17} className="text-[#34D399]" />
            ) : (
              <AlertTriangle size={17} className="text-[#FBBF24]" />
            )}
            {hasAccess ? "Server bot access enabled" : "Server bot access required"}
          </div>
          <p className="mt-2 text-xs leading-relaxed text-[#A1A8B8]">
            HoHo Manager sends messages through the server bot configured by the administrator. Your access determines whether you can use that bot to send and manage messages.
          </p>
          {!hasAccess && (
            <p className="mt-2 text-xs leading-relaxed text-[#FBBF24]">
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
