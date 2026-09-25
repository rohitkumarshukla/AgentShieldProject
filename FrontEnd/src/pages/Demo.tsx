import { useState } from "react";
import { RiskMeter, Mono } from "../../components/shared";

type ScenarioKey = "block" | "approve" | "allow";
type Stage = "idle" | "intercepted" | "risk" | "policy" | "decision";

const SCENARIOS = {
  block: {
    num: "01",
    label: "BLOCK",
    title: "Delete 147 CRM customers",
    request: '"Clean up inactive CRM customers."',
    action: "deleteCustomers(147)",
    agent: "CRM Cleanup Agent",
    risk: 100,
    riskLevel: "CRITICAL",
    policy: "bulk_delete_guard",
    rule: 'IF action == "delete" AND scope.count > 100',
    decision: "BLOCKED",
    decisionDesc: "147 customer records were not deleted. Execution prevented before reaching the tool.",
    riskFactors: [
      { label: "DELETE operation", value: 80 },
      { label: "Large scope (>100)", value: 10 },
      { label: "Sensitive data", value: 5 },
      { label: "Irreversible action", value: 20 },
    ],
    colorClass: "border-red-500/30",
    badgeClass: "bg-red-500/20 text-red-400 border-red-500/40",
    decisionClass: "text-red-400",
    glowClass: "glow-red",
  },
  approve: {
    num: "02",
    label: "REQUIRE APPROVAL",
    title: "Send follow-ups to 38 leads",
    request: '"Send follow-up emails to 38 leads."',
    action: "sendFollowUpEmails(38)",
    agent: "Sales Outreach Agent",
    risk: 58,
    riskLevel: "MEDIUM-HIGH",
    policy: "external_email_review",
    rule: 'IF send_email AND recipients.external == true',
    decision: "APPROVAL REQUIRED",
    decisionDesc: "Action paused. Human authorization required before emails are delivered to external recipients.",
    riskFactors: [
      { label: "EMAIL base risk", value: 30 },
      { label: "Moderate scope", value: 15 },
      { label: "External impact", value: 10 },
      { label: "Partially reversible", value: 3 },
    ],
    colorClass: "border-amber-500/30",
    badgeClass: "bg-amber-500/20 text-amber-400 border-amber-500/40",
    decisionClass: "text-amber-400",
    glowClass: "glow-amber",
  },
  allow: {
    num: "03",
    label: "AUTO-ALLOW",
    title: "Read 12 knowledge articles",
    request: '"Read 12 internal knowledge-base articles."',
    action: "knowledgeBase.read(12)",
    agent: "Research Agent",
    risk: 12,
    riskLevel: "LOW",
    policy: "internal_read_allow",
    rule: 'IF action == "read" AND data.classification == "internal"',
    decision: "AUTO ALLOWED",
    decisionDesc: "Safe action automatically executed. Low-risk actions continue without unnecessary human friction.",
    riskFactors: [
      { label: "READ operation", value: 5 },
      { label: "Small scope (12)", value: 2 },
      { label: "Internal data only", value: 2 },
      { label: "Reversible", value: 3 },
    ],
    colorClass: "border-emerald-500/30",
    badgeClass: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40",
    decisionClass: "text-emerald-400",
    glowClass: "glow-green",
  },
};

const STAGE_ORDER: Stage[] = ["idle", "intercepted", "risk", "policy", "decision"];

