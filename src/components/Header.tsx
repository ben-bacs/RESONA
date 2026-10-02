import React from "react";
import { Activity, ShieldCheck } from "lucide-react";

export const Header: React.FC = () => {
  return (
    <header className="flex items-center justify-between pb-4 border-b border-white/5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-primary to-accent flex items-center justify-center shadow-lg shadow-primary/20">
          <Activity className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white">RESONA</h1>
            <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30">
              v0.1.0 MVP
            </span>
          </div>
          <p className="text-xs text-muted">Windows 11 Ambient Music Visualizer</p>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-surface border border-white/5 text-xs text-muted font-mono">
          <span className="w-2 h-2 rounded-full bg-emerald-400" />
          <span>WASAPI: Default Loopback</span>
        </div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface border border-white/5 text-xs text-muted">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
          <span>Local Core</span>
        </div>
      </div>
    </header>
  );
};
