import { useMemo } from "react";
import type { DiscordMessagePayload } from "@dmb/shared";
import { useMessageStore } from "../store/messageStore";
import { isPayloadEmpty } from "../utils/discord";

/**
 * Read-only view of the message document plus derived values.
 *
 * `getPayload`/`getValidationErrors` are functions on the store, which do not
 * trigger re-renders on their own. This hook recomputes them whenever the
 * document changes, so components can read `payload` and `problems` directly.
 */
export interface MessageView {
  mode: ReturnType<typeof useMessageStore.getState>["mode"];
  data: ReturnType<typeof useMessageStore.getState>["data"];
  payload: DiscordMessagePayload;
  problems: string[];
  isEmpty: boolean;
  embedCount: number;
  componentCount: number;
}

export const useMessage = (): MessageView => {
  const mode = useMessageStore((state) => state.mode);
  const data = useMessageStore((state) => state.data);

  const payload = useMemo(
    () => useMessageStore.getState().getPayload(),
    // Recomputed whenever the document changes.
    [mode, data],
  );

  const problems = useMemo(() => useMessageStore.getState().getValidationErrors(), [mode, data]);

  return {
    mode,
    data,
    payload,
    problems,
    isEmpty: isPayloadEmpty(payload),
    embedCount: data.embeds.length,
    componentCount: data.components.length,
  };
};

export default useMessage;
