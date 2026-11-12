import React from "react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<React.PropsWithChildren, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || "An unexpected error occurred." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error("HoHo Manager render error", error, info.componentStack);
  }

  private resetDraft = (): void => {
    try {
      for (const key of Object.keys(localStorage)) {
        if (/draft|workspace|message-store|hoho.*state/i.test(key)) localStorage.removeItem(key);
      }
    } finally {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;
    return (
      <main className="min-h-screen bg-[#111214] px-4 py-16 text-[#f2f3f5]">
        <section className="mx-auto my-16 max-w-md rounded-xl border border-[#26282d] bg-[#18191c] p-6 text-center">
          <h1 className="text-lg font-bold">HoHo Manager needs to recover</h1>
          <p className="mt-2 text-xs leading-relaxed text-[#949ba4]">{this.state.message}</p>
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button type="button" onClick={() => window.location.reload()} className="rounded-lg bg-[#5865f2] px-4 py-2 text-xs font-semibold text-white">Reload Studio</button>
            <button type="button" onClick={this.resetDraft} className="rounded-lg border border-[#383a40] px-4 py-2 text-xs font-semibold text-[#dbdee1]">Reset Local Workspace Draft</button>
          </div>
        </section>
      </main>
    );
  }
}
