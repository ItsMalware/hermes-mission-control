import { useState, useEffect, useCallback } from "react";
import { Refresh, ExternalLink, Spinner } from "../../assets/icons";

/* ── Constants ───────────────────────────────────────────────────────── */

const DATABASE_ID = "9674c632-1cc9-43ac-bc1c-b5a10286a01d";

/**
 * Status groups – tickets are bucketed by normalised status name so
 * unknown statuses land in a sensible place.
 */
const STATUS_ORDER = ["In Progress", "To Do", "Done"] as const;

function normaliseStatus(raw: string): (typeof STATUS_ORDER)[number] {
  const lower = raw.toLowerCase().trim();
  if (lower.includes("progress") || lower.includes("doing")) return "In Progress";
  if (lower === "done" || lower === "complete" || lower.includes("completed")) return "Done";
  return "To Do";
}

const STATUS_COLORS: Record<string, string> = {
  "In Progress": "#f59e0b",
  "To Do": "#6366f1",
  Done: "#22c55e",
};

const PRIORITY_COLORS: Record<string, string> = {
  High: "#ef4444",
  Medium: "#f59e0b",
  Low: "#6366f1",
  Urgent: "#dc2626",
};

/* ── Types ───────────────────────────────────────────────────────────── */

interface Ticket {
  id: string;
  title: string;
  status: string;
  priority: string;
  completionDate: string | null;
  notes: string;
  url: string;
  createdTime: string;
  queue: string;
}

interface NotionTicketsProps {
  profile?: string;
}

/* ── Component ───────────────────────────────────────────────────────── */

