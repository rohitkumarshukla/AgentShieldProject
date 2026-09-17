import { useState } from "react";
import { auditEvents } from "../data/mockData";
import { DecisionBadge, KpiCard, RiskBadge, RiskMeter } from "../components/shared";
import type { AuditEvent } from "../data/mockData";

interface Props {
  onNavigate: (page: string) => void;
  onAuditEvent: (e: AuditEvent) => void;
}

export default function Overview({ onNavigate, onAuditEvent }: Props) {
  const [highlightFirst] = useState(true);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Hero header */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-6 bg-grid">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">AgentShield Security Console</span>
              <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block"/>
                System Operational
              </span>
            </div>
            <h1 className="text-3xl font-bold text-slate-100 mb-1">
              Giving AI agents power<br/>
              <span className="text-blue-400">without giving them unchecked authority.</span>
            </h1>
            <p className="text-slate-500 text-sm mt-2">Every tool call is intercepted, risk-scored, policy-checked and resolved before execution.</p>
          </div>
          <div className="hidden lg:flex flex-col items-center gap-2 text-center">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="flex flex-col items-center gap-1">
                <div className="w-14 h-10 bg-[#1a2235] border border-[#2d3f5a] rounded flex items-center justify-center text-xs text-slate-400 font-medium">AI AGENT</div>
              </div>
              <span className="text-blue-400">→</span>
              <div className="flex flex-col items-center gap-1">
                <div className="w-20 h-10 bg-blue-950/50 border border-blue-500/30 rounded flex items-center justify-center text-xs text-blue-400 font-bold">AGENTSHIELD</div>
              </div>
              <span className="text-slate-500">→</span>
              <div className="flex flex-col items-center gap-1">
                <div className="w-16 h-10 bg-[#1a2235] border border-[#2d3f5a] rounded flex items-center justify-center text-xs text-slate-400 font-medium">TOOLS</div>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="text-emerald-400 font-mono">ALLOW</span>
              <span className="text-slate-600">•</span>
              <span className="text-amber-400 font-mono">APPROVE</span>
              <span className="text-slate-600">•</span>
              <span className="text-red-400 font-mono">BLOCK</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          label="Protected Agents"
          value={12}
          sub="All healthy"
          accent="blue"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/></svg>}
        />
        <KpiCard
          label="Actions Intercepted"
          value="18,492"
          sub="Last 24h"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>}
        />
        <KpiCard label="Blocked" value={143} sub="0.77% block rate" accent="red"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>}
        />
        <KpiCard label="Pending Approval" value={7} sub="Oldest: 4m ago" accent="amber"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>}
        />
        <KpiCard label="Auto Allowed" value="18,342" sub="99.2% of total" accent="green"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>}
        />
        <KpiCard label="Critical Events" value={4} sub="Today" accent="red"
          icon={<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>}
        />
      </div>

      {/* Live activity */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
          <div className="flex items-center gap-3">
            <h2 className="text-sm font-semibold text-slate-200">Live Agent Activity</h2>
            <span className="flex items-center gap-1.5 text-xs text-blue-400">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 status-pulse inline-block"/>
              Live
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs font-mono text-slate-600">Last event: 1.2s ago</span>
            <button
              onClick={() => onNavigate("liveactions")}
              className="text-xs text-blue-400 hover:text-blue-300 transition-colors font-medium"
            >
              View Decision Center →
            </button>
          </div>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e293b]">
              {["Time", "Agent", "Action", "Tool", "Risk", "Decision"].map((h) => (
                <th key={h} className="text-left px-6 py-2.5 text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {auditEvents.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-[#1e293b]/50 hover:bg-[#1a2235]/50 cursor-pointer transition-colors ${i === 0 && highlightFirst ? "row-new" : ""}`}
                onClick={() => onAuditEvent(e)}
              >
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{e.timestamp}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 status-pulse inline-block"/>
                    <span className="text-slate-300 text-sm">{e.agent}</span>
                  </div>
                </td>
                <td className="px-6 py-3 font-mono text-xs text-blue-300">{e.action}</td>
                <td className="px-6 py-3 font-mono text-xs text-slate-500">{e.tool}</td>
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <RiskBadge level={e.riskLevel} score={e.risk} />
                    <div className="w-16">
                      <RiskMeter score={e.risk} />
                    </div>
                  </div>
                </td>
                <td className="px-6 py-3">
                  <DecisionBadge decision={e.decision} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Security posture */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Decision Distribution</h3>
          <div className="space-y-2.5">
            {[
              { label: "Auto Allowed", pct: 99.2, color: "bg-emerald-500" },
              { label: "Blocked", pct: 0.77, color: "bg-red-500" },
              { label: "Approval Required", pct: 0.038, color: "bg-amber-500" },
            ].map((item) => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">{item.label}</span>
                  <span className="font-mono text-slate-500">{item.pct}%</span>
                </div>
                <div className="h-1 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full`} style={{ width: `${Math.max(item.pct, 0.5)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Active Policies</h3>
          <div className="space-y-2">
            {["bulk_delete_guard", "financial_threshold", "external_email_review", "sensitive_export_guard"].map((p) => (
              <div key={p} className="flex items-center justify-between">
                <span className="font-mono text-xs text-blue-300">{p}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block"/>
              </div>
            ))}
            <button onClick={() => onNavigate("policies")} className="text-xs text-blue-400 hover:text-blue-300 mt-1 block">View all 8 policies →</button>
          </div>
        </div>

        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-3">Performance</h3>
          <div className="space-y-3">
            {[
              { label: "Risk calc latency", value: "2.1ms" },
              { label: "Policy eval latency", value: "0.8ms" },
              { label: "Decision latency", value: "3.1ms" },
              { label: "Audit write latency", value: "4.3ms" },
            ].map((m) => (
              <div key={m.label} className="flex justify-between items-center">
                <span className="text-xs text-slate-500">{m.label}</span>
                <span className="font-mono text-xs text-emerald-400">{m.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
