import { useEffect, useRef, useState, useCallback } from "react";

export interface GraphNode {
  id: string;
  label: string;
  group: string;
  degree: number;
  // Layout coordinates (assigned by tree layout)
  x?: number;
  y?: number;
}

export interface GraphLink {
  source: string;
  target: string;
}

interface VaultGraph3DProps {
  onSelectNote: (relPath: string) => void;
}

/* ────────────────────────────────────────────
   Layout helpers
   ──────────────────────────────────────────── */

interface LayoutNode extends GraphNode {
  x: number;
  y: number;
  level: number;
}

interface ResolvedLink {
  sourceNode: LayoutNode;
  targetNode: LayoutNode;
}

/** Compute adjacency + in-degree to find root candidates */
function buildAdjacency(nodes: GraphNode[], links: GraphLink[]) {
  const ids = new Set(nodes.map((n) => n.id));
  const children = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach((n) => {
    children.set(n.id, []);
    inDegree.set(n.id, 0);
  });

  links.forEach((l) => {
    if (!ids.has(l.source) || !ids.has(l.target)) return;
    children.get(l.source)!.push(l.target);
    inDegree.set(l.target, (inDegree.get(l.target) ?? 0) + 1);
  });

  return { children, inDegree };
}

/** BFS tree layout: roots at the top, children below */
function computeTreeLayout(
  nodes: GraphNode[],
  links: GraphLink[],
): { layoutNodes: LayoutNode[]; resolvedLinks: ResolvedLink[] } {
  if (nodes.length === 0) return { layoutNodes: [], resolvedLinks: [] };

  const { children, inDegree } = buildAdjacency(nodes, links);

  // Pick roots: nodes with zero in-degree, then fallback to highest-degree
  let roots = nodes.filter((n) => (inDegree.get(n.id) ?? 0) === 0);
  if (roots.length === 0) {
    // Fallback: pick the node with highest degree as root
    const sorted = [...nodes].sort((a, b) => b.degree - a.degree);
    roots = [sorted[0]];
  }

  // BFS to assign levels
  const visited = new Set<string>();
  const levelMap = new Map<string, number>();
  const queue: { id: string; level: number }[] = [];

  roots.forEach((r) => {
    if (!visited.has(r.id)) {
      visited.add(r.id);
      levelMap.set(r.id, 0);
      queue.push({ id: r.id, level: 0 });
    }
  });

  let head = 0;
  while (head < queue.length) {
    const { id, level } = queue[head++];
    const ch = children.get(id) ?? [];
    ch.forEach((cid) => {
      if (!visited.has(cid)) {
        visited.add(cid);
        levelMap.set(cid, level + 1);
        queue.push({ id: cid, level: level + 1 });
      }
    });
  }

  // Add any unvisited nodes (disconnected components) at their own level
  const maxLevelSoFar =
    queue.length > 0 ? Math.max(...queue.map((q) => q.level)) : -1;
  let extraLevel = maxLevelSoFar + 1;

  nodes.forEach((n) => {
    if (!visited.has(n.id)) {
      visited.add(n.id);
      levelMap.set(n.id, extraLevel);
      // Also BFS from this disconnected root
      const subQueue: { id: string; level: number }[] = [
        { id: n.id, level: extraLevel },
      ];
      let sh = 0;
      while (sh < subQueue.length) {
        const { id, level } = subQueue[sh++];
        const ch = children.get(id) ?? [];
        ch.forEach((cid) => {
          if (!visited.has(cid)) {
            visited.add(cid);
            levelMap.set(cid, level + 1);
            subQueue.push({ id: cid, level: level + 1 });
          }
        });
      }
      extraLevel =
        subQueue.length > 0
          ? Math.max(...subQueue.map((q) => q.level)) + 1
          : extraLevel + 1;
    }
  });

  // Group nodes by level
  const levels = new Map<number, GraphNode[]>();
  nodes.forEach((n) => {
    const lvl = levelMap.get(n.id) ?? 0;
    if (!levels.has(lvl)) levels.set(lvl, []);
    levels.get(lvl)!.push(n);
  });

  const maxLevel = Math.max(...levels.keys());
  const LEVEL_HEIGHT = 120; // vertical spacing between levels
  const NODE_SPACING = 100; // horizontal spacing between nodes on same level

  // Assign x,y positions
  const nodeMap = new Map<string, LayoutNode>();

  levels.forEach((nodesAtLevel, lvl) => {
    // Sort nodes within a level for visual consistency (by group then label)
    nodesAtLevel.sort((a, b) => {
      if (a.group !== b.group) return a.group.localeCompare(b.group);
      return a.label.localeCompare(b.label);
    });

    const totalWidth = (nodesAtLevel.length - 1) * NODE_SPACING;
    const startX = -totalWidth / 2;

    nodesAtLevel.forEach((n, i) => {
      const layoutNode: LayoutNode = {
        ...n,
        x: startX + i * NODE_SPACING,
        y: lvl * LEVEL_HEIGHT - (maxLevel * LEVEL_HEIGHT) / 2,
        level: lvl,
      };
      nodeMap.set(n.id, layoutNode);
    });
  });

  const layoutNodes = Array.from(nodeMap.values());

  // Resolve links
  const resolvedLinks: ResolvedLink[] = [];
  links.forEach((l) => {
    const s = nodeMap.get(l.source);
    const t = nodeMap.get(l.target);
    if (s && t) resolvedLinks.push({ sourceNode: s, targetNode: t });
  });

  return { layoutNodes, resolvedLinks };
}

