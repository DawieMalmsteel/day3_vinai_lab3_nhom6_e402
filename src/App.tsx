import React, { useState } from "react";
import {
  Compass,
  Zap,
  BotIcon,
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import GeminiChat from "./components/GeminiChat";
import AgentChat from "./components/AgentChat";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [currentPage, setCurrentPage] = useState<"gemini" | "agent">("gemini");

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50">
      {/* Header with Navigation */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-10 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl shadow-lg shadow-blue-200">
            <Compass className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">
              AI Travel Planner
            </h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              Lên kế hoạch du lịch thông minh
            </p>
          </div>
        </div>

        {/* Navigation Switcher */}
        <div className="flex items-center bg-slate-100 p-1 rounded-2xl border border-slate-200">
          <button
            onClick={() => setCurrentPage("gemini")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300",
              currentPage === "gemini"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <Zap className={cn("w-4 h-4", currentPage === "gemini" ? "text-blue-600" : "text-slate-400")} />
            <span>Gemini SDK</span>
          </button>
          <button
            onClick={() => setCurrentPage("agent")}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-300",
              currentPage === "agent"
                ? "bg-white text-blue-600 shadow-sm"
                : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
            )}
          >
            <BotIcon className={cn("w-4 h-4", currentPage === "agent" ? "text-blue-600" : "text-slate-400")} />
            <span>Agent ReAct</span>
          </button>
        </div>
      </header>

      {/* Page Content */}
      <div className="flex-1 overflow-hidden">
        {currentPage === "gemini" ? <GeminiChat /> : <AgentChat />}
      </div>
    </div>
  );
}
