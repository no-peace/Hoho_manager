import React, { useState } from "react";
import { Toaster as SileoToaster } from "sileo";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { BackupsModal } from "./BackupsModal";
import { useGlobalStore } from "../../store/globalStore";

const JsonModal = React.lazy(() =>
  import("../editor/JsonModal").then((module) => ({ default: module.JsonModal })),
);
const BotDispatchModal = React.lazy(() =>
  import("../send/BotDispatchModal").then((module) => ({ default: module.BotDispatchModal })),
);
const ServerBotAccessModal = React.lazy(() =>
  import("./ServerBotAccessModal").then((module) => ({ default: module.ServerBotAccessModal })),
);

export const ToastAndConfirmHost: React.FC = () => {
  const { toasts, confirmDialog, closeConfirm } = useGlobalStore();
  const [confirmBusy, setConfirmBusy] = useState(false);

  return (
    <>
      <SileoToaster
        position="bottom-right"
        theme="dark"
        options={{
          fill: "#18191c",
          roundness: 14,
        }}
      />
      <div role="status" aria-live="polite" className="sr-only">
        {toasts.map((toast) => (
          <span key={toast.id}>{toast.message}</span>
        ))}
      </div>

      {confirmDialog.open && (
        <Modal
          open={confirmDialog.open}
          onClose={() => !confirmBusy && closeConfirm()}
          title={confirmDialog.title}
          width="max-w-md"
          zIndex="z-[9999]"
          footer={
            <>
              <Button variant="ghost" disabled={confirmBusy} onClick={closeConfirm}>
                Cancel
              </Button>
              <Button
                variant={confirmDialog.danger ? "danger" : "primary"}
                loading={confirmBusy}
                onClick={async () => {
                  if (!confirmDialog.onConfirm) {
                    closeConfirm();
                    return;
                  }
                  setConfirmBusy(true);
                  try {
                    await confirmDialog.onConfirm();
                  } finally {
                    setConfirmBusy(false);
                    closeConfirm();
                  }
                }}
              >
                {confirmDialog.confirmLabel || "Confirm"}
              </Button>
            </>
          }
        >
          <p className="text-xs text-[#dbdee1] leading-relaxed">{confirmDialog.message}</p>
        </Modal>
      )}
    </>
  );
};

export const StudioModals: React.FC = () => {
  const backupsModalOpen = useGlobalStore((s) => s.backupsModalOpen);
  const setBackupsModalOpen = useGlobalStore((s) => s.setBackupsModalOpen);
  const jsonModalOpen = useGlobalStore((s) => s.jsonModalOpen);
  const setJsonModalOpen = useGlobalStore((s) => s.setJsonModalOpen);
  const configModalOpen = useGlobalStore((s) => s.configModalOpen);
  const setConfigModalOpen = useGlobalStore((s) => s.setConfigModalOpen);
  const botModalOpen = useGlobalStore((s) => s.botModalOpen);
  const botModalMode = useGlobalStore((s) => s.botModalMode);
  const closeBotModal = useGlobalStore((s) => s.closeBotModal);

  return (
    <>
      <React.Suspense fallback={null}>
        <JsonModal open={jsonModalOpen} onClose={() => setJsonModalOpen(false)} />
      </React.Suspense>
      <BackupsModal open={backupsModalOpen} onClose={() => setBackupsModalOpen(false)} />
      {configModalOpen && (
        <React.Suspense fallback={null}>
          <ServerBotAccessModal open={configModalOpen} onClose={() => setConfigModalOpen(false)} />
        </React.Suspense>
      )}
      <React.Suspense fallback={null}>
        <BotDispatchModal open={botModalOpen} onClose={closeBotModal} initialMode={botModalMode} />
      </React.Suspense>
      <ToastAndConfirmHost />
    </>
  );
};

export default StudioModals;
