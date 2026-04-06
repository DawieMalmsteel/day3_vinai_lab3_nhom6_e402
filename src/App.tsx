import React, { useState, useRef, useEffect } from 'react';
import { Send, Plane, Hotel, MapPin, Compass, Loader2, User, Bot, Sparkles, ChevronRight, BarChart3, Download, ToggleLeft, ToggleRight, FileText, X } from 'lucide-react';
import Markdown from 'react-markdown';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { chatWithTravelAgent, handleToolCalls, resetStepCounter, getStepCount, PROVIDER, MODEL } from './services/gemini';
import { debug } from './utils/debug';
import { startSessionLog, endSession, logError, getCompletedSessions, exportSessionLogJsonl, getSessionJsonl, getCurrentSession, saveComparisonToServer } from './utils/telemetry';
import { finalizeRunSummary, buildComparisonSummary, exportComparisonMarkdown, downloadComparisonMd, downloadComparisonJson, type RunSummary, type ComparisonSummary } from './utils/comparison';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  isPlanning?: boolean;
  sources?: { uri: string; title: string }[];
}

export default function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'model', text: 'Xin chào! Tôi là trợ lý du lịch AI của bạn. Tôi có thể giúp bạn tìm chuyến bay, khách sạn và lên kế hoạch lộ trình chi tiết. Bạn muốn đi đâu hôm nay?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ────────── Telemetry state ──────────
  const [mode, setMode] = useState<'agent' | 'chatbot'>('agent');
  const [showPanel, setShowPanel] = useState(false);
  const [panelTab, setPanelTab] = useState<'log' | 'compare'>('log');
  const [chatbotSummary, setChatbotSummary] = useState<RunSummary | null>(null);
  const [agentSummary, setAgentSummary] = useState<RunSummary | null>(null);
  const [comparison, setComparison] = useState<ComparisonSummary | null>(null);
  const [liveLog, setLiveLog] = useState('');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Refresh live log periodically
  useEffect(() => {
    if (!showPanel || panelTab !== 'log') return;
    const id = setInterval(() => {
      setLiveLog(getSessionJsonl() || '(chưa có session)');
    }, 500);
    return () => clearInterval(id);
  }, [showPanel, panelTab]);

  // ────────── Build comparison whenever both summaries exist ──────
  useEffect(() => {
    if (chatbotSummary && agentSummary) {
      const comp = buildComparisonSummary(chatbotSummary, agentSummary);
      setComparison(comp);
      // Tự động ghi comparison vào logs/
      saveComparisonToServer(comp, exportComparisonMarkdown(comp));
    }
  }, [chatbotSummary, agentSummary]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    debug.group(`Chat Cycle [${mode}]: ${userMessage.substring(0, 50)}...`);
    debug.log('APP', `User message received (mode=${mode})`, userMessage);

    // ── Start telemetry session ──
    resetStepCounter();
    const session = startSessionLog(mode as 'chatbot' | 'agent', userMessage, PROVIDER, MODEL);
    debug.log('APP', `Session started: ${session.session_id}`);

    try {
      let chatHistory = messages.map(m => ({
        role: m.role,
        parts: [{ text: m.text }]
      }));
      chatHistory.push({ role: 'user', parts: [{ text: userMessage }] });

      debug.log('APP', `Chat history prepared`, { messageCount: chatHistory.length });

      let response = await chatWithTravelAgent(chatHistory, mode);
      debug.log('APP', 'Initial response received from model');

      if (mode === 'agent') {
        // ── Agent mode: ReAct tool loop ──
        let toolResults = await handleToolCalls(response);
        let cycleCount = 0;
        let usedTools = false;
        let totalToolCalls = 0;

        while (toolResults) {
          usedTools = true;
          cycleCount++;
          totalToolCalls += toolResults.length;
          debug.log('APP', `ReAct cycle ${cycleCount}: Tool calls detected`, {
            toolCount: toolResults.length,
            tools: toolResults.map(r => r.functionResponse.name),
          });

          const toolNames = toolResults.map(r => r.functionResponse.name).join(', ');
          setMessages(prev => [...prev, {
            role: 'model',
            text: `*Đang truy xuất thông tin từ cẩm nang (${toolNames})...*`,
            isPlanning: true
          }]);

          chatHistory.push(response.candidates![0].content as any);
          chatHistory.push({
            role: 'user',
            parts: toolResults as any
          });

          debug.log('APP', `Calling model again with tool results (cycle ${cycleCount})`);

          response = await chatWithTravelAgent(chatHistory, mode);
          toolResults = await handleToolCalls(response);

          setMessages(prev => prev.filter(m => !m.isPlanning));
        }

        if (usedTools) {
          debug.success('APP', `ReAct loop completed after ${cycleCount} cycle(s)`);
        } else {
          debug.warn('APP', 'Model did not call any tools - using direct response (Hybrid Fallback Mode)');
        }
      }
      // Chatbot mode: no tool loop — response is the final answer

      const modelText = response.text || "Xin lỗi, tôi gặp sự cố khi xử lý yêu cầu của bạn.";

      // Extract grounding sources
      const sources: { uri: string; title: string }[] = [];
      const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (groundingChunks) {
        debug.log('APP', `Found ${groundingChunks.length} grounding chunks`);
        groundingChunks.forEach((chunk: any) => {
          if (chunk.web) {
            sources.push({ uri: chunk.web.uri, title: chunk.web.title });
          }
        });
        debug.success('APP', `Extracted ${sources.length} reference sources`);
      }

      setMessages(prev => [...prev, { role: 'model', text: modelText, sources }]);
      debug.success('APP', 'Final response added to chat');

      // ── End telemetry session & generate summary ──
      const currentSess = getCurrentSession();
      if (currentSess) {
        endSession(modelText, {
          total_tokens: 0, // will be summed in finalizeRunSummary
          total_cost_usd: 0,
          steps: getStepCount(),
          tool_call_count: currentSess.events.filter(e => e.event === 'TOOL_CALL').length,
        });
      }

      // Finalize summary
      const sessions = getCompletedSessions();
      const lastSession = sessions[sessions.length - 1];
      if (lastSession) {
        const summary = finalizeRunSummary(lastSession);
        if (mode === 'chatbot') {
          setChatbotSummary(summary);
        } else {
          setAgentSummary(summary);
        }
        debug.success('APP', `${mode} summary finalized`, summary);
      }

    } catch (error: any) {
      debug.error('APP', 'Chat error occurred', error);
      console.error("Chat error:", error);

      // ── Log error event ──
      logError(mode, getStepCount(), 'PROVIDER_ERROR', error?.message ?? 'Unknown error');

      let errorMessage = "Đã có lỗi xảy ra. Vui lòng thử lại sau.";

      if (error?.message?.includes("429") || error?.status === "RESOURCE_EXHAUSTED") {
        errorMessage = "Hệ thống đang quá tải (vượt quá hạn mức). Vui lòng đợi 1-2 phút rồi thử lại.";
      } else if (error?.message?.includes("500") || error?.message?.includes("xhr error")) {
        errorMessage = "Lỗi kết nối máy chủ. Vui lòng kiểm tra mạng và thử lại.";
      }

      setMessages(prev => [...prev, { role: 'model', text: errorMessage }]);
    } finally {
      setIsLoading(false);
      debug.groupEnd();
    }
  };

  // ────────────────────────────── Render ──────────────────────────

  return (
    <div className="flex flex-col h-screen max-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-xl">
            <Compass className="text-white w-6 h-6" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-slate-900 tracking-tight">AI Travel Agent</h1>
            <p className="text-xs text-slate-500 font-medium flex items-center gap-1">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
              {mode === 'agent' ? 'Agent Mode (Tool Loop)' : 'Chatbot Mode (No Tools)'}
            </p>
          </div>
        </div>

        {/* Mode toggle + Telemetry buttons */}
        <div className="flex items-center gap-3">
          {/* Mode Toggle */}
          <button
            onClick={() => setMode(mode === 'agent' ? 'chatbot' : 'agent')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
              mode === 'agent'
                ? "bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100"
                : "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
            )}
            disabled={isLoading}
          >
            {mode === 'agent' ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            {mode === 'agent' ? 'Agent' : 'Chatbot'}
          </button>

          {/* Telemetry Panel Toggle */}
          <button
            onClick={() => setShowPanel(!showPanel)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all border",
              showPanel
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200"
            )}
          >
            <BarChart3 className="w-4 h-4" />
            Telemetry
          </button>

          <div className="hidden md:flex items-center gap-4 text-sm font-medium text-slate-600">
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Plane className="w-4 h-4" />
              <span>Ve may bay</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-full">
              <Hotel className="w-4 h-4" />
              <span>Khach san</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Chat Area */}
        <main className={cn("flex-1 overflow-y-auto p-4 md:p-8 space-y-6 transition-all", showPanel && "md:mr-0")}>
          <div className="max-w-4xl mx-auto space-y-6">
            {messages.map((msg, idx) => (
              <div
                key={idx}
                className={cn(
                  "flex gap-4 group animate-in fade-in slide-in-from-bottom-2 duration-300",
                  msg.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}
              >
                <div className={cn(
                  "w-10 h-10 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
                  msg.role === 'user' ? "bg-slate-800" : "bg-blue-600"
                )}>
                  {msg.role === 'user' ? <User className="text-white w-5 h-5" /> : <Bot className="text-white w-5 h-5" />}
                </div>
                <div className={cn(
                  "max-w-[85%] md:max-w-[70%] rounded-3xl px-6 py-4 shadow-sm",
                  msg.role === 'user'
                    ? "bg-slate-800 text-white rounded-tr-none"
                    : msg.isPlanning
                      ? "bg-blue-50 border border-blue-100 text-blue-600 italic text-sm rounded-tl-none"
                      : "bg-white border border-slate-200 text-slate-800 rounded-tl-none"
                )}>
                  <div className="markdown-body">
                    <Markdown>{msg.text}</Markdown>
                  </div>
                  {msg.sources && msg.sources.length > 0 && (
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Nguon tham khao:</p>
                      <div className="flex flex-wrap gap-2">
                        {msg.sources.map((source, sIdx) => (
                          <a
                            key={sIdx}
                            href={source.uri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-blue-600 hover:underline bg-blue-50 px-2 py-1 rounded flex items-center gap-1 transition-colors hover:bg-blue-100"
                          >
                            <MapPin className="w-2.5 h-2.5" />
                            {source.title || 'Xem nguon'}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-2xl bg-blue-100 flex items-center justify-center shrink-0">
                  <Sparkles className="text-blue-400 w-5 h-5 animate-spin" />
                </div>
                <div className="bg-white border border-slate-200 rounded-3xl rounded-tl-none px-6 py-4 w-48 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
                  <span className="text-sm text-slate-500 font-medium">Dang tinh toan...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        {/* ────────── Telemetry Side Panel ────────── */}
        {showPanel && (
          <aside className="w-full md:w-[520px] border-l border-slate-200 bg-white flex flex-col overflow-hidden">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex gap-1">
                <button
                  onClick={() => setPanelTab('log')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    panelTab === 'log' ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  Raw Log (JSONL)
                </button>
                <button
                  onClick={() => setPanelTab('compare')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-xs font-semibold transition-all",
                    panelTab === 'compare' ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-200"
                  )}
                >
                  So sanh
                </button>
              </div>
              <button onClick={() => setShowPanel(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Panel Body */}
            <div className="flex-1 overflow-y-auto p-4">
              {panelTab === 'log' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700">Structured Log</h3>
                    <button
                      onClick={() => {
                        const sessions = getCompletedSessions();
                        if (sessions.length > 0) exportSessionLogJsonl(sessions[sessions.length - 1]);
                      }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      <Download className="w-3 h-3" />
                      Download .jsonl
                    </button>
                  </div>
                  <pre className="bg-slate-900 text-green-400 text-[11px] leading-relaxed p-4 rounded-xl overflow-x-auto whitespace-pre-wrap font-mono max-h-[calc(100vh-250px)]">
                    {liveLog || '(chua co log — hay gui 1 tin nhan de bat dau)'}
                  </pre>
                </div>
              )}

              {panelTab === 'compare' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-bold text-slate-700">Bang so sanh Chatbot vs Agent</h3>
                    {comparison && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => downloadComparisonMd(comparison)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <FileText className="w-3 h-3" />
                          .md
                        </button>
                        <button
                          onClick={() => downloadComparisonJson(comparison)}
                          className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          <Download className="w-3 h-3" />
                          .json
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Status badges */}
                  <div className="flex gap-2 mb-4">
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      chatbotSummary ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    )}>
                      Chatbot: {chatbotSummary ? 'Done' : 'Chua chay'}
                    </span>
                    <span className={cn(
                      "text-xs px-2.5 py-1 rounded-full font-medium",
                      agentSummary ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-400"
                    )}>
                      Agent: {agentSummary ? 'Done' : 'Chua chay'}
                    </span>
                  </div>

                  {/* Hướng dẫn nếu chưa đủ data */}
                  {(!chatbotSummary || !agentSummary) && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-700 mb-4">
                      <p className="font-semibold mb-1">Huong dan so sanh cong bang:</p>
                      <ol className="list-decimal ml-4 space-y-1">
                        <li>Chuyen sang <strong>Chatbot</strong> mode, gui 1 cau hoi</li>
                        <li>Chuyen sang <strong>Agent</strong> mode, gui <strong>cung cau hoi do</strong></li>
                        <li>Bang so sanh se tu dong hien o day</li>
                      </ol>
                    </div>
                  )}

                  {/* Comparison Table */}
                  {comparison && (
                    <div className="space-y-4">
                      <div className="bg-slate-50 rounded-xl p-3 text-xs text-slate-500">
                        <span className="font-semibold">Query:</span> {comparison.query}
                      </div>

                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b-2 border-slate-200">
                              <th className="text-left py-2 px-3 text-slate-500 font-semibold text-xs">Metric</th>
                              <th className="text-right py-2 px-3 text-amber-600 font-semibold text-xs">Chatbot</th>
                              <th className="text-right py-2 px-3 text-purple-600 font-semibold text-xs">Agent</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            <CompareRow label="Total Tokens" a={comparison.chatbot.total_tokens.toLocaleString()} b={comparison.agent.total_tokens.toLocaleString()} highlight />
                            <CompareRow label="Prompt Tokens" a={comparison.chatbot.prompt_tokens.toLocaleString()} b={comparison.agent.prompt_tokens.toLocaleString()} />
                            <CompareRow label="Completion Tokens" a={comparison.chatbot.completion_tokens.toLocaleString()} b={comparison.agent.completion_tokens.toLocaleString()} />
                            <CompareRow label="Total Cost (USD)" a={`$${comparison.chatbot.total_cost_usd.toFixed(6)}`} b={`$${comparison.agent.total_cost_usd.toFixed(6)}`} highlight />
                            <CompareRow label="Avg Latency (ms)" a={comparison.chatbot.avg_latency_ms.toLocaleString()} b={comparison.agent.avg_latency_ms.toLocaleString()} highlight />
                            <CompareRow label="Total Duration (ms)" a={comparison.chatbot.total_duration_ms.toLocaleString()} b={comparison.agent.total_duration_ms.toLocaleString()} />
                            <CompareRow label="LLM Calls" a={String(comparison.chatbot.llm_call_count)} b={String(comparison.agent.llm_call_count)} />
                            <CompareRow label="Loop Count" a={String(comparison.chatbot.loop_count)} b={String(comparison.agent.loop_count)} highlight />
                            <CompareRow label="Tool Call Count" a={String(comparison.chatbot.tool_call_count)} b={String(comparison.agent.tool_call_count)} highlight />
                            <CompareRow label="Error Count" a={String(comparison.chatbot.error_count)} b={String(comparison.agent.error_count)} />
                          </tbody>
                        </table>
                      </div>

                      {/* Diff summary */}
                      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 space-y-1.5 text-xs text-blue-800">
                        <p className="font-bold text-sm mb-2">Nhan xet</p>
                        <p>- {comparison.diff.token_ratio}</p>
                        <p>- {comparison.diff.cost_ratio}</p>
                        <p>- Chenh lech latency: {comparison.diff.latency_diff_ms > 0 ? '+' : ''}{comparison.diff.latency_diff_ms}ms</p>
                        <p>- Agent dung them {comparison.diff.extra_tool_calls} tool calls, {comparison.diff.extra_loops} vong lap</p>
                      </div>
                    </div>
                  )}

                  {/* Individual summaries if no comparison yet */}
                  {!comparison && (chatbotSummary || agentSummary) && (
                    <div className="space-y-4">
                      {chatbotSummary && <SummaryCard summary={chatbotSummary} />}
                      {agentSummary && <SummaryCard summary={agentSummary} />}
                    </div>
                  )}
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Input Area */}
      <footer className="bg-white border-t border-slate-200 p-4 md:p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-3 bg-slate-100 p-2 rounded-2xl border border-slate-200 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100 transition-all">
            {/* Mode indicator */}
            <div className={cn(
              "px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wide shrink-0",
              mode === 'agent' ? "bg-purple-100 text-purple-700" : "bg-amber-100 text-amber-700"
            )}>
              {mode}
            </div>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="Nhap yeu cau du lich cua ban (VD: Len ke hoach di Da Nang 3 ngay...)"
              className="flex-1 bg-transparent border-none focus:ring-0 px-4 py-2 text-slate-800 placeholder:text-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={isLoading || !input.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white p-3 rounded-xl transition-colors shadow-md shadow-blue-200"
            >
              <Send className="w-5 h-5" />
            </button>
          </div>

          {/* Quick Suggestions */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              "Goi y dia diem o Da Lat",
              "Ke hoach Da Nang 3 ngay 10tr",
              "Tim khach san tai Phu Quoc",
              "Lich trinh trekking Sapa"
            ].map((suggestion, i) => (
              <button
                key={i}
                onClick={() => setInput(suggestion)}
                className="text-xs font-medium text-slate-500 bg-slate-50 hover:bg-white hover:text-blue-600 border border-slate-200 px-3 py-1.5 rounded-full transition-all flex items-center gap-1 group"
              >
                {suggestion}
                <ChevronRight className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
              </button>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}

// ────────────────────────────── Sub-components ────────────────────

function CompareRow({ label, a, b, highlight }: { label: string; a: string; b: string; highlight?: boolean }) {
  return (
    <tr className={highlight ? "bg-slate-50" : ""}>
      <td className={cn("py-2 px-3 text-xs", highlight ? "font-bold text-slate-800" : "text-slate-600")}>{label}</td>
      <td className="py-2 px-3 text-xs text-right font-mono text-amber-700">{a}</td>
      <td className="py-2 px-3 text-xs text-right font-mono text-purple-700">{b}</td>
    </tr>
  );
}

function SummaryCard({ summary }: { summary: RunSummary }) {
  return (
    <div className={cn(
      "rounded-xl border p-4",
      summary.label === 'chatbot' ? "border-amber-200 bg-amber-50" : "border-purple-200 bg-purple-50"
    )}>
      <h4 className={cn(
        "text-sm font-bold mb-3 uppercase",
        summary.label === 'chatbot' ? "text-amber-700" : "text-purple-700"
      )}>
        {summary.label} Summary
      </h4>
      <div className="grid grid-cols-2 gap-2 text-xs">
        <div>Total Tokens: <span className="font-mono font-bold">{summary.total_tokens.toLocaleString()}</span></div>
        <div>Cost: <span className="font-mono font-bold">${summary.total_cost_usd.toFixed(6)}</span></div>
        <div>Avg Latency: <span className="font-mono font-bold">{summary.avg_latency_ms}ms</span></div>
        <div>Duration: <span className="font-mono font-bold">{summary.total_duration_ms}ms</span></div>
        <div>LLM Calls: <span className="font-mono font-bold">{summary.llm_call_count}</span></div>
        <div>Tool Calls: <span className="font-mono font-bold">{summary.tool_call_count}</span></div>
        <div>Loops: <span className="font-mono font-bold">{summary.loop_count}</span></div>
        <div>Errors: <span className="font-mono font-bold">{summary.error_count}</span></div>
      </div>
    </div>
  );
}