export default function NotionTickets({ profile }: NotionTicketsProps): React.JSX.Element {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const loadTickets = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError("");
      const result = await window.hermesAPI.notionQueryTickets(
        DATABASE_ID,
        profile,
      );
      if (result.success && result.tickets) {
        setTickets(result.tickets);
      } else {
        setError(result.error || "Failed to load tickets");
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [profile]);

  useEffect(() => {
    loadTickets();
  }, [loadTickets]);

  /* ── Group tickets by normalised status ─────────────────────────── */

  const grouped = tickets.reduce<Record<string, Ticket[]>>((acc, t) => {
    const key = normaliseStatus(t.status);
    if (!acc[key]) acc[key] = [];
    acc[key].push(t);
    return acc;
  }, {});

  const openInNotion = (url: string): void => {
    window.hermesAPI.openExternal(url);
  };

  /* ── Render ─────────────────────────────────────────────────────── */

  return (
    <div style={containerStyle}>
      {/* Toolbar */}
      <div style={toolbarStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={titleStyle}>Notion Tickets</span>
          <span style={badgeStyle}>{tickets.length}</span>
        </div>
        <button
          style={refreshBtnStyle}
          onClick={loadTickets}
          disabled={loading}
          title="Refresh"
        >
          {loading ? <Spinner size={14} className="spin" /> : <Refresh size={14} />}
          Refresh
        </button>
      </div>

      {/* Loading */}
      {loading && tickets.length === 0 && (
        <div style={emptyStyle}>
          <Spinner size={20} className="spin" />
          <span>Loading tickets from Notion…</span>
        </div>
      )}

      {/* Error */}
      {error && (
        <div style={errorStyle}>
          <span>⚠ {error}</span>
          <button style={retryBtnStyle} onClick={loadTickets}>
            Retry
          </button>
        </div>
      )}

      {/* Empty */}
      {!loading && !error && tickets.length === 0 && (
        <div style={emptyStyle}>
          <span style={{ fontSize: 14 }}>No tickets found in the last 30 days.</span>
        </div>
      )}

      {/* Ticket Groups */}
      {!error && tickets.length > 0 && (
        <div style={scrollAreaStyle}>
          {STATUS_ORDER.map((status) => {
            const group = grouped[status];
            if (!group || group.length === 0) return null;
            return (
              <div key={status} style={groupStyle}>
                <div style={groupHeaderStyle}>
                  <span
                    style={{
                      ...statusDotStyle,
                      backgroundColor: STATUS_COLORS[status] || "#888",
                    }}
                  />
                  <span style={groupLabelStyle}>{status}</span>
                  <span style={groupCountStyle}>{group.length}</span>
                </div>
                <div style={ticketListStyle}>
                  {group.map((ticket) => (
                    <div
                      key={ticket.id}
                      style={{
                        ...ticketCardStyle,
                        ...(expandedId === ticket.id ? ticketCardExpandedStyle : {}),
                      }}
                      onClick={() =>
                        setExpandedId(expandedId === ticket.id ? null : ticket.id)
                      }
                    >
                      <div style={ticketTopRowStyle}>
                        <span style={ticketTitleStyle}>{ticket.title}</span>
                        <button
                          style={openBtnStyle}
                          title="Open in Notion"
                          onClick={(e) => {
                            e.stopPropagation();
                            openInNotion(ticket.url);
                          }}
                        >
                          <ExternalLink size={12} />
                        </button>
                      </div>

                      <div style={ticketMetaRowStyle}>
                        {ticket.priority && (
                          <span
                            style={{
                              ...metaPillStyle,
                              color: PRIORITY_COLORS[ticket.priority] || "#aaa",
                              borderColor:
                                PRIORITY_COLORS[ticket.priority] || "#555",
                            }}
                          >
                            {ticket.priority}
                          </span>
                        )}
                        {ticket.queue && (
                          <span style={metaPillStyle}>{ticket.queue}</span>
                        )}
                        {ticket.completionDate && (
                          <span style={metaDateStyle}>
                            ✓ {ticket.completionDate}
                          </span>
                        )}
                        <span style={metaDateStyle}>
                          Created{" "}
                          {new Date(ticket.createdTime).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" },
                          )}
                        </span>
                      </div>

                      {expandedId === ticket.id && ticket.notes && (
                        <div style={notesStyle}>{ticket.notes}</div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { animation: spin 1s linear infinite; }
      `}</style>
    </div>
  );
}

/* ── Inline Styles (matching dark-theme CSS vars) ────────────────────── */

const containerStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  width: "100%",
  height: "100%",
  overflow: "hidden",
  gap: 12,
  padding: "8px 0",
};

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0 4px",
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 700,
  color: "var(--text-primary)",
};

const badgeStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--accent-text)",
  background: "var(--accent-subtle)",
  borderRadius: 10,
  padding: "2px 8px",
};

const refreshBtnStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 5,
  background: "var(--panel-bg-soft)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--radius-sm, 6px)",
  color: "var(--text-secondary)",
  cursor: "pointer",
  fontSize: 12,
  fontWeight: 600,
  padding: "5px 10px",
};

const scrollAreaStyle: React.CSSProperties = {
  flex: 1,
  overflowY: "auto",
  display: "flex",
  flexDirection: "column",
  gap: 20,
  paddingRight: 4,
};

const groupStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const groupHeaderStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "0 4px",
};

const statusDotStyle: React.CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: "50%",
  flexShrink: 0,
};

const groupLabelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.04em",
  color: "var(--text-secondary)",
};

const groupCountStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 700,
  color: "var(--text-muted)",
  background: "var(--panel-bg-soft)",
  borderRadius: 8,
  padding: "1px 6px",
};

const ticketListStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
};

const ticketCardStyle: React.CSSProperties = {
  background: "var(--panel-bg-soft)",
  border: "1px solid var(--panel-border)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "10px 12px",
  cursor: "pointer",
  transition: "background 0.15s, border-color 0.15s",
};

const ticketCardExpandedStyle: React.CSSProperties = {
  borderColor: "color-mix(in srgb, var(--accent) 45%, var(--panel-border))",
  background: "var(--accent-subtle)",
};

const ticketTopRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  justifyContent: "space-between",
  gap: 8,
};

const ticketTitleStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: "var(--text-primary)",
  lineHeight: 1.35,
  flex: 1,
};

const openBtnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "var(--text-muted)",
  cursor: "pointer",
  padding: 2,
  display: "inline-flex",
  alignItems: "center",
  flexShrink: 0,
};

const ticketMetaRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 6,
  marginTop: 6,
  flexWrap: "wrap" as const,
};

const metaPillStyle: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 600,
  border: "1px solid var(--panel-border)",
  borderRadius: 4,
  padding: "1px 6px",
  color: "var(--text-muted)",
};

const metaDateStyle: React.CSSProperties = {
  fontSize: 10,
  color: "var(--text-muted)",
};

const notesStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  lineHeight: 1.45,
  marginTop: 8,
  padding: "8px 0 0",
  borderTop: "1px solid var(--panel-border)",
  whiteSpace: "pre-wrap" as const,
};

const emptyStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  gap: 10,
  flex: 1,
  color: "var(--text-muted)",
  fontSize: 13,
};

const errorStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  gap: 10,
  background: "rgba(239, 68, 68, 0.08)",
  border: "1px solid rgba(239, 68, 68, 0.25)",
  borderRadius: "var(--radius-md, 8px)",
  padding: "10px 14px",
  color: "#ef4444",
  fontSize: 12,
};

const retryBtnStyle: React.CSSProperties = {
  background: "rgba(239, 68, 68, 0.12)",
  border: "1px solid rgba(239, 68, 68, 0.3)",
  borderRadius: 4,
  color: "#ef4444",
  cursor: "pointer",
  fontSize: 11,
  fontWeight: 600,
  padding: "3px 8px",
};
