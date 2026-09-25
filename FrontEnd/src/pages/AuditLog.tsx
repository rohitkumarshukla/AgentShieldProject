import { useState } from "react";
import { auditEvents } from "../data/mockData";
import { DecisionBadge, RiskBadge, Mono } from "../../components/shared";
import type { AuditEvent } from "../data/mockData";

interface Props {
  onAuditEvent: (e: AuditEvent) => void;
}

export default function AuditLog({ onAuditEvent }: Props) {
  const [search, setSearch] = useState("");
  const [filterDecision, setFilterDecision] = useState("all");

  const filtered = auditEvents.filter((e) => {
    const matchSearch = !search || e.agent.toLowerCase().includes(search.toLowerCase()) || e.action.toLowerCase().includes(search.toLowerCase());
    const matchDecision = filterDecision === "all" || e.decision === filterDecision;
    return matchSearch && matchDecision;
  });

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Audit Log</h1>
          <p className="text-sm text-slate-500 mt-0.5">Complete immutable record of every AgentShield decision.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-emerald-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
            Audit integrity verified
          </span>
          <button className="px-3 py-1.5 bg-[#1a2235] border border-[#2d3f5a] text-slate-400 hover:text-slate-200 rounded-lg text-xs transition-colors">
            ↓ Export
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-48 max-w-64 relative">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
          <input
            type="text"
            placeholder="Search agent, action..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-[#0d1424] border border-[#1e293b] rounded-lg text-sm text-slate-300 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 transition-colors"
          />
        </div>
        <select
          value={filterDecision}
          onChange={(e) => setFilterDecision(e.target.value)}
          className="px-3 py-2 bg-[#0d1424] border border-[#1e293b] rounded-lg text-sm text-slate-300 focus:outline-none focus:border-blue-500/50"
        >
          <option value="all">All decisions</option>
          <option value="BLOCKED">Blocked</option>
          <option value="APPROVAL REQUIRED">Approval Required</option>
          <option value="AUTO ALLOWED">Auto Allowed</option>
          <option value="APPROVED">Approved</option>
          <option value="DENIED">Denied</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#1e293b]">
              {["Time", "Agent", "Action", "Risk", "Policy", "Decision", "Approver", "Execution", "Reversible"].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wider whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-slate-600 text-sm">No audit events match your filters</td>
              </tr>
            )}
            {filtered.map((e, i) => (
              <tr
                key={e.id}
                className={`border-b border-[#1e293b]/50 hover:bg-[#111827] cursor-pointer transition-colors ${i === 0 ? "row-new" : ""}`}
                onClick={() => onAuditEvent(e)}
              >
                <td className="px-4 py-3 font-mono text-xs text-slate-500 whitespace-nowrap">{e.timestamp}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block shrink-0"/>
                    <span className="text-slate-300 text-xs whitespace-nowrap">{e.agent}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Mono className="text-xs">{e.action}</Mono>
                </td>
                <td className="px-4 py-3">
                  <RiskBadge level={e.riskLevel} score={e.risk} />
                </td>
                <td className="px-4 py-3">
                  <Mono className="text-xs text-purple-300 bg-purple-950/30">{e.policy}</Mono>
                </td>
                <td className="px-4 py-3">
                  <DecisionBadge decision={e.decision} />
                </td>
                <td className="px-4 py-3 text-xs text-slate-500">{e.approver ?? "—"}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs font-medium ${
                    e.executionStatus === "Prevented" ? "text-red-400" :
                    e.executionStatus === "Executed" ? "text-emerald-400" :
                    "text-amber-400"
                  }`}>{e.executionStatus}</span>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs ${
                    e.reversible === "Irreversible" ? "text-red-400" :
                    e.reversible === "Partially Reversible" ? "text-amber-400" :
                    "text-emerald-400"
                  }`}>{e.reversible}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-6 py-3 border-t border-[#1e293b] flex items-center justify-between text-xs text-slate-600">
          <span>Showing {filtered.length} of {auditEvents.length} events · Last 24h</span>
          <span className="font-mono">sha256:integrity-verified ✓</span>
        </div>
      </div>
    </div>
  );
}
