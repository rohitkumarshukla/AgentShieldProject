import { useState, useEffect } from "react";
import { RiskMeter, Mono, DecisionBadge } from "../components/shared";
import type { AuditEvent } from "../data/mockData";
import { auditEvents } from "../data/mockData";

const PIPELINE_STAGES = ["AI AGENT", "INTERCEPTED", "RISK ENGINE", "POLICY ENGINE", "DECISION"];

type Scenario = "block" | "approve" | "allow";

const scenarios = {
  block: auditEvents[0],
  approve: auditEvents[1],
  allow: auditEvents[2],
};

interface Props {
  onAuditEvent: (e: AuditEvent) => void;
  initialScenario?: Scenario;
}

export default function LiveActions({ onAuditEvent, initialScenario }: Props) {
  const [scenario, setScenario] = useState<Scenario>(initialScenario ?? "block");
  const [stage, setStage] = useState(0);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);

  const event = scenarios[scenario];

  function runScenario(s: Scenario) {
    setScenario(s);
    setStage(0);
    setRunning(true);
    setDone(false);
  }

  useEffect(() => {
    if (initialScenario) runScenario(initialScenario);
  }, [initialScenario]);

  useEffect(() => {
    if (!running) return;
    if (stage >= PIPELINE_STAGES.length - 1) {
      setDone(true);
      setRunning(false);
      return;
    }
    const t = setTimeout(() => setStage((s) => s + 1), 800);
    return () => clearTimeout(t);
  }, [stage, running]);

  const decisionColor =
    scenario === "block"
      ? "text-red-400 border-red-500/30 bg-red-500/10 glow-red"
      : scenario === "approve"
      ? "text-amber-400 border-amber-500/30 bg-amber-500/10 glow-amber"
      : "text-emerald-400 border-emerald-500/30 bg-emerald-500/10 glow-green";

  const decisionLabel =
    scenario === "block" ? "BLOCKED" : scenario === "approve" ? "APPROVAL REQUIRED" : "AUTO ALLOWED";

  return (
    <div className="p-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-slate-500 uppercase tracking-widest">Decision Center</span>
            <span className="px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-xs font-mono font-bold tracking-wider">
              AGENT ACTION INTERCEPTED
            </span>
          </div>
          <h1 className="text-xl font-semibold text-slate-100">Live Actions</h1>
          <p className="text-sm text-slate-500">Actions are evaluated before reaching any real tool.</p>
        </div>
        {/* Scenario picker */}
        <div className="flex items-center gap-2">
          {(["block", "approve", "allow"] as Scenario[]).map((s) => (
            <button
              key={s}
              onClick={() => runScenario(s)}
              className={`px-3 py-1.5 rounded text-xs font-medium border transition-all ${
                scenario === s
                  ? s === "block"
                    ? "bg-red-500/20 text-red-400 border-red-500/40"
                    : s === "approve"
                    ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
                    : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                  : "bg-[#0d1424] text-slate-400 border-[#1e293b] hover:border-[#2d3f5a]"
              }`}
            >
              {s === "block" ? "01 BLOCK" : s === "approve" ? "02 APPROVE" : "03 ALLOW"}
            </button>
          ))}
          <button
            onClick={() => runScenario(scenario)}
            className="ml-2 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-xs font-medium transition-colors"
          >
            ↻ Run
          </button>
        </div>
      </div>

      {/* Pipeline */}
      <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-6">
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((s, i) => (
            <div key={s} className="flex items-center gap-0">
              <div className="flex flex-col items-center gap-2">
                <div
                  className={`w-10 h-10 rounded-full border-2 flex items-center justify-center transition-all duration-500 ${
                    i < stage
                      ? "bg-blue-500/20 border-blue-500 text-blue-400"
                      : i === stage
                      ? "bg-blue-500/30 border-blue-400 text-blue-300 pipeline-node-active"
                      : done && i === PIPELINE_STAGES.length - 1
                      ? scenario === "block"
                        ? "bg-red-500/20 border-red-500 text-red-400"
                        : scenario === "approve"
                        ? "bg-amber-500/20 border-amber-500 text-amber-400"
                        : "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : "bg-[#1a2235] border-[#2d3f5a] text-slate-600"
                  }`}
                >
                  {i < stage ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 13l4 4L19 7"/></svg>
                  ) : (
                    <span className="text-xs font-bold">{i + 1}</span>
                  )}
                </div>
                <span className={`text-[10px] font-mono font-medium text-center transition-colors ${
                  i <= stage ? "text-slate-300" : "text-slate-600"
                }`}>{s}</span>
              </div>
              {i < PIPELINE_STAGES.length - 1 && (
                <div className={`h-0.5 w-16 mx-2 mb-5 rounded-full transition-all duration-700 ${
                  i < stage ? "bg-blue-500" : "bg-[#1e293b]"
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Proposed action */}
        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Proposed Action</h2>
            <span className="text-xs font-mono text-slate-600">{event.actionId}</span>
          </div>
          <div>
            <div className="text-lg font-semibold text-slate-100 mb-1">
              {scenario === "block" ? "Delete 147 inactive customers" :
               scenario === "approve" ? "Send follow-up emails to 38 leads" :
               "Read 12 internal knowledge-base articles"}
            </div>
            <Mono className="text-sm">{event.action}</Mono>
          </div>
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              { label: "Agent", value: event.agent },
              { label: "Tool", value: event.tool, mono: true },
              { label: "Target", value: `${event.scope} ${typeof event.scope === "number" ? "records" : ""}` },
              { label: "Data Class.", value: event.dataClassification },
              { label: "External Impact", value: event.externalImpact },
              { label: "Reversibility", value: event.reversible, highlight: event.reversible === "Irreversible" },
            ].map((f) => (
              <div key={f.label}>
                <div className="text-xs text-slate-500 mb-0.5">{f.label}</div>
                {f.mono ? (
                  <Mono>{f.value}</Mono>
                ) : (
                  <div className={`text-xs font-medium ${f.highlight ? "text-red-400" : "text-slate-300"}`}>{f.value}</div>
                )}
              </div>
            ))}
          </div>
          <div className="pt-2 border-t border-[#1e293b]">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4m0-4h.01"/></svg>
              User request: "
              {scenario === "block" ? "Clean up inactive CRM customers." :
               scenario === "approve" ? "Send follow-up emails to 38 leads." :
               "Read 12 internal knowledge-base articles."}
              "
            </div>
          </div>
        </div>

        {/* Risk Engine */}
        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Risk Engine</h2>

          {/* Score */}
          <div className="flex items-center gap-4">
            <div className="relative w-20 h-20 shrink-0">
              <svg viewBox="0 0 36 36" className="w-20 h-20 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke="#1e293b" strokeWidth="2.5"/>
                <circle
                  cx="18" cy="18" r="15.9" fill="none"
                  stroke={event.risk >= 80 ? "#ef4444" : event.risk >= 60 ? "#f97316" : event.risk >= 30 ? "#f59e0b" : "#10b981"}
                  strokeWidth="2.5"
                  strokeDasharray={`${event.risk} ${100 - event.risk}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-lg font-bold font-mono ${event.risk >= 80 ? "text-red-400" : event.risk >= 60 ? "text-orange-400" : event.risk >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                  {event.risk}
                </span>
              </div>
            </div>
            <div>
              <div className={`text-xl font-bold ${event.risk >= 80 ? "text-red-400" : event.risk >= 60 ? "text-orange-400" : event.risk >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {event.risk} / 100
              </div>
              <div className={`text-xs font-mono font-semibold uppercase tracking-wider ${event.risk >= 80 ? "text-red-400" : event.risk >= 60 ? "text-orange-400" : event.risk >= 30 ? "text-amber-400" : "text-emerald-400"}`}>
                {event.riskLevel} RISK
              </div>
            </div>
          </div>

          {/* Factors */}
          <div className="space-y-2">
            {event.riskFactors.map((f) => (
              <div key={f.label} className="flex items-center justify-between bg-[#111827] rounded px-3 py-2">
                <span className="text-xs text-slate-400">{f.label}</span>
                <span className="font-mono text-xs font-semibold text-slate-200">+{f.value}</span>
              </div>
            ))}
            {scenario === "block" && (
              <div className="flex items-center justify-between border-t border-[#1e293b] pt-2 mt-1">
                <span className="text-xs text-slate-500">Raw score → capped at 100</span>
                <span className="font-mono text-xs text-slate-400">115 → 100</span>
              </div>
            )}
          </div>

          {/* Deterministic notice */}
          <div className="flex items-start gap-2 p-3 bg-blue-950/20 border border-blue-500/20 rounded-lg">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-blue-400 mt-0.5 shrink-0"><path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z"/></svg>
            <div>
              <div className="text-xs font-semibold text-blue-300 mb-0.5">Deterministic Risk Engine</div>
              <div className="text-xs text-slate-500">Score calculated from explicit security factors. The LLM does not control the risk score or final decision.</div>
            </div>
          </div>
        </div>
      </div>

      {/* Policy + Decision */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Policy */}
        <div className="bg-[#0d1424] border border-[#1e293b] rounded-xl p-5 space-y-4">
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Policy Evaluation</h2>
          <div className="bg-[#111827] border border-[#1e293b] rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <Mono>{event.policy}</Mono>
              <span className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block"/>
                Active
              </span>
            </div>
            <div className="text-xs text-slate-500">
              <span className="text-slate-400 font-medium">Rule: </span>
              <Mono className="text-slate-300">
                {scenario === "block" ? 'IF action == "delete" AND scope.count > 100' :
                 scenario === "approve" ? 'IF send_email AND recipients.external == true' :
                 'IF action == "read" AND data.classification == "internal"'}
              </Mono>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">Result:</span>
              <span className={`px-3 py-1 rounded text-sm font-mono font-bold ${
                scenario === "block" ? "bg-red-500/20 text-red-400 border border-red-500/30" :
                scenario === "approve" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" :
                "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
              }`}>
                {scenario === "block" ? "BLOCK" : scenario === "approve" ? "REQUIRE APPROVAL" : "AUTO ALLOW"}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-500"><path d="M5 13l4 4L19 7"/></svg>
            <span className="text-slate-500">Policy matched</span>
            <span className="text-slate-600">·</span>
            {scenario === "block" ? (
              <span className="text-red-400">Execution prevented</span>
            ) : scenario === "approve" ? (
              <span className="text-amber-400">Human approval required</span>
            ) : (
              <span className="text-emerald-400">Automatically authorized</span>
            )}
          </div>
        </div>

        {/* Final decision */}
        <div className={`border rounded-xl p-5 space-y-4 ${
          scenario === "block" ? "border-red-500/30 bg-red-950/10 glow-red" :
          scenario === "approve" ? "border-amber-500/30 bg-amber-950/10 glow-amber" :
          "border-emerald-500/30 bg-emerald-950/10 glow-green"
        }`}>
          <h2 className="text-xs font-medium text-slate-500 uppercase tracking-wider">Final Decision</h2>

          <div className={`text-4xl font-black font-mono tracking-tight ${
            scenario === "block" ? "text-red-400" :
            scenario === "approve" ? "text-amber-400" :
            "text-emerald-400"
          }`}>
            {decisionLabel}
          </div>

          <p className="text-sm text-slate-400">
            {scenario === "block" ? "147 customer records were not deleted. Agent request intercepted before execution." :
             scenario === "approve" ? "Action paused. Awaiting human authorization before email delivery." :
             "Safe action automatically executed. Low-risk actions continue without unnecessary human friction."}
          </p>

          <div className="space-y-2 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Risk:</span>
              <span className={event.risk >= 80 ? "text-red-400" : event.risk >= 60 ? "text-orange-400" : event.risk >= 30 ? "text-amber-400" : "text-emerald-400"}>{event.risk}/100</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Policy:</span>
              <span className="text-blue-300">{event.policy}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Execution:</span>
              <span className={scenario === "block" ? "text-red-400" : scenario === "approve" ? "text-amber-400" : "text-emerald-400"}>
                {scenario === "block" ? "Prevented" : scenario === "approve" ? "Pending Approval" : "Successful"}
              </span>
            </div>
            {scenario === "allow" && (
              <>
                <div className="flex items-center gap-2">
                  <span className="text-slate-500">Human approval:</span>
                  <span className="text-emerald-400">Not required</span>
                </div>
              </>
            )}
          </div>

          <button
            onClick={() => onAuditEvent(event)}
            className="mt-2 text-xs text-blue-400 hover:text-blue-300 underline underline-offset-2 transition-colors"
          >
            View Audit Event →
          </button>
        </div>
      </div>
    </div>
  );
}
