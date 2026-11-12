import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles/globals.css";
import { ErrorBoundary } from "./components/ui/ErrorBoundary";

/**
 * Vite entry point.
 *
 * StrictMode is on deliberately: the double-invocation it performs in development
 * catches accidental side effects in render, which is exactly the class of bug a
 * stateful editor tends to accumulate.
 */
const container = document.getElementById("root");
if (!container) throw new Error("Root element #root is missing from index.html");

createRoot(container).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
