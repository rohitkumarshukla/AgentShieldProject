export default function ThreatProtection() {
  const threats = [
    {
      threat: "Prompt Injection",
      desc: "Malicious content in agent context manipulates LLM reasoning to request unauthorized actions.",
      defense: "Authorization independent of LLM reasoning",
      defenseDesc: "Risk scoring and policy enforcement are deterministic — LLM output cannot bypass the authorization layer.",
      severity: "CRITICAL",
    },
    {
      threat: "Tool Misuse",
      desc: "Agent calls tools it shouldn't have access to, or uses permitted tools in unauthorized ways.",
      defense: "Tool + operation permission checks",
      defenseDesc: "Every agent identity has an explicit allowed-tool list. Operations are scoped at registration.",
      severity: "HIGH",
    },
    {
      threat: "Excessive Permissions",
      desc: "Agents with broad tool access can perform far more than their intended scope.",
      defense: "Least-privilege agent identities",
      defenseDesc: "Each agent is issued a scoped identity with the minimal set of allowed tools and operations.",
      severity: "HIGH",
    },
    {
      threat: "Sensitive Data Export",
      desc: "Agent attempts to export PII, financial, or regulated data to external destinations.",
      defense: "Block-by-default policy",
      defenseDesc: "sensitive_export_guard blocks all export operations on classified data by default.",
      severity: "CRITICAL",
    },
    {
      threat: "Credential Abuse",
      desc: "Agent uses broad API credentials to perform actions beyond its intended scope.",
      defense: "Scoped agent credentials",
      defenseDesc: "AgentShield issues per-agent credentials with operation-level restrictions.",
      severity: "HIGH",
    },
    {
      threat: "Cascading Failures",
      desc: "A compromised or malfunctioning agent triggers downstream agents in a destructive chain.",
      defense: "Agent/session controls + kill switch",
      defenseDesc: "Individual agents can be paused instantly. Session isolation prevents cross-agent escalation.",
      severity: "MEDIUM",
    },
  ];

  const severityMap: Record<string, string> = {
    CRITICAL: "text-red-400 bg-red-500/10 border-red-500/30",
    HIGH: "text-orange-400 bg-orange-500/10 border-orange-500/30",
    MEDIUM: "text-amber-400 bg-amber-500/10 border-amber-500/30",
  };

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">Threat Protection</h1>
        <p className="text-sm text-slate-500 mt-0.5">Known attack vectors against autonomous agents and AgentShield defenses.</p>
      </div>

      {/* Matrix */}
      <div className="space-y-3">
        {threats.map((t) => (
          <div key={t.threat} className="bg-[#0d1424] border border-[#1e293b] rounded-xl overflow-hidden hover:border-[#2d3f5a] transition-colors">
            <div className="grid grid-cols-1 lg:grid-cols-2">
              {/* Threat side */}
              <div className="p-5 border-b lg:border-b-0 lg:border-r border-[#1e293b]">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
                      <path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                    </svg>
                    <span className="font-semibold text-slate-200 text-sm">{t.threat}</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded border text-xs font-mono font-medium ${severityMap[t.severity]}`}>{t.severity}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t.desc}</p>
              </div>

              {/* Defense side */}
              <div className="p-5 bg-emerald-950/5">
                <div className="flex items-center gap-2 mb-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-emerald-400">
                    <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/>
                    <path d="M9 12l2 2 4-4"/>
                  </svg>
                  <span className="text-sm font-semibold text-emerald-300">{t.defense}</span>
                </div>
                <p className="text-xs text-slate-500 leading-relaxed">{t.defenseDesc}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Posture summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Threats addressed", value: "6", color: "emerald" },
          { label: "Critical defenses", value: "4", color: "red" },
          { label: "LLM bypass vectors", value: "0", color: "emerald" },
        ].map((s) => (
          <div key={s.label} className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold font-mono ${s.color === "emerald" ? "text-emerald-400" : "text-red-400"}`}>{s.value}</div>
            <div className="text-xs text-slate-500 mt-1">{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
