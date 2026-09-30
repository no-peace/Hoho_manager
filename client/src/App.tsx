import { useEffect, useState } from "react";
import { Header } from "./components/layout/Header";
import { Sidebar } from "./components/layout/Sidebar";
import { SplitPane } from "./components/layout/SplitPane";
import { MessageEditor } from "./components/editor/MessageEditor";
import { PropertyPanel } from "./components/editor/PropertyPanel";
import { MessagePreview } from "./components/preview/MessagePreview";
import { DocsPage } from "./pages/DocsPage";
import { useActionStore } from "./store/actionStore";
import { useMessageStore } from "./store/messageStore";

export const App = () => {
  const selection = useMessageStore((state) => state.selection);
  const fetchActionTypes = useActionStore((state) => state.fetchActionTypes);
  
  // Lightweight Router state
  const [currentPath, setCurrentPath] = useState(window.location.pathname);

  useEffect(() => {
    void fetchActionTypes();
  }, [fetchActionTypes]);

  useEffect(() => {
    const onLocationChange = () => setCurrentPath(window.location.pathname);
    window.addEventListener("popstate", onLocationChange);
    return () => window.removeEventListener("popstate", onLocationChange);
  }, []);

  // ROUTER LOGIC: If the user goes to /docs, render the standalone page!
  if (currentPath === "/docs") {
    return <DocsPage />;
  }

  return (
    <div className="flex h-full flex-col bg-chrome">
      <Header />

      <main className="flex min-h-0 flex-1">
        <Sidebar />

        <SplitPane
          initialRatio={0.52}
          left={
            <div className="flex min-h-0 flex-1">
              <div className="min-h-0 flex-1 overflow-y-auto bg-surface p-4 relative pb-32 custom-scrollbar">
                <MessageEditor />
              </div>
              {selection && <PropertyPanel />}
            </div>
          }
          right={
            <div className="flex min-h-0 flex-1 flex-col bg-surface border-l border-[#1e1f22]">
              <MessagePreview />
            </div>
          }
        />
      </main>
    </div>
  );
};

export default App;