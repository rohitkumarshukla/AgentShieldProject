import type { AuditEvent } from "../src/data/mockData";
import { DecisionBadge, RiskMeter } from "./shared";

interface AuditDrawerProps {
  event: AuditEvent | null;
  onClose: () => void;
}

export default function AuditDrawer({ event, onClose }: AuditDrawerProps) {
  if (!event) return null;

  const jsonPayload = `{
  "action_id": "${event.actionId}",
  "agent_id": "${event.agentId}",
  "agent_name": "${event.agent}",
  "tool": "${event.tool}",
  "operation": "${event.action}",
  "scope": ${typeof event.scope === "number" ? event.scope : `"${event.scope}"`},
  "risk_score": ${event.risk},
  "risk_level": "${event.riskLevel}",
  "policy_triggered": "${event.policy}",
  "decision": "${event.decision}",
  "executed": ${event.executed},
  "execution_status": "${event.executionStatus}",
  "approver": ${event.approver ? `"${event.approver}"` : "null"},
  "data_classification": "${event.dataClassification}",
  "reversibility": "${event.reversible}",
  "timestamp": "2026-09-17T${event.timestamp}Z",
  "audit_integrity": "sha256:a3f8b1c2d4e5..."
}`;

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 bg-black/50 z-40" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-[480px] bg-[#0a0f1e] border-l border-[#1e293b] z-50 animate-slide-in flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1e293b]">
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Authorization Event</span>
            </div>
            <span className="font-mono text-blue-400 text-sm">{event.actionId}</span>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1e293b] rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Decision status */}
          <div className="flex items-center justify-between p-3 bg-[#0d1424] border border-[#1e293b] rounded-lg">
            <span className="text-sm text-slate-400">Decision</span>
            <DecisionBadge decision={event.decision} />
          </div>

          {/* Risk */}
          <div className="bg-[#0d1424] border border-[#1e293b] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-widest text-slate-500 font-medium">Risk Score</span>
              <span className={`font-mono text-lg font-bold ${event.risk >= 80 ? "text-red-400" : event.risk >= 60 ? "text-orange-400" : event.risk >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {event.risk}<span className="text-slate-600 text-sm">/100</span>
              </span>
            </div>
            <RiskMeter score={event.risk} />
            <div className="space-y-1.5">
              {event.riskFactors.map((f) => (
                <div key={f.label} className="flex items-center justify-between text-xs">
                  <span className="text-slate-400">{f.label}</span>
                  <span className="font-mono text-slate-300">+{f.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: "Agent", value: event.agent },
              { label: "Policy", value: event.policy, mono: true },
              { label: "Tool", value: event.tool, mono: true },
              { label: "Execution", value: event.executionStatus },
              { label: "Data Class.", value: event.dataClassification },
              { label: "Reversibility", value: event.reversible },
              { label: "External Impact", value: event.externalImpact },
              { label: "Approver", value: event.approver ?? "—" },
            ].map((item) => (
              <div key={item.label} className="bg-[#0d1424] border border-[#1e293b] rounded-lg p-3">
                <div className="text-xs text-slate-500 mb-1">{item.label}</div>
                {item.mono ? (
                  <div className="font-mono text-xs text-blue-300 truncate">{item.value}</div>
                ) : (
                  <div className="text-xs text-slate-300 font-medium">{item.value}</div>
                )}
              </div>
            ))}
          </div>

          {/* JSON payload */}
          <div className="bg-[#060a12] border border-[#1e293b] rounded-lg overflow-hidden">
            <div className="px-4 py-2 border-b border-[#1e293b] flex items-center justify-between">
              <span className="text-xs font-mono text-slate-500">audit_record.json</span>
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
                Integrity verified
              </span>
            </div>
            <pre className="px-4 py-4 text-xs font-mono text-slate-400 overflow-x-auto leading-relaxed">
              <code>{jsonPayload}</code>
            </pre>
          </div>

          {/* Timestamp */}
          <div className="text-xs font-mono text-slate-600 text-center">
            Recorded: 2026-09-17T{event.timestamp}Z · AgentShield Audit v1
          </div>
        </div>
      </div>
    </>
  );
}
