import { useState, useEffect } from "react";
import { RiskMeter, Mono } from "../../components/shared";

type ApprovalState = "pending" | "approving" | "approved" | "denied";

export default function Approvals({ onToast }: { onToast: (msg: string, type?: "success" | "warning" | "error" | "info") => void }) {
  const [state, setState] = useState<ApprovalState>("pending");
  const [seconds, setSeconds] = useState(102); // 1:42
  const [showNew, setShowNew] = useState(true);

  useEffect(() => {
    if (state !== "pending") return;
    const t = setInterval(() => setSeconds((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(t);
  }, [state]);

  useEffect(() => {
    const t = setTimeout(() => setShowNew(false), 3000);
    return () => clearTimeout(t);
  }, []);

  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");

  function handleApprove() {
    setState("approving");
    setTimeout(() => {
      setState("approved");
      onToast("Action approved — tool execution authorized", "success");
    }, 1200);
  }

  function handleDeny() {
    setState("denied");
    onToast("Action denied — request blocked", "error");
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Approval Queue</h1>
          <p className="text-sm text-slate-500">Human-in-the-loop authorization for medium-high risk actions.</p>
        </div>
        {state === "pending" && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 status-pulse inline-block"/>
            <span className="text-xs text-amber-400 font-medium">7 pending approvals</span>
          </div>
        )}
      </div>

      {/* New approval toast indicator */}
      {showNew && (
        <div className="flex items-center gap-3 px-4 py-3 bg-blue-500/10 border border-blue-500/30 rounded-lg animate-fade-in">
          <span className="w-2 h-2 rounded-full bg-blue-400 status-pulse inline-block"/>
          <span className="text-sm text-blue-300 font-medium">New approval request received</span>
          <span className="text-xs text-slate-500 font-mono">via WebSocket · 0s ago</span>
        </div>
      )}

      {/* Main approval card */}
      <div className={`border rounded-xl overflow-hidden transition-all duration-500 ${
        state === "pending" ? "border-amber-500/30 glow-amber" :
        state === "approving" ? "border-blue-500/30 glow-blue" :
        state === "approved" ? "border-emerald-500/30 glow-green" :
        "border-red-500/30 glow-red"
      }`}>
        {/* Header */}
        <div className={`px-6 py-4 border-b ${
          state === "pending" ? "bg-amber-950/10 border-amber-500/20" :
          state === "approving" ? "bg-blue-950/10 border-blue-500/20" :
          state === "approved" ? "bg-emerald-950/10 border-emerald-500/20" :
          "bg-red-950/10 border-red-500/20"
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400">
                <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/>
              </svg>
              <span className="text-sm font-semibold text-slate-100">Human Approval Required</span>
            </div>
            {state === "pending" && (
              <div className="flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-400"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                <span className="font-mono text-sm text-amber-400">Expires {mins}:{secs}</span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#0a0f1e] p-6">
          {/* Result states */}
          {state === "approving" && (
            <div className="flex flex-col items-center py-8 gap-4 animate-fade-in">
              <div className="w-12 h-12 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
              <div className="text-blue-300 font-medium">Authorizing tool execution...</div>
              <div className="text-xs text-slate-500 font-mono">Validating approval · Updating audit log</div>
            </div>
          )}

          {state === "approved" && (
            <div className="animate-fade-in space-y-4">
              <div className="flex flex-col items-center py-6 gap-3">
                <div className="w-14 h-14 rounded-full bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-emerald-400"><path d="M5 13l4 4L19 7"/></svg>
                </div>
                <div className="text-2xl font-bold text-emerald-400">ACTION APPROVED</div>
                <div className="text-sm text-slate-400">Tool execution authorized</div>
              </div>
              <div className="grid grid-cols-3 gap-3 text-xs font-mono">
                {[
                  { label: "Approved by", value: "Security Admin" },
                  { label: "Timestamp", value: "just now" },
                  { label: "Execution status", value: "Success", color: "text-emerald-400" },
                ].map((f) => (
                  <div key={f.label} className="bg-[#111827] border border-[#1e293b] rounded-lg p-3">
                    <div className="text-slate-500 mb-1">{f.label}</div>
                    <div className={f.color ?? "text-slate-300"}>{f.value}</div>
                  </div>
                ))}
              </div>
              <div className="text-center text-xs text-slate-500 mt-2">Audit record updated · ash_7c22b1</div>
            </div>
          )}

          {state === "denied" && (
            <div className="animate-fade-in flex flex-col items-center py-8 gap-3">
              <div className="w-14 h-14 rounded-full bg-red-500/20 border border-red-500/40 flex items-center justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-red-400"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </div>
              <div className="text-2xl font-bold text-red-400">ACTION DENIED</div>
              <div className="text-sm text-slate-400">Request rejected by Security Admin</div>
              <div className="text-xs font-mono text-slate-600">Execution status: Prevented · ash_7c22b1</div>
            </div>
          )}

          {state === "pending" && (
            <div className="space-y-5">
              {/* Agent + action */}
              <div className="text-center space-y-2 py-2">
                <div className="text-sm text-slate-400">
                  <span className="font-semibold text-slate-200 text-base">Sales Outreach Agent</span>
                </div>
                <div className="text-slate-500 text-sm">wants to:</div>
                <div className="text-lg font-semibold text-slate-100">Send follow-up emails to 38 leads</div>
                <Mono className="text-sm">sendFollowUpEmails(38)</Mono>
              </div>

              {/* Details */}
              <div className="grid grid-cols-3 gap-3 text-xs">
                {[
                  { label: "Risk", value: "58 / 100", color: "text-amber-400" },
                  { label: "Policy", value: "external_email_review", mono: true },
                  { label: "Impact", value: "External recipients" },
                ].map((f) => (
                  <div key={f.label} className="bg-[#111827] border border-[#1e293b] rounded-lg p-3">
                    <div className="text-slate-500 mb-1">{f.label}</div>
                    {f.mono ? (
                      <Mono className="text-xs">{f.value}</Mono>
                    ) : (
                      <div className={`font-medium font-mono ${f.color ?? "text-slate-300"}`}>{f.value}</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Risk bar */}
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-500">Risk level</span>
                  <span className="font-mono text-amber-400">MEDIUM-HIGH · 58/100</span>
                </div>
                <RiskMeter score={58} />
              </div>

              {/* Risk factors */}
              <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-4 space-y-2">
                <div className="text-xs text-slate-500 font-medium mb-2">Risk Factor Breakdown</div>
                {[
                  { label: "EMAIL base risk", value: 30 },
                  { label: "Moderate scope (38 recipients)", value: 15 },
                  { label: "External impact", value: 10 },
                  { label: "Partially reversible", value: 3 },
                ].map((f) => (
                  <div key={f.label} className="flex justify-between text-xs">
                    <span className="text-slate-400">{f.label}</span>
                    <span className="font-mono text-slate-300">+{f.value}</span>
                  </div>
                ))}
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={handleDeny}
                  className="px-6 py-3 bg-[#1a2235] hover:bg-red-950/30 border border-[#2d3f5a] hover:border-red-500/40 text-slate-300 hover:text-red-400 rounded-lg font-semibold text-sm transition-all"
                >
                  DENY ACTION
                </button>
                <button
                  onClick={handleApprove}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-semibold text-sm transition-all shadow-lg shadow-emerald-950/50"
                >
                  APPROVE ACTION
                </button>
              </div>

              <div className="text-center text-xs text-slate-600 font-mono">
                Approving as: Security Admin · {new Date().toLocaleTimeString()}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Other pending */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="px-6 py-3 border-b border-[#1e293b]">
          <h3 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Other Pending Approvals</h3>
        </div>
        <div className="divide-y divide-[#1e293b]">
          {[
            { agent: "Finance Agent", action: "processRefund(₹15,200)", risk: 74, policy: "financial_threshold", age: "4m ago" },
            { agent: "DevOps Agent", action: "restartService('api-gateway')", risk: 65, policy: "infra_change_review", age: "7m ago" },
            { agent: "Finance Agent", action: "processRefund(₹11,800)", risk: 70, policy: "financial_threshold", age: "12m ago" },
          ].map((item) => (
            <div key={item.action} className="flex items-center justify-between px-6 py-3 hover:bg-[#111827] transition-colors cursor-pointer">
              <div className="flex items-center gap-3">
                <span className="text-sm text-slate-300">{item.agent}</span>
                <Mono>{item.action}</Mono>
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-amber-400">{item.risk}/100</span>
                <Mono className="text-slate-400">{item.policy}</Mono>
                <span className="text-xs text-slate-600 font-mono">{item.age}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
