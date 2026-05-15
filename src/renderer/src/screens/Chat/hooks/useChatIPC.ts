import { useEffect } from "react";
import type { ChatMessage, UsageState } from "../types";

interface UseChatIPCArgs {
  requestId: string;
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  setHermesSessionId: (id: string) => void;
  setToolProgress: (tool: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setUsage: React.Dispatch<React.SetStateAction<UsageState | null>>;
  onSessionIdChange?: (sessionId: string) => void;
}

/**
 * Registers all chat-related IPC listeners once and tears them down on unmount.
 *
 * Each listener writes through the provided setters; consumers should pass
 * stable `useState`/`useDispatch` setters (React guarantees identity).
 */
export function useChatIPC({
  requestId,
  setMessages,
  setHermesSessionId,
  setToolProgress,
  setIsLoading,
  setUsage,
  onSessionIdChange,
}: UseChatIPCArgs): void {
  useEffect(() => {
    const cleanupChunk = window.hermesAPI.onChatChunk((payload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      const { chunk } = payload;
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.role === "agent") {
          return [
            ...prev.slice(0, -1),
            { ...last, content: last.content + chunk },
          ];
        }
        // Skip empty initial chunks so we don't create an empty bubble
        if (!chunk || !chunk.trim()) return prev;
        return [
          ...prev,
          { id: `agent-${Date.now()}`, role: "agent", content: chunk },
        ];
      });
    });

    const cleanupDone = window.hermesAPI.onChatDone((payload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      const { sessionId } = payload;
      if (sessionId) setHermesSessionId(sessionId);
      if (sessionId) onSessionIdChange?.(sessionId);
      setToolProgress(null);
      setIsLoading(false);
    });

    const cleanupError = window.hermesAPI.onChatError((payload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      const { error } = payload;
      setMessages((prev) => [
        ...prev,
        {
          id: `error-${Date.now()}`,
          role: "agent",
          content: `Error: ${error}`,
        },
      ]);
      setToolProgress(null);
      setIsLoading(false);
    });

    const cleanupToolProgress = window.hermesAPI.onChatToolProgress((payload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      const { tool } = payload;
      setToolProgress(tool);
    });

    const cleanupUsage = window.hermesAPI.onChatUsage((payload) => {
      if (payload.requestId && payload.requestId !== requestId) return;
      const u = payload.usage;
      setUsage((prev) => ({
        promptTokens: (prev?.promptTokens || 0) + u.promptTokens,
        completionTokens: (prev?.completionTokens || 0) + u.completionTokens,
        totalTokens: (prev?.totalTokens || 0) + u.totalTokens,
        cost: u.cost != null ? (prev?.cost || 0) + u.cost : prev?.cost,
      }));
    });

    return () => {
      cleanupChunk();
      cleanupDone();
      cleanupError();
      cleanupToolProgress();
      cleanupUsage();
    };
  }, [
    setMessages,
    setHermesSessionId,
    setToolProgress,
    setIsLoading,
    setUsage,
    requestId,
    onSessionIdChange,
  ]);
}