export default function Demo({ onNavigate }: { onNavigate: (page: string, scenario?: string) => void }) {
  const [active, setActive] = useState<ScenarioKey | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [running, setRunning] = useState(false);

  function launchScenario(key: ScenarioKey) {
    setActive(key);
    setStage("intercepted");
    setRunning(true);

    const stages: Stage[] = ["intercepted", "risk", "policy", "decision"];
    stages.forEach((s, i) => {
      setTimeout(() => {
        setStage(s);
        if (i === stages.length - 1) setRunning(false);
      }, (i + 1) * 900);
    });
  }

  const s = active ? SCENARIOS[active] : null;
  const stageIdx = STAGE_ORDER.indexOf(stage);

  return (
    <div className="p-8 space-y-8 animate-fade-in">
      {/* Hero header */}
      <div className="text-center space-y-2 pt-4">
        <div className="text-xs font-mono text-slate-500 uppercase tracking-widest">Hackathon Demo Mode</div>
        <h1 className="text-3xl font-black text-slate-100">AgentShield Live Demo</h1>
        <p className="text-slate-400 text-base">Watch an AI agent request. Watch AgentShield decide.</p>
        <p className="text-xs text-slate-600 mt-1 font-mono italic">"This is the layer that decides — not the agent."</p>
      </div>

      {/* Scenario selector cards */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {(Object.entries(SCENARIOS) as [ScenarioKey, typeof SCENARIOS.block][]).map(([key, sc]) => (
          <button
            key={key}
            onClick={() => launchScenario(key)}
            disabled={running}
            className={`text-left p-6 rounded-xl border transition-all ${
              active === key ? `${sc.colorClass} ${sc.glowClass}` : "border-[#1e293b] hover:border-[#2d3f5a]"
            } bg-[#0d1424] disabled:opacity-60 disabled:cursor-not-allowed`}
          >
            <div className="font-mono text-xs text-slate-600 mb-2">{sc.num} —</div>
            <div className={`text-lg font-bold mb-1 ${active === key ? sc.decisionClass : "text-slate-300"}`}>{sc.label}</div>
            <div className="text-sm text-slate-400 mb-3">{sc.title}</div>
            <Mono className="text-xs mb-3">{sc.action}</Mono>
            <div className="flex items-center justify-between">
              <span className={`text-sm font-mono font-bold ${active === key ? sc.decisionClass : "text-slate-500"}`}>Risk: {sc.risk}/100</span>
              <span className={`px-2 py-0.5 rounded border text-xs font-mono font-medium ${active === key ? sc.badgeClass : "bg-[#1a2235] text-slate-500 border-[#2d3f5a]"}`}>
                {sc.label}
              </span>
            </div>
          </button>
        ))}
      </div>

      {/* Live display */}
      {active && s && (
        <div className={`border rounded-xl overflow-hidden transition-all duration-500 ${s.colorClass} ${stage === "decision" ? s.glowClass : ""}`}>
          {/* Pipeline */}
          <div className="bg-[#0a0f1e] px-8 py-5 border-b border-[#1e293b]">
            <div className="flex items-center justify-between max-w-2xl mx-auto">
              {["AI AGENT", "INTERCEPTED", "RISK ENGINE", "POLICY ENGINE", "DECISION"].map((lbl, i) => (
                <div key={lbl} className="flex items-center gap-0">
                  <div className="flex flex-col items-center gap-1.5">
                    <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-all duration-500 ${
                      i < stageIdx
                        ? "bg-blue-500/20 border-blue-500 text-blue-400"
                        : i === stageIdx && stageIdx < 4
                        ? "bg-blue-500/30 border-blue-400 text-blue-300 pipeline-node-active"
                        : i === 4 && stage === "decision"
                        ? `border-current ${s.decisionClass} bg-current/10`
                        : "bg-[#1a2235] border-[#2d3f5a] text-slate-600"
                    }`}>
                      {i < stageIdx ? "✓" : i + 1}
                    </div>
                    <span className={`text-[9px] font-mono font-semibold text-center leading-tight ${i <= stageIdx ? "text-slate-300" : "text-slate-600"}`}>{lbl}</span>
                  </div>
                  {i < 4 && (
                    <div className={`h-px w-10 mx-1 mb-5 transition-all duration-700 ${i < stageIdx ? "bg-blue-500" : "bg-[#1e293b]"}`} />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[#0a0f1e] p-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              {/* Left: Action + Risk */}
              <div className="space-y-4">
                {/* Intercepted notice */}
                {stageIdx >= 1 && (
                  <div className="animate-fade-in px-4 py-2 bg-blue-500/10 border border-blue-500/20 rounded-lg text-xs text-blue-300 font-mono">
                    ⚡ Action intercepted — not yet executed
                  </div>
                )}

                <div className="space-y-2">
                  <div className="text-xs text-slate-500">User request</div>
                  <div className="text-sm text-slate-400 italic">{s.request}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs text-slate-500">Agent proposes</div>
                  <Mono className="text-sm">{s.action}</Mono>
                </div>

                {/* Risk */}
                {stageIdx >= 2 && (
                  <div className="animate-fade-in space-y-3">
                    <div className="flex items-center gap-4">
                      <div className="relative w-16 h-16">
                        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="#1e293b" strokeWidth="3"/>
                          <circle cx="18" cy="18" r="15" fill="none"
                            stroke={s.risk >= 80 ? "#ef4444" : s.risk >= 60 ? "#f97316" : s.risk >= 30 ? "#f59e0b" : "#10b981"}
                            strokeWidth="3"
                            strokeDasharray={`${s.risk * 0.94} ${100 - s.risk * 0.94}`}
                            strokeLinecap="round"
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className={`text-sm font-bold font-mono ${s.decisionClass}`}>{s.risk}</span>
                        </div>
                      </div>
                      <div>
                        <div className={`text-2xl font-black font-mono ${s.decisionClass}`}>{s.risk} / 100</div>
                        <div className={`text-xs font-mono ${s.decisionClass}`}>{s.riskLevel} RISK</div>
                      </div>
                    </div>
                    <RiskMeter score={s.risk} />
                    <div className="space-y-1.5">
                      {s.riskFactors.map((f) => (
                        <div key={f.label} className="flex justify-between text-xs">
                          <span className="text-slate-400">{f.label}</span>
                          <span className="font-mono text-slate-300">+{f.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: Policy + Decision */}
              <div className="space-y-4">
                {/* Policy */}
                {stageIdx >= 3 && (
                  <div className="animate-fade-in bg-[#111827] border border-[#1e293b] rounded-lg p-4 space-y-2">
                    <div className="text-xs text-slate-500 uppercase tracking-wider">Policy Matched</div>
                    <Mono className="text-sm">{s.policy}</Mono>
                    <div className="font-mono text-xs text-slate-400 bg-[#0a0f1e] px-3 py-2 rounded">{s.rule}</div>
                  </div>
                )}

                {/* Decision */}
                {stageIdx >= 4 && (
                  <div className="animate-fade-in space-y-3">
                    <div className={`text-5xl font-black font-mono ${s.decisionClass}`}>{s.decision}</div>
                    <p className="text-sm text-slate-400 leading-relaxed">{s.decisionDesc}</p>
                    <button
                      onClick={() => onNavigate("liveactions", active)}
                      className="text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
                    >
                      Open full Decision Center →
                    </button>
                  </div>
                )}

                {stageIdx < 3 && running && (
                  <div className="flex items-center gap-2 text-slate-500 text-sm py-8 justify-center">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                    Evaluating...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Closing message */}
      <div className="text-center py-4">
        <p className="text-slate-600 text-sm">
          The agent proposed the action. AgentShield decided. The agent cannot authorize itself.
        </p>
        <p className={`text-sm font-semibold mt-1 ${stage === "decision" && active ? (active === "block" ? "text-red-400" : active === "approve" ? "text-amber-400" : "text-emerald-400") : "text-slate-600"}`}>
          {stage === "decision" && active ? (
            active === "block" ? "BLOCKED — Zero records deleted." :
            active === "approve" ? "PAUSED — Human authorization required." :
            "EXECUTED — No friction for safe actions."
          ) : "Select a scenario above to run the demo."}
        </p>
      </div>
    </div>
  );
}
