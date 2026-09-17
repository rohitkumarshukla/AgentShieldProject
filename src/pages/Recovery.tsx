import { useState } from "react";

export default function Recovery({ onToast }: { onToast: (msg: string, type?: "info" | "success" | "warning" | "error") => void }) {
  const [restored, setRestored] = useState(false);

  function handleRestore() {
    onToast("Compensating action queued — status reverted to active", "success");
    setRestored(true);
  }

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Recovery Center</h1>
        <p className="text-sm text-slate-500 mt-0.5">State capture and compensating actions for reversible operations.</p>
      </div>

      {/* Honesty banner */}
      <div className="flex items-start gap-3 px-5 py-4 bg-amber-950/20 border border-amber-500/30 rounded-xl">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-amber-400 shrink-0 mt-0.5">
          <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
        </svg>
        <div>
          <div className="font-semibold text-amber-300 text-sm">Design principle: prevention-first</div>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            AgentShield does not promise universal rollback. Irreversible external actions — deleted data, sent emails, executed payments — must be prevented before execution.
            Recovery metadata is captured where technically feasible.
          </p>
        </div>
      </div>

      {/* Reversibility categories */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          {
            label: "REVERSIBLE",
            color: "emerald",
            desc: "Previous state captured. Compensating action can restore.",
            count: 4,
            icon: <path d="M3 12a9 9 0 0110-8.9M21 12a9 9 0 01-10 8.9M3 12h9m-9 0l3-3m-3 3l3 3"/>,
          },
          {
            label: "PARTIALLY REVERSIBLE",
            color: "amber",
            desc: "Compensating action available. May not fully restore prior state.",
            count: 2,
            icon: <><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></>,
          },
          {
            label: "IRREVERSIBLE",
            color: "red",
            desc: "No rollback possible. Prevention is the only control.",
            count: 1,
            icon: <><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></>,
          },
        ].map((cat) => {
          const c: Record<string, string> = {
            emerald: "border-emerald-500/30 bg-emerald-950/10 text-emerald-400",
            amber: "border-amber-500/30 bg-amber-950/10 text-amber-400",
            red: "border-red-500/30 bg-red-950/10 text-red-400",
          };
          return (
            <div key={cat.label} className={`border rounded-xl p-5 ${c[cat.color]}`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${c[cat.color]}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">{cat.icon}</svg>
                </div>
                <div className={`text-sm font-bold font-mono ${c[cat.color].split(" ")[2]}`}>{cat.label}</div>
              </div>
              <p className="text-xs text-slate-400 leading-relaxed">{cat.desc}</p>
              <div className="mt-3 text-xs text-slate-500">{cat.count} events today</div>
            </div>
          );
        })}
      </div>

      {/* Example reversible event */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Reversible Action — Recovery Available</h2>
          <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono">REVERSIBLE</span>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Action", value: "updateCustomerStatus(42)" },
              { label: "Agent", value: "CRM Cleanup Agent" },
              { label: "Timestamp", value: "10:38:30" },
              { label: "Decision", value: "Auto Allowed" },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-xs text-slate-500 mb-1">{f.label}</div>
                <div className="font-mono text-xs text-slate-300">{f.value}</div>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-2">Previous State</div>
              <pre className="font-mono text-xs text-emerald-300">{"{\n  \"status\": \"active\",\n  \"records\": 42\n}"}</pre>
            </div>
            <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-4">
              <div className="text-xs text-slate-500 mb-2">New State</div>
              <pre className="font-mono text-xs text-amber-300">{"{\n  \"status\": \"inactive\",\n  \"records\": 42\n}"}</pre>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {!restored ? (
              <button
                onClick={handleRestore}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Restore Previous State
              </button>
            ) : (
              <div className="flex items-center gap-2 text-emerald-400 text-sm">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                <span>Restored to previous state · {new Date().toLocaleTimeString()}</span>
              </div>
            )}
            <span className="text-xs text-slate-600 font-mono">ash_5e03a7 · Recovery metadata available</span>
          </div>
        </div>
      </div>

      {/* Irreversible example */}
      <div className="bg-[#0d1424] border border-red-500/20 rounded-xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#1e293b] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-200">Blocked Irreversible Action</h2>
          <span className="px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-xs font-mono">BLOCKED · IRREVERSIBLE</span>
        </div>
        <div className="p-6 space-y-3">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            {[
              { label: "Action", value: "deleteCustomers(147)" },
              { label: "Agent", value: "CRM Cleanup Agent" },
              { label: "Reversibility", value: "Irreversible", warn: true },
              { label: "Recovery", value: "Not possible" },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-xs text-slate-500 mb-1">{f.label}</div>
                <div className={`font-mono text-xs ${f.warn ? "text-red-400" : "text-slate-300"}`}>{f.value}</div>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-red-400"><path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/></svg>
            Action was blocked before execution — no recovery required. AgentShield prevented 147 irreversible deletions.
          </div>
        </div>
      </div>
    </div>
  );
}
