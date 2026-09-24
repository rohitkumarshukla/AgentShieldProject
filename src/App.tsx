import { useState, useCallback } from "react";
import Overview from "./pages/Overview";
import LiveActions from "./pages/LiveActions";
import Approvals from "./pages/Approvals";
import RiskEngine from "./pages/RiskEngine";
import Policies from "./pages/Policies";
import Agents from "./pages/Agents";
import AuditLog from "./pages/AuditLog";
import Recovery from "./pages/Recovery";
import Demo from "./pages/Demo";
import DecisionGraph from "./pages/DecisionGraph";
import ThreatProtection from "./pages/ThreatProtection";
import AuditDrawer from "./components/AuditDrawer";
import Toast from "./components/Toast";
import { ShieldIcon } from "./components/shared";
import type { AuditEvent } from "./data/mockData";

type Page = "overview" | "liveactions" | "approvals" | "riskengine" | "policies" | "agents" | "auditlog" | "recovery" | "demo" | "decisiongraph" | "threats";

interface NavItem {
  id: Page;
  label: string;
  icon: React.ReactNode;
  badge?: string;
  badgeColor?: string;
}

const NAV: NavItem[] = [
  {
    id: "overview",
    label: "Overview",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>,
  },
  {
    id: "liveactions",
    label: "Live Actions",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>,
    badge: "LIVE",
    badgeColor: "bg-blue-500",
  },
  {
    id: "approvals",
    label: "Approvals",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>,
    badge: "7",
    badgeColor: "bg-amber-500",
  },
  {
    id: "decisiongraph",
    label: "Decision Graph",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><path d="M12 7v10M7 17l-1 1M17 17l1 1"/></svg>,
  },
  {
    id: "riskengine",
    label: "Risk Engine",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>,
  },
  {
    id: "policies",
    label: "Policies",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>,
  },
  {
    id: "agents",
    label: "Agents",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>,
  },
  {
    id: "auditlog",
    label: "Audit Log",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/></svg>,
  },
  {
    id: "recovery",
    label: "Recovery",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 12a9 9 0 109-9M3 3v6h6"/></svg>,
  },
  {
    id: "threats",
    label: "Threat Protection",
    icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><path d="M4.93 4.93l14.14 14.14"/></svg>,
  },
];

interface ToastState {
  id: number;
  message: string;
  type: "info" | "success" | "warning" | "error";
}

export default function App() {
  const [page, setPage] = useState<Page>("overview");
  const [liveScenario, setLiveScenario] = useState<string | undefined>();
  const [auditEvent, setAuditEvent] = useState<AuditEvent | null>(null);
  const [toasts, setToasts] = useState<ToastState[]>([]);
  const [sidebarOpen] = useState(true);

  const showToast = useCallback((message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  function navigate(p: string, scenario?: string) {
    setPage(p as Page);
    if (scenario) setLiveScenario(scenario);
  }

  function renderPage() {
    switch (page) {
      case "overview":
        return <Overview onNavigate={navigate} onAuditEvent={setAuditEvent} />;
      case "liveactions":
        return <LiveActions onAuditEvent={setAuditEvent} initialScenario={liveScenario as "block" | "approve" | "allow" | undefined} />;
      case "approvals":
        return <Approvals onToast={showToast} />;
      case "decisiongraph":
        return <DecisionGraph />;
      case "riskengine":
        return <RiskEngine />;
      case "policies":
        return <Policies />;
      case "agents":
        return <Agents onToast={showToast} />;
      case "auditlog":
        return <AuditLog onAuditEvent={setAuditEvent} />;
      case "recovery":
        return <Recovery onToast={showToast} />;
      case "threats":
        return <ThreatProtection />;
      case "demo":
        return <Demo onNavigate={navigate} />;
      default:
        return null;
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#070912]">
      {/* Sidebar */}
      <aside className="w-55 shrink-0 flex flex-col bg-[#080c18] border-r border-border h-full overflow-hidden">
        {/* Logo */}
        <div className="px-5 py-5 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <ShieldIcon size={16} className="text-blue-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-slate-100 tracking-wide">AgentShield</div>
              <div className="text-[10px] text-slate-600 font-mono">v0.1 · MVP</div>
            </div>
          </div>
        </div>

        {/* System status */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block"/>
            <span className="text-xs text-slate-500">All systems operational</span>
          </div>
          <div className="text-[10px] text-slate-600 mt-1 font-mono">PROD · 2026-09-17</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {NAV.map((item) => {
            const active = page === item.id;
            return (
              <button
                key={item.id}
                onClick={() => { setPage(item.id); if (item.id !== "liveactions") setLiveScenario(undefined); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                  active
                    ? "bg-blue-600/20 text-blue-300 border border-blue-500/20"
                    : "text-slate-500 hover:text-slate-300 hover:bg-secondary border border-transparent"
                }`}
              >
                <span className={active ? "text-blue-400" : "text-slate-600"}>{item.icon}</span>
                <span className="flex-1 text-left text-xs font-medium">{item.label}</span>
                {item.badge && (
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white ${item.badgeColor}`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          {/* Demo mode separator */}
          <div className="pt-3 border-t border-border mt-3">
            <button
              onClick={() => setPage("demo")}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all ${
                page === "demo"
                  ? "bg-indigo-600/20 text-indigo-300 border border-indigo-500/20"
                  : "text-slate-400 hover:text-slate-200 hover:bg-secondary border border-transparent"
              }`}
            >
              <span className={page === "demo" ? "text-indigo-400" : "text-slate-500"}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              </span>
              <span className="flex-1 text-left text-xs font-medium">Live Demo</span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold text-white bg-indigo-500">DEMO</span>
            </button>
          </div>
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-border space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-xs text-slate-300 font-semibold">A</div>
            <div>
              <div className="text-xs text-slate-300 font-medium">Security Admin</div>
              <div className="text-[10px] text-slate-600">admin@acme.io</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block"/>
            <span className="text-[10px] text-slate-600 font-mono">Latency: 3.1ms avg</span>
          </div>
        </div>
      </aside>

      {/* Top bar */}
      <div className="flex-1 flex flex-col min-h-0">
        <header className="h-12 shrink-0 border-b border-border bg-[#080c18] flex items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <span className="text-xs text-slate-500 font-mono">ACME Corp</span>
            <span className="text-slate-600">/</span>
            <span className="px-2 py-0.5 bg-red-500/15 text-red-400 border border-red-500/30 rounded text-xs font-mono font-semibold">Production</span>
          </div>
          <div className="flex items-center gap-4">
            <button className="relative text-slate-500 hover:text-slate-300 transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 01-3.46 0"/></svg>
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-amber-500 rounded-full text-[9px] text-white flex items-center justify-center font-bold">7</span>
            </button>
            <div className="flex items-center gap-2 text-xs text-slate-600 font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 status-pulse inline-block"/>
              <span>18,492 intercepted today</span>
            </div>
          </div>
        </header>

        {/* Main scroll area */}
        <main className="flex-1 overflow-y-auto">
          {renderPage()}
        </main>
      </div>

      {/* Audit drawer */}
      <AuditDrawer event={auditEvent} onClose={() => setAuditEvent(null)} />

      {/* Toasts */}
      <div className="fixed bottom-6 right-6 z-100 space-y-2">
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </div>
  );
}
