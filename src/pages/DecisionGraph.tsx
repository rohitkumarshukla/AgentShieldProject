import { useState } from "react";

type Path = "block" | "approve" | "allow" | null;

const nodes = [
  { id: "user", label: "User Request", sub: "Natural language instruction", x: 50, y: 0, w: 160 },
  { id: "agent", label: "AI Agent", sub: "Structured tool call proposed", x: 50, y: 80, w: 160 },
  { id: "toolcall", label: "Tool Call", sub: "Structured operation + params", x: 50, y: 160, w: 160 },
  { id: "interceptor", label: "AgentShield Interceptor", sub: "Action captured, not executed", x: 50, y: 240, w: 160, highlight: true },
  { id: "risk", label: "Risk Engine", sub: "Deterministic factor scoring", x: 50, y: 320, w: 160 },
  { id: "policy", label: "Policy Engine", sub: "Rule evaluation + decision", x: 50, y: 400, w: 160 },
];

const outcomes = [
  { id: "allow", label: "ALLOW", color: "emerald", x: -130, y: 500 },
  { id: "approve", label: "APPROVAL", color: "amber", x: 50, y: 500 },
  { id: "block", label: "BLOCK", color: "red", x: 230, y: 500 },
];

export default function DecisionGraph() {
  const [activePath, setActivePath] = useState<Path>(null);

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Decision Graph</h1>
        <p className="text-sm text-slate-500 mt-0.5">Every agent action flows through this architecture before execution.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Graph */}
        <div className="lg:col-span-2 bg-[#0d1424] border border-[#1e293b] rounded-xl p-6 bg-grid">
          {/* Path selector */}
          <div className="flex items-center gap-2 mb-6">
            <span className="text-xs text-slate-500">Highlight path:</span>
            {(["block", "approve", "allow"] as Path[]).filter(Boolean).map((p) => (
              <button
                key={p!}
                onClick={() => setActivePath(activePath === p ? null : p)}
                className={`px-3 py-1 rounded text-xs font-mono border transition-all ${
                  activePath === p
                    ? p === "block" ? "bg-red-500/20 text-red-400 border-red-500/40" :
                      p === "approve" ? "bg-amber-500/20 text-amber-400 border-amber-500/40" :
                      "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                    : "bg-[#111827] text-slate-400 border-[#1e293b]"
                }`}
              >
                {p!.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Vertical pipeline */}
          <div className="flex flex-col items-center gap-0 max-w-sm mx-auto">
            {nodes.map((n, i) => (
              <div key={n.id} className="flex flex-col items-center w-full">
                <div className={`w-full rounded-lg border px-4 py-3 transition-all ${
                  n.highlight
                    ? "bg-blue-950/30 border-blue-500/40 shadow-lg shadow-blue-950/30"
                    : "bg-[#111827] border-[#1e293b]"
                }`}>
                  <div className={`text-sm font-semibold ${n.highlight ? "text-blue-300" : "text-slate-200"}`}>{n.label}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{n.sub}</div>
                </div>
                {i < nodes.length - 1 && (
                  <div className={`w-px h-6 transition-colors ${activePath ? "bg-blue-500" : "bg-[#2d3f5a]"}`} />
                )}
              </div>
            ))}

            {/* Branch */}
            <div className="flex items-start gap-3 w-full mt-0">
              <div className={`w-px h-6 mx-auto transition-colors ${activePath ? "bg-blue-500" : "bg-[#2d3f5a]"}`} />
            </div>
            <div className="grid grid-cols-3 gap-3 w-full">
              {outcomes.map((o) => {
                const colorMap: Record<string, string> = {
                  emerald: "border-emerald-500/40 bg-emerald-950/20 text-emerald-400",
                  amber: "border-amber-500/40 bg-amber-950/20 text-amber-400",
                  red: "border-red-500/40 bg-red-950/20 text-red-400",
                };
                const active = activePath === o.id;
                return (
                  <div key={o.id} className={`rounded-lg border px-3 py-3 text-center transition-all ${
                    active
                      ? colorMap[o.color] + " shadow-lg"
                      : "border-[#1e293b] bg-[#111827] text-slate-500"
                  }`}>
                    <div className={`text-sm font-bold font-mono ${active ? colorMap[o.color].split(" ")[2] : "text-slate-500"}`}>{o.label}</div>
                    <div className="text-xs mt-1 opacity-70">
                      {o.id === "allow" ? "→ Tool Execution" :
                       o.id === "approve" ? "→ Human Review" :
                       "→ Halted"}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Audit log */}
            <div className={`w-px h-6 mt-0 transition-colors ${activePath ? "bg-blue-400/50" : "bg-[#2d3f5a]"}`} />
            <div className="w-full rounded-lg border border-[#2d3f5a] bg-[#0d1424] px-4 py-3 text-center">
              <div className="text-sm text-slate-300 font-semibold">Audit Log</div>
              <div className="text-xs text-slate-500">Every decision recorded immutably</div>
            </div>
          </div>
        </div>

        {/* Sidebar info */}
        <div className="space-y-4">
          {/* MCP readiness */}
          <div className="bg-[#0d1424] border border-blue-500/20 rounded-xl p-5 space-y-3">
            <div className="flex items-center gap-2">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400">
                <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/>
              </svg>
              <span className="text-sm font-semibold text-blue-300">MCP Ready</span>
              <span className="px-1.5 py-0.5 bg-blue-500/15 text-blue-400 border border-blue-500/30 rounded text-[10px] font-mono">Architecture-ready</span>
            </div>
            <div className="font-mono text-xs text-slate-400 space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-slate-300">Agent</span>
                <span className="text-slate-600">→</span>
                <span className="text-blue-300">AgentShield</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-300">MCP</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-300">Tool</span>
              </div>
            </div>
            <p className="text-xs text-slate-500">Native MCP gateway integration — roadmap. AgentShield intercepts at the tool-call boundary regardless of integration method.</p>
          </div>

          {/* Key properties */}
          <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Architecture Properties</div>
            {[
              { label: "LLM-independent authorization", ok: true },
              { label: "Deterministic risk scoring", ok: true },
              { label: "Tool-agnostic interception", ok: true },
              { label: "Immutable audit trail", ok: true },
              { label: "Human-in-the-loop approval", ok: true },
              { label: "Scoped agent identities", ok: true },
              { label: "Recovery metadata capture", ok: true },
            ].map((p) => (
              <div key={p.label} className="flex items-center gap-2 text-xs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400 shrink-0">
                  <path d="M5 13l4 4L19 7"/>
                </svg>
                <span className="text-slate-400">{p.label}</span>
              </div>
            ))}
          </div>

          {/* Tech stack */}
          <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-3">
            <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">Tech Stack</div>
            {[
              { label: "Frontend", value: "React + Tailwind CSS", icon: "⬡" },
              { label: "Visualization", value: "React Flow", icon: "◈" },
              { label: "Real-time", value: "Socket.IO", icon: "⚡" },
              { label: "Backend", value: "Node.js + Express", icon: "◉" },
              { label: "Database", value: "PostgreSQL + Prisma", icon: "▣" },
              { label: "AI", value: "Structured outputs / tool calling", icon: "◎" },
              { label: "Auth", value: "JWT", icon: "⊕" },
            ].map((t) => (
              <div key={t.label} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="text-slate-600">{t.icon}</span>
                  <span className="text-slate-500">{t.label}</span>
                </div>
                <span className="font-mono text-slate-400">{t.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
