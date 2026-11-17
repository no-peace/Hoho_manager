import React, { useEffect, useState } from "react";
import { appLayoutApi, type PublishedAppLayout } from "../../utils/appLayoutApi";
import {
  validateAppLayoutDocuments,
  type AppLayoutDocuments,
} from "../../utils/puckAppLayout";

type PublishState = "idle" | "publishing" | "success" | "error";

export const PublishAppLayoutControl: React.FC<{
  isOwner: boolean;
  documents: AppLayoutDocuments;
}> = ({ isOwner, documents }) => {
  const [state, setState] = useState<PublishState>("idle");
  const [published, setPublished] = useState<PublishedAppLayout | null>(null);
  const [loadingPublished, setLoadingPublished] = useState(true);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    if (!isOwner) return;
    let active = true;
    void appLayoutApi.getPublished().then((response) => {
      if (active) setPublished(response.layout);
    }).catch((reason) => {
      if (active) setError(reason instanceof Error ? reason.message : "Could not load published layout status.");
    }).finally(() => {
      if (active) setLoadingPublished(false);
    });
    return () => { active = false; };
  }, [isOwner]);

  if (!isOwner) return null;

  const publish = async () => {
    if (!isOwner || state === "publishing") return;
    setError("");
    setStatus("");
    let checked: AppLayoutDocuments;
    try {
      checked = validateAppLayoutDocuments(documents);
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "Desktop and Mobile layouts are not valid.");
      return;
    }
    if (!window.confirm("Publish both Desktop and Mobile layouts to the live Studio? This replaces the currently published pair.")) return;

    setState("publishing");
    try {
      const result = await appLayoutApi.publish(checked);
      setPublished(result.layout);
      setState("success");
      setStatus("Both Desktop and Mobile layouts were published successfully.");
    } catch (reason) {
      setState("error");
      setError(reason instanceof Error ? reason.message : "The application layout could not be published.");
    }
  };

  const updatedAt = published?.updatedAt
    ? new Date(published.updatedAt).toLocaleString()
    : null;

  return (
    <section className="flex min-w-[220px] flex-col gap-1 rounded-lg border border-[#3b4260] bg-[#171b29] px-3 py-2" aria-label="Published application layout">
      <div className="flex items-center justify-between gap-2">
        <strong className="text-[0.6875rem] text-white">Server layout</strong>
        <span className="text-[0.625rem] text-[#a1a8b8]">Local draft remains separate</span>
      </div>
      <p className="text-[0.625rem] text-[#a1a8b8]" aria-live="polite">
        {loadingPublished
          ? "Checking published version…"
          : published
            ? `Published ${updatedAt ? `· ${updatedAt}` : ""}${published.publisher?.discordId ? ` · by ${published.publisher.discordId}` : ""}`
            : "No server layout published; the live Studio uses built-in defaults."}
      </p>
      <button
        type="button"
        onClick={() => void publish()}
        disabled={state === "publishing"}
        className="inline-flex min-h-8 items-center justify-center rounded-md bg-[#818cf8] px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-[#6366f1] disabled:cursor-wait disabled:opacity-60"
      >
        {state === "publishing" ? "Publishing both layouts…" : "Publish Desktop + Mobile"}
      </button>
      {status ? <p className="text-[0.6875rem] text-emerald-300" role="status">{status}</p> : null}
      {error ? <p className="text-[0.6875rem] text-rose-300" role="alert">{error}</p> : null}
    </section>
  );
};

export default PublishAppLayoutControl;
