import { policies } from "../data/mockData";
import { PolicyActionBadge, Mono } from "../components/shared";

export default function Policies() {
  const actionOrder = { "BLOCK": 0, "REQUIRE APPROVAL": 1, "AUTO ALLOW": 2 };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-100">Security Policies</h1>
          <p className="text-sm text-slate-500 mt-0.5">Rule-based enforcement evaluated after risk scoring.</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs font-medium rounded-lg">
            8 active policies
          </span>
          <button className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs font-medium transition-colors">
            + New Policy
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Total triggers today", value: "865", sub: "Across all policies" },
          { label: "Block policies", value: "3", sub: "Critical guardrails" },
          { label: "Approval policies", value: "4", sub: "Human-in-the-loop" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0d1424] border border-[#1e293b] rounded-lg p-4">
            <div className="text-xs text-slate-500 mb-1">{s.label}</div>
            <div className="text-2xl font-bold text-slate-100">{s.value}</div>
            <div className="text-xs text-slate-600">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Policy list */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[...policies].sort((a, b) => (actionOrder[a.action as keyof typeof actionOrder] ?? 99) - (actionOrder[b.action as keyof typeof actionOrder] ?? 99)).map((p) => (
          <div
            key={p.id}
            className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-3 hover:border-[#2d3f5a] transition-colors cursor-pointer"
          >
            <div className="flex items-start justify-between">
              <div>
                <Mono className="text-sm mb-1">{p.name}</Mono>
                <div className="flex items-center gap-2 mt-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block status-pulse"/>
                  <span className="text-xs text-slate-500">Active</span>
                </div>
              </div>
              <PolicyActionBadge action={p.action} />
            </div>

            <div className="space-y-1">
              <div className="text-xs text-slate-500">Condition</div>
              <div className="font-mono text-xs text-slate-300 bg-[#111827] border border-[#1e293b] px-3 py-2 rounded leading-relaxed">
                {p.condition}
              </div>
            </div>

            {p.approver && (
              <div className="flex items-center gap-2 text-xs">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500">
                  <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
                </svg>
                <span className="text-slate-500">Approver:</span>
                <Mono>{p.approver}</Mono>
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-[#1e293b]">
              <p className="text-xs text-slate-600 leading-relaxed flex-1 mr-4">{p.description}</p>
              <div className="text-right shrink-0">
                <div className="text-xs text-slate-500">Today</div>
                <div className="font-mono text-sm text-slate-300">{p.trigsToday.toLocaleString()}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
