import { memo, useMemo, useState } from "react";
import icon from "../../assets/icon.png";
import { AgentMarkdown } from "../../components/AgentMarkdown";
import { AttachmentChip } from "../../components/AttachmentChip";
import { MediaSegmentView } from "../../components/MediaImage";
import { useI18n } from "../../components/useI18n";
import { parseMediaTokens } from "./mediaUtils";
import type { Attachment, ChatBubbleMessage, ChatMessage } from "./types";

export const APPROVAL_RE =
  /⚠️.*dangerous|requires? (your )?approval|\/approve.*\/deny|do you want (me )?to (proceed|continue|run|execute)/i;

function isChatBubbleMessage(msg: ChatMessage): msg is ChatBubbleMessage {
  return (
    msg.kind === "user" ||
    msg.kind === "assistant" ||
    (!msg.kind && (msg.role === "user" || msg.role === "agent"))
  );
}

export const HermesAvatar = memo(function HermesAvatar({
  size = 30,
}: {
  size?: number;
}): React.JSX.Element {
  return (
    <div className="chat-avatar chat-avatar-agent">
      <img src={icon} width={size} height={size} alt="" />
    </div>
  );
});

/* ── Thinking / Reasoning parser helper ─────────────────────────────── */

export function parseThinkingTags(content: string): { thinking: string; cleanContent: string } {
  if (!content) return { thinking: "", cleanContent: "" };

  const tags = ["think", "thinking", "reasoning", "thought", "REASONING_SCRATCHPAD"];
  const regex = new RegExp(
    `<(?:${tags.join("|")})(?:\\s[^>]*)?>([\\s\\S]*?)(?:</(?:${tags.join("|")})>|$)`,
    "gi"
  );

  let thinking = "";
  const cleanContent = content.replace(regex, (_, g1) => {
    thinking += (thinking ? "\n" : "") + g1.trim();
    return "";
  });

  return {
    thinking: thinking.trim(),
    cleanContent: cleanContent
  };
}

/* ── Collapsible primitives duplicated from HistoryRow.tsx ─────────── */

const Chevron = memo(function Chevron({
  open,
}: {
  open: boolean;
}): React.JSX.Element {
  return (
    <span
      className={`chat-history-chevron ${
        open ? "chat-history-chevron--open" : ""
      }`}
      aria-hidden="true"
    >
      ▸
    </span>
  );
});

interface CollapsibleSectionProps {
  variant: "reasoning" | "tool-call" | "tool-result";
  header: React.ReactNode;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

const CollapsibleSection = memo(function CollapsibleSection({
  variant,
  header,
  defaultOpen = false,
  children,
}: CollapsibleSectionProps): React.JSX.Element {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <details
      className={`chat-history chat-history--${variant}`}
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="chat-history-header">
        <Chevron open={open} />
        {header}
      </summary>
      <div className="chat-history-body">{children}</div>
    </details>
  );
});

const InlineThinking = memo(function InlineThinking({
  text,
  defaultOpen,
}: {
  text: string;
  defaultOpen: boolean;
}): React.JSX.Element {
  const { t } = useI18n();
  const lineCount = text.split("\n").length;
  return (
    <div style={{ marginBottom: "12px", width: "100%" }}>
      <CollapsibleSection
        variant="reasoning"
        defaultOpen={defaultOpen}
        header={
          <span className="chat-history-label">
            <span className="chat-history-title">{t("chat.thinking")}</span>
            <span className="chat-history-meta">
              {lineCount} {lineCount === 1 ? "line" : "lines"}
            </span>
          </span>
        }
      >
        <pre className="chat-history-pre">{text}</pre>
      </CollapsibleSection>
    </div>
  );
});

interface MessageRowProps {
  msg: ChatMessage;
  isLast: boolean;
  isLoading: boolean;
  onApprove: () => void;
  onDeny: () => void;
}

