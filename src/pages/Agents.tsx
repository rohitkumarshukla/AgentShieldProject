import { useState } from "react";
import { agents } from "../data/mockData";
import { Mono } from "../components/shared";
import type { Risk } from "../data/mockData";

const riskColors: Record<Risk, string> = {
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
  HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/30",
  "MEDIUM-HIGH": "text-amber-400 bg-amber-500/10 border-amber-500/30",
  MEDIUM: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  LOW: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30",
};

export default function Agents({ onToast }: { onToast: (msg: string, type?: "info" | "success" | "warning" | "error") => void }) {
  const [paused, setPaused] = useState<Set<string>>(new Set());

  function togglePause(id: string, name: string) {
    setPaused((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        onToast(`${name} resumed`, "success");
      } else {
        next.add(id);
        onToast(`${name} paused — all actions blocked`, "warning");
      }
      return next;
    });
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Protected Agents</h1>
          <p className="text-sm text-slate-500 mt-0.5">Scoped identities with least-privilege tool access.</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-medium rounded-lg">12 registered agents</span>
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
            + Register Agent
          </button>
        </div>
      </div>

      {/* Agent cards */}
      <div className="space-y-4">
        {agents.map((agent) => {
          const isPaused = paused.has(agent.id);
          return (
            <div
              key={agent.id}
              className={`bg-[#0d1424] border rounded-xl overflow-hidden transition-all ${isPaused ? "border-amber-500/30 opacity-75" : "border-[#1e293b] hover:border-[#2d3f5a]"}`}
            >
              <div className="px-6 py-4 flex items-center justify-between border-b border-[#1e293b]">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${riskColors[agent.riskLevel]}`}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
                    </svg>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-200">{agent.name}</span>
                      {isPaused && <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded text-xs font-mono">PAUSED</span>}
                    </div>
                    <Mono className="text-slate-500 text-xs">{agent.identity}</Mono>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded border text-xs font-mono font-semibold ${riskColors[agent.riskLevel]}`}>
                    {agent.riskLevel}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {!isPaused ? (
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block"/>
                    ) : (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400 inline-block"/>
                    )}
                    <span className={`text-xs ${isPaused ? "text-amber-400" : "text-emerald-400"}`}>
                      {isPaused ? "Paused" : agent.status}
                    </span>
                  </div>
                  <button
                    onClick={() => togglePause(agent.id, agent.name)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                      isPaused
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30"
                        : "bg-[#1a2235] text-amber-400 border-[#2d3f5a] hover:border-amber-500/40 hover:bg-amber-950/20"
                    }`}
                  >
                    {isPaused ? "Resume Agent" : "Pause Agent"}
                  </button>
                </div>
              </div>

              <div className="px-6 py-4 grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div>
                  <div className="text-xs text-slate-500 mb-1">Actions Today</div>
                  <div className="font-mono text-sm text-slate-200">{agent.actionsToday.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Auto Allowed</div>
                  <div className="font-mono text-sm text-emerald-400">{agent.allowedToday.toLocaleString()}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Pending Approval</div>
                  <div className="font-mono text-sm text-amber-400">{agent.pendingToday}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Blocked</div>
                  <div className="font-mono text-sm text-red-400">{agent.blockedToday}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500 mb-1">Last Seen</div>
                  <div className="font-mono text-sm text-slate-400">{agent.lastSeen}</div>
                </div>
              </div>

              <div className="px-6 pb-4 flex items-start gap-6">
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-2">Allowed Tools</div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.tools.map((t) => (
                      <Mono key={t} className="text-xs">{t}</Mono>
                    ))}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="text-xs text-slate-500 mb-2">Active Policies</div>
                  <div className="flex flex-wrap gap-1.5">
                    {agent.policies.map((p) => (
                      <Mono key={p} className="text-xs text-purple-300 bg-purple-950/30">{p}</Mono>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
