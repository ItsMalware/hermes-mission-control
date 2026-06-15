/**
 * notion-tickets.ts — Direct Notion API client for querying the
 * Command_Tasks database. Uses the NOTION_API_KEY from the profile's
 * .env file and the Notion REST API v2022-06-28.
 *
 * Unlike the NotebookLM bridge (which spawns an MCP stdio child
 * process), this module calls the Notion HTTP API directly — simpler,
 * faster, and no extra dependency.
 */

import { readEnv } from "./config";

/* ─── Types ────────────────────────────────────────────────────────────── */

export interface NotionTicket {
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

export interface NotionTicketsResult {
  success: boolean;
  tickets?: NotionTicket[];
  error?: string;
}

/* ─── Helpers ──────────────────────────────────────────────────────────── */

function getNotionApiKey(profile?: string): string | null {
  const env = readEnv(profile);
  return env.NOTION_API_KEY || env.NOTION_TOKEN || null;
}

/**
 * Extract a plain-text string from a Notion rich_text array.
 */
function richTextToPlain(
  richText: Array<{ plain_text?: string }> | undefined,
): string {
  if (!richText || !Array.isArray(richText)) return "";
  return richText.map((t) => t.plain_text || "").join("");
}

/**
 * Extract a property value from a Notion page object.
 */
function extractProperty(
  props: Record<string, any>,
  name: string,
): string {
  const prop = props[name];
  if (!prop) return "";
  switch (prop.type) {
    case "title":
      return richTextToPlain(prop.title);
    case "rich_text":
      return richTextToPlain(prop.rich_text);
    case "select":
      return prop.select?.name || "";
    case "multi_select":
      return (prop.multi_select || []).map((s: any) => s.name).join(", ");
    case "status":
      return prop.status?.name || "";
    case "date":
      return prop.date?.start || "";
    case "number":
      return prop.number != null ? String(prop.number) : "";
    case "checkbox":
      return prop.checkbox ? "Yes" : "No";
    case "url":
      return prop.url || "";
    case "formula":
      if (prop.formula?.type === "string") return prop.formula.string || "";
      if (prop.formula?.type === "number")
        return prop.formula.number != null
          ? String(prop.formula.number)
          : "";
      if (prop.formula?.type === "boolean")
        return prop.formula.boolean ? "Yes" : "No";
      if (prop.formula?.type === "date")
        return prop.formula.date?.start || "";
      return "";
    default:
      return "";
  }
}

/* ─── Public API ───────────────────────────────────────────────────────── */

/**
 * Query the Notion Command_Tasks database for tickets from the last
 * 30 days, excluding the 'Founder To-Do' queue.
 */
export async function queryNotionTickets(
  databaseId: string,
  profile?: string,
): Promise<NotionTicketsResult> {
  const apiKey = getNotionApiKey(profile);
  if (!apiKey) {
    return {
      success: false,
      error:
        "NOTION_API_KEY not found. Add it in Settings → Environment.",
    };
  }

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const since = thirtyDaysAgo.toISOString().split("T")[0]; // YYYY-MM-DD

  // Notion filter: created in last 30 days, queue ≠ "Founder To-Do"
  const filter = {
    and: [
      {
        timestamp: "created_time",
        created_time: { on_or_after: since },
      },
      {
        // Try common property names for the queue/label column
        or: [
          {
            property: "Queue",
            select: { does_not_equal: "Founder To-Do" },
          },
          {
            property: "Queue",
            multi_select: { does_not_contain: "Founder To-Do" },
          },
        ],
      },
    ],
  };

  const sorts = [
    { timestamp: "created_time", direction: "descending" as const },
  ];

  try {
    const allPages: any[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, unknown> = {
        filter,
        sorts,
        page_size: 100,
      };
      if (startCursor) body.start_cursor = startCursor;

      const res = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        // If the filter shape doesn't match (e.g. Queue property not found),
        // retry without the Queue filter
        if (res.status === 400 && allPages.length === 0) {
          return queryNotionTicketsFallback(databaseId, apiKey, since);
        }
        return {
          success: false,
          error: `Notion API ${res.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await res.json();
      allPages.push(...(data.results || []));
      hasMore = data.has_more || false;
      startCursor = data.next_cursor || undefined;
    }

    const tickets: NotionTicket[] = allPages
      .filter((page: any) => {
        // Client-side filter for Founder To-Do in case the API filter missed it
        const queue =
          extractProperty(page.properties, "Queue") ||
          extractProperty(page.properties, "queue") ||
          extractProperty(page.properties, "Label") ||
          extractProperty(page.properties, "label");
        return !queue.includes("Founder To-Do");
      })
      .map((page: any) => {
        const props = page.properties || {};
        // Try multiple common property name patterns
        const title =
          extractProperty(props, "Name") ||
          extractProperty(props, "Title") ||
          extractProperty(props, "Task") ||
          extractProperty(props, "title") ||
          extractProperty(props, "name") ||
          "(Untitled)";
        const status =
          extractProperty(props, "Status") ||
          extractProperty(props, "status") ||
          "Unknown";
        const priority =
          extractProperty(props, "Priority") ||
          extractProperty(props, "priority") ||
          "";
        const completionDate =
          extractProperty(props, "Completion Date") ||
          extractProperty(props, "completion_date") ||
          extractProperty(props, "Done Date") ||
          extractProperty(props, "Completed") ||
          null;
        const notes =
          extractProperty(props, "Notes") ||
          extractProperty(props, "notes") ||
          extractProperty(props, "Description") ||
          extractProperty(props, "description") ||
          "";
        const queue =
          extractProperty(props, "Queue") ||
          extractProperty(props, "queue") ||
          extractProperty(props, "Label") ||
          "";

        return {
          id: page.id,
          title,
          status,
          priority,
          completionDate: completionDate || null,
          notes: notes.slice(0, 200),
          url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
          createdTime: page.created_time || "",
          queue,
        };
      });

    return { success: true, tickets };
  } catch (err) {
    return {
      success: false,
      error: `Failed to query Notion: ${(err as Error).message}`,
    };
  }
}

/**
 * Fallback query without the Queue filter (in case the property
 * doesn't exist or uses a different type).
 */
async function queryNotionTicketsFallback(
  databaseId: string,
  apiKey: string,
  since: string,
): Promise<NotionTicketsResult> {
  const filter = {
    timestamp: "created_time",
    created_time: { on_or_after: since },
  };

  const sorts = [
    { timestamp: "created_time", direction: "descending" as const },
  ];

  try {
    const allPages: any[] = [];
    let startCursor: string | undefined;
    let hasMore = true;

    while (hasMore) {
      const body: Record<string, unknown> = {
        filter,
        sorts,
        page_size: 100,
      };
      if (startCursor) body.start_cursor = startCursor;

      const res = await fetch(
        `https://api.notion.com/v1/databases/${databaseId}/query`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${apiKey}`,
            "Notion-Version": "2022-06-28",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      if (!res.ok) {
        const errText = await res.text();
        return {
          success: false,
          error: `Notion API ${res.status}: ${errText.slice(0, 300)}`,
        };
      }

      const data = await res.json();
      allPages.push(...(data.results || []));
      hasMore = data.has_more || false;
      startCursor = data.next_cursor || undefined;
    }

    const tickets: NotionTicket[] = allPages
      .filter((page: any) => {
        const queue =
          extractProperty(page.properties, "Queue") ||
          extractProperty(page.properties, "queue") ||
          extractProperty(page.properties, "Label") ||
          extractProperty(page.properties, "label");
        return !queue.includes("Founder To-Do");
      })
      .map((page: any) => {
        const props = page.properties || {};
        const title =
          extractProperty(props, "Name") ||
          extractProperty(props, "Title") ||
          extractProperty(props, "Task") ||
          extractProperty(props, "title") ||
          extractProperty(props, "name") ||
          "(Untitled)";
        const status =
          extractProperty(props, "Status") ||
          extractProperty(props, "status") ||
          "Unknown";
        const priority =
          extractProperty(props, "Priority") ||
          extractProperty(props, "priority") ||
          "";
        const completionDate =
          extractProperty(props, "Completion Date") ||
          extractProperty(props, "completion_date") ||
          extractProperty(props, "Done Date") ||
          extractProperty(props, "Completed") ||
          null;
        const notes =
          extractProperty(props, "Notes") ||
          extractProperty(props, "notes") ||
          extractProperty(props, "Description") ||
          extractProperty(props, "description") ||
          "";
        const queue =
          extractProperty(props, "Queue") ||
          extractProperty(props, "queue") ||
          extractProperty(props, "Label") ||
          "";

        return {
          id: page.id,
          title,
          status,
          priority,
          completionDate: completionDate || null,
          notes: notes.slice(0, 200),
          url: page.url || `https://notion.so/${page.id.replace(/-/g, "")}`,
          createdTime: page.created_time || "",
          queue,
        };
      });

    return { success: true, tickets };
  } catch (err) {
    return {
      success: false,
      error: `Failed to query Notion: ${(err as Error).message}`,
    };
  }
}