export const MessageRow = memo(function MessageRow({
  msg,
  isLast,
  isLoading,
  onApprove,
  onDeny,
}: MessageRowProps): React.JSX.Element {
  const { t } = useI18n();
  const [previewAttachment, setPreviewAttachment] = useState<Attachment | null>(
    null,
  );

  // MessageRow is wrapped in memo() but still re-renders on any prop change
  // (e.g. isLoading toggling at the end of a stream), and `parseMediaTokens`
  // runs a full regex pipeline. Cache the result against the message content
  // so a long conversation doesn't reparse every row on every render.
  // Only agent bubbles need media parsing — user bubbles render content
  // verbatim — so this is gated on the role to skip the work entirely for
  // user rows. (Follow-up item from PR #303 review.)
  const rawContent = isChatBubbleMessage(msg)
    ? (msg as ChatBubbleMessage).content
    : null;

  const { thinking, cleanContent } = useMemo(() => {
    if (msg.role !== "agent" || !rawContent) {
      return { thinking: "", cleanContent: rawContent || "" };
    }
    return parseThinkingTags(rawContent);
  }, [msg.role, rawContent]);

  const segments = useMemo(
    () =>
      msg.role === "agent" && cleanContent
        ? parseMediaTokens(cleanContent)
        : null,
    [msg.role, cleanContent],
  );

  // Only chat bubble messages have content/attachments
  if (!isChatBubbleMessage(msg)) {
    return (
      <div className={`chat-message chat-message-${msg.role}`}>
        <HermesAvatar />
        <div className={`chat-bubble chat-bubble-${msg.role}`}>
          {/* Reasoning/tool messages handled separately */}
        </div>
      </div>
    );
  }

  const showApprovalBar =
    msg.role === "agent" &&
    !isLoading &&
    isLast &&
    APPROVAL_RE.test(cleanContent || "");
  const hasAttachments = !!msg.attachments && msg.attachments.length > 0;

  return (
    <div className={`chat-message chat-message-${msg.role}`}>
      {msg.role === "user" ? (
        <div className="chat-avatar chat-avatar-user">U</div>
      ) : (
        <HermesAvatar />
      )}
      <div className={`chat-bubble chat-bubble-${msg.role}`}>
        {hasAttachments && (
          <div className="chat-message-attachments">
            {msg.attachments!.map((att) => (
              <AttachmentChip
                key={att.id}
                attachment={att}
                onPreview={(a) => a.kind === "image" && setPreviewAttachment(a)}
              />
            ))}
          </div>
        )}
        {thinking && (
          <InlineThinking
            text={thinking}
            defaultOpen={isLoading && isLast}
          />
        )}
        {cleanContent &&
          (msg.role === "agent" && segments
            ? segments.map((segment) =>
                segment.type === "text" ? (
                  segment.value.trim() ? (
                    // Keyed on the segment's character offset rather than its
                    // array index — a MEDIA: token appearing mid-stream shifts
                    // every subsequent index, which would otherwise re-mount
                    // each downstream MediaSegmentView and re-fire its
                    // `mediaFileExists` probe.
                    <AgentMarkdown key={`t-${segment.start}`}>
                      {segment.value}
                    </AgentMarkdown>
                  ) : null
                ) : (
                  <MediaSegmentView
                    key={`m-${segment.start}`}
                    token={segment.token}
                    raw={segment.raw}
                    source={segment.source}
                  />
                ),
              )
            : cleanContent)}
      </div>
      {showApprovalBar && (
        <div className="chat-approval-bar">
          <button
            className="chat-approval-btn chat-approve"
            onClick={onApprove}
          >
            {t("chat.approve")}
          </button>
          <button className="chat-approval-btn chat-deny" onClick={onDeny}>
            {t("chat.deny")}
          </button>
        </div>
      )}
      {previewAttachment && previewAttachment.dataUrl && (
        <div
          className="chat-image-preview-backdrop"
          onClick={() => setPreviewAttachment(null)}
          role="dialog"
          aria-modal="true"
        >
          <img
            src={previewAttachment.dataUrl}
            alt={previewAttachment.name}
            className="chat-image-preview-image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
});
