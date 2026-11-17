import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export interface ErrorBoundaryProps extends React.PropsWithChildren {
  level?: "root" | "pane" | "modal";
  fallbackTitle?: string;
  onReset?: () => void;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, message: "" };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || "An unexpected rendering error occurred." };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error(`[ErrorBoundary:${this.props.level ?? "root"}]`, error, info.componentStack);
  }

  private handleRetry = (): void => {
    this.setState({ hasError: false, message: "" });
    this.props.onReset?.();
  };

  private resetDraft = (): void => {
    try {
      for (const key of Object.keys(localStorage)) {
        const mustPreserve =
          /^hoho:user-theme-library:v1:/i.test(key) ||
          /^hoho:app-layout-draft:v1:/i.test(key) ||
          /^hoho-manager:puck-design:v1:/i.test(key);
        if (!mustPreserve && /draft|workspace|message-store|hoho.*state/i.test(key)) {
          localStorage.removeItem(key);
        }
      }
    } finally {
      window.location.reload();
    }
  };

  render(): React.ReactNode {
    if (!this.state.hasError) return this.props.children;

    const level = this.props.level ?? "root";

    if (level === "pane" || level === "modal") {
      return (
        <div
          role="alert"
          className="flex flex-col items-center justify-center p-6 m-4 rounded-xl border border-[#da373c]/40 bg-[#18191c] text-center space-y-3"
        >
          <div className="p-2.5 rounded-full bg-[#da373c]/15 text-[#f28b8b]">
            <AlertTriangle size={20} />
          </div>
          <div className="space-y-1 max-w-sm">
            <h3 className="text-sm font-bold text-white">
              {this.props.fallbackTitle || (level === "pane" ? "Workspace Pane Recovered" : "Dialog Section Error")}
            </h3>
            <p className="text-xs text-[#b5bac1] break-words leading-relaxed">
              {this.state.message}
            </p>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.97] px-3.5 py-1.5 text-xs font-semibold text-white transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
            >
              <RotateCcw size={13} /> Retry Component
            </button>
          </div>
        </div>
      );
    }

    return (
      <main className="min-h-screen bg-[#111214] px-4 py-16 text-[#f2f3f5] flex items-center justify-center">
        <section className="mx-auto max-w-md rounded-2xl border border-[#26282d] bg-[#18191c] p-6 text-center shadow-2xl space-y-4">
          <div className="mx-auto w-12 h-12 rounded-full bg-[#da373c]/15 text-[#f28b8b] flex items-center justify-center">
            <AlertTriangle size={24} />
          </div>
          <h1 className="text-lg font-bold text-white">HoHo Manager needs to recover</h1>
          <p className="text-xs leading-relaxed text-[#b5bac1]">{this.state.message}</p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              type="button"
              onClick={this.handleRetry}
              className="rounded-lg bg-[#5865f2] hover:bg-[#4752c4] active:scale-[0.97] px-4 py-2 text-xs font-semibold text-white transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
            >
              Try Resume
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-lg bg-[#2b2d31] hover:bg-[#35373c] active:scale-[0.97] px-4 py-2 text-xs font-semibold text-white transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
            >
              Reload Studio
            </button>
            <button
              type="button"
              onClick={this.resetDraft}
              className="rounded-lg border border-[#383a40] hover:bg-[#da373c]/15 hover:text-[#f28b8b] active:scale-[0.97] px-4 py-2 text-xs font-semibold text-[#dbdee1] transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-150 ease-out"
            >
              Reset Local Draft
            </button>
          </div>
        </section>
      </main>
    );
  }
}

export default ErrorBoundary;
