"use client";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Edge,
  type Node,
  type NodeMouseHandler,
} from "@xyflow/react";
import { topologyConfig } from "@/config/monitor";
import { usePolling } from "@/app/hooks/usePolling";
import { summarize } from "@/lib/judge";
import { TargetNode, type TargetNodeData } from "./TargetNode";
import type { MuteList } from "@/app/hooks/useMuteList";
import type {
  BasicData,
  CollectorResult,
  OverviewResponse,
  TargetCollected,
  TargetOverview,
} from "@/lib/types";

const CATEGORY_LABEL: Record<string, string> = {
  hardware: "ハードウェア",
  software: "ソフトウェア",
  network: "ネットワーク",
  security: "セキュリティ",
};

const nodeTypes = { target: TargetNode };

const FALLBACK_X = 40;
const FALLBACK_Y = 40;
const SPACING = 220;

// 詳細ビューと同じ summarize() を呼び、muteList を加味して集計する。
// サーバ側で集計するとユーザーごとの mute が反映されないため、必ずクライアントで集計する。
function buildOverview(t: TargetCollected, muteList: MuteList): TargetOverview {
  if (t.error) {
    return {
      ref: t.ref,
      severity: "unknown",
      grade: "caution",
      gradeLabel: "取得不可",
      score: 0,
      primary: null,
      message: "概観の取得に失敗しました",
      error: t.error,
    };
  }
  // service kind は basic を持たないので、判定対象外のダミー host を使う。
  const collectedAt = new Date().toISOString();
  const dummyErr = <T,>(): CollectorResult<T> => ({
    ok: false,
    error: "n/a",
    reason: "other",
    collectedAt,
  });
  const basic: BasicData =
    t.basic ??
    ({
      kind: "host",
      cpu: dummyErr(),
      mem: dummyErr(),
      load: dummyErr(),
      uptime: dummyErr(),
      disk: dummyErr(),
      netLink: dummyErr(),
    } as BasicData);
  const s = summarize({
    basic,
    health: t.health,
    services: t.services,
    probes: t.probes,
    userIgnore: muteList,
  });
  return {
    ref: t.ref,
    severity: s.overall,
    grade: s.grade,
    gradeLabel: s.gradeLabel,
    score: s.score,
    primary: s.primary,
    message: s.message,
  };
}

export function TopologyView({
  onSelectTarget,
  muteList,
}: {
  onSelectTarget: (id: string) => void;
  muteList: MuteList;
}) {
  const overview = usePolling<OverviewResponse>("/api/overview", 30000);

  const { nodes, edges } = useMemo<{
    nodes: Node[];
    edges: Edge[];
  }>(() => {
    const data = overview.data;
    if (!data) return { nodes: [], edges: [] };
    const summaries = data.targets.map((t) => buildOverview(t, muteList));
    const nodes: Node[] = summaries.map((o, i) => {
      const pos =
        topologyConfig.positions[o.ref.id] ?? {
          x: FALLBACK_X + (i % 4) * SPACING,
          y: FALLBACK_Y + Math.floor(i / 4) * 180,
        };
      const nodeData: TargetNodeData = {
        label: o.ref.name,
        kind: o.ref.kind,
        severity: o.severity,
        grade: o.grade,
        gradeLabel: o.gradeLabel,
        score: o.score,
        primary: o.primary ? CATEGORY_LABEL[o.primary] ?? o.primary : null,
        error: o.error,
      };
      return {
        id: o.ref.id,
        type: "target",
        position: pos,
        data: nodeData,
      };
    });
    const edges: Edge[] = data.links.map((l, i) => ({
      id: `e-${i}-${l.from}-${l.to}`,
      source: l.from,
      target: l.to,
      label: l.label,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#a1a1aa" },
    }));
    return { nodes, edges };
  }, [overview.data, muteList]);

  const onNodeClick: NodeMouseHandler = (_e, node) => {
    onSelectTarget(node.id);
  };

  return (
    <div className="space-y-2">
      <div className="text-xs text-zinc-500 dark:text-zinc-400">
        {overview.error
          ? `取得失敗: ${overview.error}`
          : overview.data
            ? `${overview.data.targets.length} 件のターゲットを表示中（クリックで詳細）`
            : "読み込み中…"}
      </div>
      <div
        className="rounded-lg ring-1 ring-zinc-200 dark:ring-zinc-800 bg-zinc-50 dark:bg-zinc-950"
        style={{ height: 540 }}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          onNodeClick={onNodeClick}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
          nodesConnectable={false}
          edgesReconnectable={false}
        >
          <Background gap={20} size={1} color="#d4d4d8" />
          <Controls showInteractive={false} />
        </ReactFlow>
      </div>
    </div>
  );
}
