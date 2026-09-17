import { type ReactNode } from "react";
import type { Decision, Risk } from "../data/mockData";

// ── Decision badge ──────────────────────────────────────────────────────────
export function DecisionBadge({ decision }: { decision: Decision }) {
  const cfg: Record<Decision, { cls: string; label: string }> = {
    BLOCKED: { cls: "bg-red-500/15 text-red-400 border border-red-500/30", label: "BLOCKED" },
    "APPROVAL REQUIRED": { cls: "bg-amber-500/15 text-amber-400 border border-amber-500/30", label: "APPROVAL REQUIRED" },
    "AUTO ALLOWED": { cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", label: "AUTO ALLOWED" },
    APPROVED: { cls: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30", label: "APPROVED" },
    DENIED: { cls: "bg-red-500/15 text-red-400 border border-red-500/30", label: "DENIED" },
  };
  const { cls, label } = cfg[decision];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-mono font-medium tracking-wide ${cls}`}>
      {label}
    </span>
  );
}

// ── Risk badge ──────────────────────────────────────────────────────────────
export function RiskBadge({ level, score }: { level: Risk; score: number }) {
  const cfg: Record<Risk, string> = {
    CRITICAL: "text-red-400",
    HIGH: "text-orange-400",
    "MEDIUM-HIGH": "text-amber-400",
    MEDIUM: "text-amber-300",
    LOW: "text-emerald-400",
  };
  return (
    <span className={`font-mono text-sm font-semibold ${cfg[level]}`}>
      {score}<span className="text-slate-500">/100</span>
    </span>
  );
}

// ── Risk score color ─────────────────────────────────────────────────────────
export function riskColor(score: number) {
  if (score >= 80) return "text-red-400";
  if (score >= 60) return "text-orange-400";
  if (score >= 30) return "text-amber-400";
  return "text-emerald-400";
}

export function riskBg(score: number) {
  if (score >= 80) return "bg-red-500";
  if (score >= 60) return "bg-orange-500";
  if (score >= 30) return "bg-amber-500";
  return "bg-emerald-500";
}

export function riskLevelLabel(score: number): Risk {
  if (score >= 80) return "CRITICAL";
  if (score >= 60) return "HIGH";
  if (score >= 30) return "MEDIUM-HIGH";
  return "LOW";
}

// ── KPI Card ─────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  sub,
  accent,
  icon,
}: {
  label: string;
  value: string | number;
  sub?: string;
  accent?: "red" | "amber" | "green" | "blue" | "default";
  icon?: ReactNode;
}) {
  const accentMap = {
    red: "text-red-400",
    amber: "text-amber-400",
    green: "text-emerald-400",
    blue: "text-blue-400",
    default: "text-slate-100",
  };
  return (
    <div className="bg-[#0d1424] border border-[#1e293b] rounded-lg p-4 flex flex-col gap-1 hover:border-[#2d3f5a] transition-colors">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        {icon && <span className="text-slate-600">{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${accentMap[accent ?? "default"]}`}>{value}</span>
      {sub && <span className="text-xs text-slate-600">{sub}</span>}
    </div>
  );
}

// ── Section header ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </div>
  );
}

// ── Policy action badge ──────────────────────────────────────────────────────
export function PolicyActionBadge({ action }: { action: string }) {
  if (action === "BLOCK")
    return <span className="px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-xs font-mono font-medium">BLOCK</span>;
  if (action === "REQUIRE APPROVAL")
    return <span className="px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded text-xs font-mono font-medium">REQUIRE APPROVAL</span>;
  return <span className="px-2 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded text-xs font-mono font-medium">AUTO ALLOW</span>;
}

// ── Risk meter bar ───────────────────────────────────────────────────────────
export function RiskMeter({ score, animate = false }: { score: number; animate?: boolean }) {
  const color = score >= 80 ? "bg-red-500" : score >= 60 ? "bg-orange-500" : score >= 30 ? "bg-amber-500" : "bg-emerald-500";
  return (
    <div className="h-2 bg-[#1e293b] rounded-full overflow-hidden">
      <div
        className={`h-full ${color} rounded-full transition-all duration-1000`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

// ── Inline code / monospace value ─────────────────────────────────────────────
export function Mono({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono text-blue-300 bg-blue-950/30 px-1.5 py-0.5 rounded text-xs ${className}`}>
      {children}
    </span>
  );
}

// ── Shield icon SVG ──────────────────────────────────────────────────────────
export function ShieldIcon({ size = 20, className = "" }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" className={className}>
      <path d="M12 2L4 6v6c0 5.55 3.84 10.74 8 12 4.16-1.26 8-6.45 8-12V6l-8-4z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity="0.1"/>
      <path d="M9 12l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}
