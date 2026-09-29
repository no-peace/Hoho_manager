import { useEffect } from "react";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { MessagePreview } from "./components/preview/MessagePreview";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";

/**
 * Application shell.
 *
 * Three columns, deliberately:
 *
 *   ┌─────────┬───────────────────────────┬──────────────┐
 *   │ Sidebar │ Editor  (+ PropertyPanel) │   Preview    │
 *   └─────────┴───────────────────────────┴──────────────┘
 *
 * The editor/preview boundary is draggable. The property panel is a third column
 * *inside* the editor side so the property list and the thing being edited stay
 * visually adjacent.
 */
export const App = () => {
  const selection = useMessageStore((state) => state.selection);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);

  // The action picker is populated from the server's own registry.
  useEffect(() => {
    void fetchActionTypes();
  }, [fetchActionTypes]);

  return (
    <div className="flex h-full flex-col bg-chrome">
      <Header />

      <main className="flex min-h-0 flex-1">
        <Sidebar />

        <SplitPane
          initialRatio={0.52}
          left={
            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4">
                <MessageEditor />
              </div>
              {selection && <PropertyPanel />}
            </div>
          }
          right={
            <div className="flex min-h-0 flex-1 flex-col bg-surface">
              <MessagePreview />
            </div>
          }
        />
      </main>
    </div>
  );
};

export default App;