/* ────────────────────────────────────────────
   Color helpers
   ──────────────────────────────────────────── */

function getGroupColor(group: string): string {
  if (group === "Journal") return "#eab308"; // gold
  if (group === "Daily Reviews") return "#ef4444"; // red/ruby
  if (group === "root") return "#a855f7"; // purple
  return "#3b82f6"; // blue
}

function getGroupColorRGBA(group: string, alpha: number): string {
  if (group === "Journal") return `rgba(234, 179, 8, ${alpha})`;
  if (group === "Daily Reviews") return `rgba(239, 68, 68, ${alpha})`;
  if (group === "root") return `rgba(168, 85, 247, ${alpha})`;
  return `rgba(59, 130, 246, ${alpha})`;
}

/* ────────────────────────────────────────────
   Component
   ──────────────────────────────────────────── */

export function VaultGraph3D({ onSelectNote }: VaultGraph3DProps): React.JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [data, setData] = useState<{ nodes: GraphNode[]; links: GraphLink[] } | null>(null);
  const [loading, setLoading] = useState(true);

  // Viewport transform refs (stable across renders)
  const zoomRef = useRef(1.0);
  const panRef = useRef({ x: 0, y: 0 });

  // Interaction state
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const panStartRef = useRef({ x: 0, y: 0 });
  const hoveredNodeRef = useRef<LayoutNode | null>(null);

  // Layout data (computed once per data change)
  const layoutRef = useRef<{
    nodes: LayoutNode[];
    links: ResolvedLink[];
    nodeMap: Map<string, LayoutNode>;
  }>({ nodes: [], links: [], nodeMap: new Map() });

  // Connected-node set for hover highlighting
  const connectedSetRef = useRef<Set<string>>(new Set());

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const g = await window.hermesAPI.selfGetVaultGraph();
      setData(g);
    } catch (err) {
      console.error("Failed to load vault graph data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // Main canvas effect
  useEffect(() => {
    if (!data || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // ── Compute layout once ──
    const { layoutNodes, resolvedLinks } = computeTreeLayout(data.nodes, data.links);
    const nodeMap = new Map<string, LayoutNode>();
    layoutNodes.forEach((n) => nodeMap.set(n.id, n));
    layoutRef.current = { nodes: layoutNodes, links: resolvedLinks, nodeMap };

    // Auto-fit: compute bounds and set initial zoom/pan
    if (layoutNodes.length > 0) {
      let minX = Infinity,
        maxX = -Infinity,
        minY = Infinity,
        maxY = -Infinity;
      layoutNodes.forEach((n) => {
        if (n.x < minX) minX = n.x;
        if (n.x > maxX) maxX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.y > maxY) maxY = n.y;
      });
      const graphW = maxX - minX + 200; // padding
      const graphH = maxY - minY + 200;
      const rect = canvas.getBoundingClientRect();
      const scaleX = rect.width / graphW;
      const scaleY = rect.height / graphH;
      zoomRef.current = Math.min(scaleX, scaleY, 1.5) * 0.85;
      panRef.current = { x: 0, y: 0 };
    }

    let animationId: number;
    let width = canvas.width;
    let height = canvas.height;

    // ── Resize ──
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
      width = canvas.width;
      height = canvas.height;
    };
    resize();
    window.addEventListener("resize", resize);

    // ── Transform helpers ──
    /** Convert graph (layout) coords → screen (CSS) coords */
    const graphToScreen = (gx: number, gy: number) => {
      const cx = width / (2 * window.devicePixelRatio);
      const cy = height / (2 * window.devicePixelRatio);
      return {
        sx: gx * zoomRef.current + cx + panRef.current.x,
        sy: gy * zoomRef.current + cy + panRef.current.y,
      };
    };

    // ── Draw functions ──
    const NODE_RADIUS = 10;

    const drawGrid = () => {
      const gridSpacing = 50 * zoomRef.current;
      if (gridSpacing < 10) return; // too dense

      const cx = width / (2 * window.devicePixelRatio);
      const cy = height / (2 * window.devicePixelRatio);
      const offX = (cx + panRef.current.x) % gridSpacing;
      const offY = (cy + panRef.current.y) % gridSpacing;
      const w = width / window.devicePixelRatio;
      const h = height / window.devicePixelRatio;

      ctx.strokeStyle = "rgba(255, 255, 255, 0.03)";
      ctx.lineWidth = 0.5;

      for (let x = offX; x < w; x += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, h);
        ctx.stroke();
      }
      for (let y = offY; y < h; y += gridSpacing) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }
    };

    const drawElbowLink = (
      link: ResolvedLink,
      isHighlighted: boolean,
    ) => {
      const s = graphToScreen(link.sourceNode.x, link.sourceNode.y);
      const t = graphToScreen(link.targetNode.x, link.targetNode.y);

      // Elbow: go vertical to midpoint, then horizontal, then vertical to target
      const midY = (s.sy + t.sy) / 2;

      ctx.beginPath();
      ctx.moveTo(s.sx, s.sy);
      ctx.lineTo(s.sx, midY);
      ctx.lineTo(t.sx, midY);
      ctx.lineTo(t.sx, t.sy);

      if (isHighlighted) {
        ctx.strokeStyle = "rgba(148, 200, 255, 0.7)";
        ctx.lineWidth = 2.5;
      } else {
        ctx.strokeStyle = "rgba(148, 163, 184, 0.18)";
        ctx.lineWidth = 1.5;
      }
      ctx.stroke();
    };

    const drawNode = (
      node: LayoutNode,
      isHovered: boolean,
      isConnected: boolean,
    ) => {
      const { sx, sy } = graphToScreen(node.x, node.y);
      const color = getGroupColor(node.group);
      const r = NODE_RADIUS * Math.min(zoomRef.current, 2);

      // Dim nodes that aren't connected to the hovered node
      const dimmed = hoveredNodeRef.current && !isHovered && !isConnected;

      // Outer glow
      if (isHovered || node.degree > 3) {
        ctx.beginPath();
        ctx.arc(sx, sy, r + (isHovered ? 6 : 3), 0, Math.PI * 2);
        ctx.fillStyle = getGroupColorRGBA(node.group, isHovered ? 0.25 : 0.1);
        ctx.fill();
      }

      // Core circle
      ctx.beginPath();
      ctx.arc(sx, sy, r, 0, Math.PI * 2);
      ctx.fillStyle = dimmed
        ? getGroupColorRGBA(node.group, 0.3)
        : color;
      ctx.fill();

      // Subtle border
      ctx.strokeStyle = dimmed
        ? "rgba(255,255,255,0.05)"
        : "rgba(255,255,255,0.2)";
      ctx.lineWidth = 1;
      ctx.stroke();

      // Label
      const showLabel =
        isHovered ||
        isConnected ||
        node.degree > 2 ||
        zoomRef.current > 0.8;

      if (showLabel) {
        const label =
          isHovered || node.label.length <= 20
            ? node.label
            : node.label.slice(0, 18) + "…";

        ctx.font = isHovered
          ? `bold ${Math.max(10, 12 * Math.min(zoomRef.current, 1.5))}px "Inter", "SF Pro", system-ui, sans-serif`
          : `${Math.max(8, 10 * Math.min(zoomRef.current, 1.5))}px "Inter", "SF Pro", system-ui, sans-serif`;
        ctx.fillStyle = dimmed
          ? "rgba(248, 250, 252, 0.2)"
          : isHovered
            ? "#fff"
            : "rgba(248, 250, 252, 0.7)";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(label, sx, sy + r + 5);
      }
    };

    // ── Main render loop (no physics, just redraws for pan/zoom/hover) ──
    const render = () => {
      ctx.clearRect(0, 0, width, height);
      ctx.save();
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);

      // Grid background
      drawGrid();

      const hovId = hoveredNodeRef.current?.id ?? null;
      const connSet = connectedSetRef.current;

      // Draw links
      resolvedLinks.forEach((link) => {
        const isHighlighted =
          hovId !== null &&
          (link.sourceNode.id === hovId || link.targetNode.id === hovId);
        drawElbowLink(link, isHighlighted);
      });

      // Draw nodes
      layoutNodes.forEach((node) => {
        const isHovered = node.id === hovId;
        const isConnected = connSet.has(node.id);
        drawNode(node, isHovered, isConnected);
      });

      ctx.restore();
      animationId = requestAnimationFrame(render);
    };

    render();

    // ── Mouse helpers ──
    const getMousePos = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };

    const findNodeAtPos = (pos: { x: number; y: number }): LayoutNode | null => {
      const hitRadius = NODE_RADIUS * Math.min(zoomRef.current, 2) + 4;
      let closest: LayoutNode | null = null;
      let minDist = hitRadius;

      for (const node of layoutNodes) {
        const { sx, sy } = graphToScreen(node.x, node.y);
        const dx = sx - pos.x;
        const dy = sy - pos.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist) {
          minDist = dist;
          closest = node;
        }
      }
      return closest;
    };

    const updateConnectedSet = (nodeId: string | null) => {
      const s = new Set<string>();
      if (nodeId) {
        s.add(nodeId);
        resolvedLinks.forEach((l) => {
          if (l.sourceNode.id === nodeId) s.add(l.targetNode.id);
          if (l.targetNode.id === nodeId) s.add(l.sourceNode.id);
        });
      }
      connectedSetRef.current = s;
    };

    // ── Event handlers ──
    const handleMouseDown = (e: MouseEvent) => {
      isDraggingRef.current = true;
      dragStartRef.current = getMousePos(e);
      panStartRef.current = { ...panRef.current };
    };

    const handleMouseMove = (e: MouseEvent) => {
      const pos = getMousePos(e);

      if (isDraggingRef.current) {
        // Pan
        const dx = pos.x - dragStartRef.current.x;
        const dy = pos.y - dragStartRef.current.y;
        panRef.current = {
          x: panStartRef.current.x + dx,
          y: panStartRef.current.y + dy,
        };
        canvas.style.cursor = "grabbing";
        return;
      }

      // Hover detection
      const node = findNodeAtPos(pos);
      if (node !== hoveredNodeRef.current) {
        hoveredNodeRef.current = node;
        updateConnectedSet(node?.id ?? null);
        canvas.style.cursor = node ? "pointer" : "default";
      }
    };

    const handleMouseUp = () => {
      isDraggingRef.current = false;
      canvas.style.cursor = "default";
    };

    const handleClick = (e: MouseEvent) => {
      // Ignore if we actually dragged
      const pos = getMousePos(e);
      const dx = pos.x - dragStartRef.current.x;
      const dy = pos.y - dragStartRef.current.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) return; // was a drag, not click

      const node = findNodeAtPos(pos);
      if (node) {
        onSelectNote(node.id);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();

      const pos = getMousePos(e);
      const oldZoom = zoomRef.current;

      // Zoom toward cursor position
      const newZoom = Math.max(0.15, Math.min(5, oldZoom - e.deltaY * 0.001));
      const zoomRatio = newZoom / oldZoom;

      // Adjust pan so the point under the cursor stays in place
      const cx = width / (2 * window.devicePixelRatio);
      const cy = height / (2 * window.devicePixelRatio);
      const cursorRelX = pos.x - cx - panRef.current.x;
      const cursorRelY = pos.y - cy - panRef.current.y;

      panRef.current = {
        x: panRef.current.x - cursorRelX * (zoomRatio - 1),
        y: panRef.current.y - cursorRelY * (zoomRatio - 1),
      };
      zoomRef.current = newZoom;
    };

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseup", handleMouseUp);
    canvas.addEventListener("mouseleave", handleMouseUp);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    canvas.addEventListener("click", handleClick);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseup", handleMouseUp);
      canvas.removeEventListener("mouseleave", handleMouseUp);
      canvas.removeEventListener("wheel", handleWheel);
      canvas.removeEventListener("click", handleClick);
    };
  }, [data, onSelectNote]);

  if (loading) {
    return (
      <div className="self-graph-loading">
        <div className="loading-spinner" />
        <span style={{ marginTop: 12 }}>Computing Vault Connectivity...</span>
      </div>
    );
  }

  const nodesCount = data?.nodes.length || 0;
  const linksCount = data?.links.length || 0;

  return (
    <div className="self-graph-container" ref={containerRef}>
      <div className="self-graph-stats">
        <div>
          <span className="self-stat-label">Total Notes</span>
          <span className="self-stat-val">{nodesCount}</span>
        </div>
        <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 12 }}>
          <span className="self-stat-label">Connections</span>
          <span className="self-stat-val">{linksCount}</span>
        </div>
      </div>
      <canvas ref={canvasRef} className="self-graph-canvas" />
      <div className="self-graph-legend">
        <div className="legend-item"><span className="dot" style={{ background: "#eab308" }}></span> Journal</div>
        <div className="legend-item"><span className="dot" style={{ background: "#ef4444" }}></span> Daily Reviews</div>
        <div className="legend-item"><span className="dot" style={{ background: "#a855f7" }}></span> Root folder</div>
        <div className="legend-item"><span className="dot" style={{ background: "#3b82f6" }}></span> Subfolders</div>
      </div>
    </div>
  );
}
