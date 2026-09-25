export default function RiskEngine() {
  const factors = [
    { name: "Action Base Risk", key: "action_base", desc: "Risk assigned to the operation type (READ, WRITE, DELETE, FINANCIAL, INFRA, EMAIL)", examples: ["READ: +5", "WRITE: +20", "DELETE: +80", "FINANCIAL: +50", "EMAIL: +30"] },
    { name: "Scope Modifier", key: "scope", desc: "Scales risk based on the number of records or entities affected", examples: ["1–10: +0", "11–50: +5", "51–100: +10", ">100: +15"] },
    { name: "Data Sensitivity", key: "data", desc: "Additional risk for PII, financial, or regulated data", examples: ["Internal: +0", "Confidential: +5", "PII: +10", "Financial: +15"] },
    { name: "External Impact", key: "external", desc: "Elevated risk for actions with external or customer-facing effects", examples: ["None: +0", "Internal only: +2", "External service: +10", "Customer facing: +15"] },
    { name: "Irreversibility", key: "irreversible", desc: "Higher risk for actions that cannot be undone", examples: ["Reversible: +0", "Partially reversible: +5", "Irreversible: +20"] },
  ];

  const bands = [
    { label: "LOW", range: "0–29", decision: "Auto-Allow", color: "emerald", barPct: 29, desc: "Safe actions execute automatically. No human friction." },
    { label: "MEDIUM", range: "30–59", decision: "Allow / Policy-dependent", color: "amber", barPct: 59, desc: "Lower-risk operations may auto-allow or require approval based on policy." },
    { label: "HIGH", range: "60–79", decision: "Require Approval", color: "orange", barPct: 79, desc: "Elevated-risk actions are paused for human review before execution." },
    { label: "CRITICAL", range: "80–100", decision: "Block / Elevated Approval", color: "red", barPct: 100, desc: "High-impact or irreversible actions are blocked or require elevated authorization." },
  ];

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Risk Engine</h1>
        <p className="text-sm text-slate-500 mt-0.5">Transparent, deterministic, factor-based risk assessment.</p>
      </div>

      {/* Formula */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-6">
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-4">Scoring Formula</div>
        <div className="flex flex-wrap items-center gap-2 font-mono text-sm">
          {[
            { label: "Action Base Risk", color: "text-blue-300 bg-blue-950/40 border-blue-500/30" },
            { label: "+", plain: true },
            { label: "Scope Modifier", color: "text-purple-300 bg-purple-950/40 border-purple-500/30" },
            { label: "+", plain: true },
            { label: "Data Sensitivity", color: "text-amber-300 bg-amber-950/40 border-amber-500/30" },
            { label: "+", plain: true },
            { label: "External Impact", color: "text-orange-300 bg-orange-950/40 border-orange-500/30" },
            { label: "+", plain: true },
            { label: "Irreversibility", color: "text-red-300 bg-red-950/40 border-red-500/30" },
            { label: "=", plain: true },
            { label: "Risk Score (0–100)", color: "text-slate-100 bg-[#1a2235] border-[#2d3f5a] font-bold" },
          ].map((t, i) =>
            t.plain ? (
              <span key={i} className="text-slate-500">{t.label}</span>
            ) : (
              <span key={i} className={`px-2.5 py-1 rounded border text-xs font-medium ${t.color}`}>{t.label}</span>
            )
          )}
        </div>
        <p className="text-xs text-slate-600 mt-4">Raw scores above 100 are capped at 100. Scores are calculated deterministically at every interception.</p>
      </div>

      {/* Factors */}
      <div>
        <div className="text-sm font-medium text-slate-400 mb-3">Risk Factors</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {factors.map((f) => (
            <div key={f.key} className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-4 space-y-3 hover:border-[#2d3f5a] transition-colors">
              <div className="font-semibold text-slate-200 text-sm">{f.name}</div>
              <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
              <div className="space-y-1">
                {f.examples.map((e) => (
                  <div key={e} className="font-mono text-xs text-blue-300 bg-blue-950/20 px-2 py-1 rounded">{e}</div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Risk bands */}
      <div>
        <div className="text-sm font-medium text-slate-400 mb-3">Risk Bands &amp; Default Decisions</div>
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-4 gap-4">
          {bands.map((b) => {
            const colorMap: Record<string, string> = {
              emerald: "border-emerald-500/30 bg-emerald-950/10 text-emerald-400",
              amber: "border-amber-500/30 bg-amber-950/10 text-amber-400",
              orange: "border-orange-500/30 bg-orange-950/10 text-orange-400",
              red: "border-red-500/30 bg-red-950/10 text-red-400",
            };
            const barColor: Record<string, string> = {
              emerald: "bg-emerald-500",
              amber: "bg-amber-500",
              orange: "bg-orange-500",
              red: "bg-red-500",
            };
            return (
              <div key={b.label} className={`border rounded-xl p-4 space-y-3 ${colorMap[b.color]}`}>
                <div className={`text-xl font-black font-mono ${colorMap[b.color].split(" ")[2]}`}>{b.label}</div>
                <div className="font-mono text-2xl font-bold text-slate-100">{b.range}</div>
                <div className="h-1.5 bg-[#1e293b] rounded-full overflow-hidden">
                  <div className={`h-full ${barColor[b.color]} rounded-full`} style={{ width: `${b.barPct}%` }} />
                </div>
                <div className="text-xs font-semibold text-slate-300">{b.decision}</div>
                <p className="text-xs text-slate-500 leading-relaxed">{b.desc}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Key differentiator */}
      <div className="bg-blue-950/20 border border-blue-500/20 rounded-xl p-6">
        <div className="flex items-start gap-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400 shrink-0 mt-0.5">
            <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/>
            <path d="M9 12l2 2 4-4"/>
          </svg>
          <div>
            <div className="font-semibold text-blue-300 mb-1">LLM-Independent Authorization</div>
            <p className="text-sm text-slate-400 leading-relaxed">
              The LLM can extract intent and produce a structured tool call. It cannot set the risk score or final authorization decision.
              AgentShield's deterministic scoring engine operates independently of LLM reasoning — eliminating prompt injection as an authorization bypass vector.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
