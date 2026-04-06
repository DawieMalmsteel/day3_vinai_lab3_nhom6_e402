/**
 * Telemetry / Structured Logger — browser-compatible
 *
 * - Ghi structured JSON log (JSONL) trong memory
 * - Pretty-print màu lên console
 * - Tự động POST lên Vite dev server → ghi file vào logs/
 * - Cho phép download thủ công .jsonl / .json
 */

// ────────────────────────────── Types ──────────────────────────────

export interface LogEvent {
  timestamp: string;
  event: string;
  data: Record<string, any>;
}

export interface SessionLog {
  session_id: string;
  label: 'chatbot' | 'agent';
  query: string;
  provider: string;
  model: string;
  start_time: number;
  events: LogEvent[];
}

// ────────────────────────────── State ──────────────────────────────

let currentSession: SessionLog | null = null;

/** Tất cả session đã kết thúc — dùng cho comparison */
const completedSessions: SessionLog[] = [];

// ────────────────────────────── Server sync ───────────────────────

/**
 * POST dữ liệu lên Vite dev server (fire-and-forget).
 * Nếu server không chạy (production build) thì bỏ qua.
 */
function postToServer(endpoint: string, body: any): void {
  try {
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {
      // Bỏ qua nếu server không có endpoint (e.g. production)
    });
  } catch {
    // ignore
  }
}

// ────────────────────────────── Session ────────────────────────────

export function createSessionId(): string {
  return `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function startSessionLog(
  label: 'chatbot' | 'agent',
  query: string,
  provider: string,
  model: string,
): SessionLog {
  // Archive session cũ nếu chưa close
  if (currentSession) {
    completedSessions.push(currentSession);
  }

  currentSession = {
    session_id: createSessionId(),
    label,
    query,
    provider,
    model,
    start_time: Date.now(),
    events: [],
  };

  const startEvent = label === 'chatbot' ? 'CHATBOT_START' : 'AGENT_START';
  logEvent(startEvent, {
    session_id: currentSession.session_id,
    query,
    provider,
    model,
  });

  return currentSession;
}

export function getCurrentSession(): SessionLog | null {
  return currentSession;
}

export function getCompletedSessions(): SessionLog[] {
  return completedSessions;
}

// ────────────────────────────── Log Event ──────────────────────────

export function logEvent(event: string, data: Record<string, any>): void {
  const entry: LogEvent = {
    timestamp: new Date().toISOString(),
    event,
    data,
  };

  if (currentSession) {
    currentSession.events.push(entry);

    // → Ghi vào file trên server (real-time, mỗi event 1 dòng)
    postToServer('/api/log/event', {
      session_id: currentSession.session_id,
      label: currentSession.label,
      event: entry,
    });
  }

  // Pretty-print console (giống ảnh mẫu trên lớp)
  const color = EVENT_COLORS[event] ?? 'color:#888';
  console.log(
    `%c[${entry.timestamp}] %c[${event}]`,
    'color:#666',
    color + ';font-weight:bold',
    data,
  );
}

const EVENT_COLORS: Record<string, string> = {
  CHATBOT_START:        'color:#3b82f6',
  AGENT_START:          'color:#8b5cf6',
  LLM_METRIC:           'color:#f59e0b',
  AGENT_REASONING_STEP: 'color:#6366f1',
  TOOL_CALL:            'color:#06b6d4',
  TOOL_RESULT:          'color:#22c55e',
  CHATBOT_END:          'color:#10b981',
  AGENT_SUCCESS:        'color:#10b981',
  ERROR:                'color:#ef4444',
};

// ────────────────────────────── End Session ────────────────────────

export function endSession(
  finalAnswer: string,
  extraData: Record<string, any> = {},
): void {
  if (!currentSession) return;

  const totalDuration = Date.now() - currentSession.start_time;
  const endEvent = currentSession.label === 'chatbot' ? 'CHATBOT_END' : 'AGENT_SUCCESS';

  logEvent(endEvent, {
    final_answer: finalAnswer.slice(0, 200),
    total_duration_ms: totalDuration,
    ...extraData,
  });

  // → Ghi toàn bộ session ra file (.jsonl + .json)
  saveSessionToServer(currentSession);

  completedSessions.push(currentSession);
  currentSession = null;
}

export function logError(
  label: string,
  step: number,
  errorType: string,
  message: string,
): void {
  logEvent('ERROR', { label, step, error_type: errorType, message });
}

// ────────────────────────────── Save to server ────────────────────

/** Gửi toàn bộ session lên server → server ghi .jsonl + .json vào logs/ */
export function saveSessionToServer(session: SessionLog): void {
  postToServer('/api/log/session', session);
}

/** Gửi comparison lên server → server ghi .md + .json vào logs/ */
export function saveComparisonToServer(summary: any, markdown: string): void {
  postToServer('/api/log/compare', { summary, markdown });
}

// ────────────────────────────── Export / Download (browser) ───────

function downloadBlob(content: string, filename: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportSessionLogJsonl(session?: SessionLog): void {
  const s = session ?? completedSessions[completedSessions.length - 1];
  if (!s) {
    console.warn('No session to export');
    return;
  }
  const jsonl = s.events.map(e => JSON.stringify(e)).join('\n') + '\n';
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadBlob(jsonl, `session_${s.label}_${ts}.jsonl`, 'application/jsonl');
}

export function exportSessionLogJson(session?: SessionLog): void {
  const s = session ?? completedSessions[completedSessions.length - 1];
  if (!s) {
    console.warn('No session to export');
    return;
  }
  const json = JSON.stringify(s, null, 2);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadBlob(json, `session_${s.label}_${ts}.json`, 'application/json');
}

/** Trả về JSONL string cho hiển thị trong UI panel */
export function getSessionJsonl(session?: SessionLog): string {
  const s = session ?? currentSession ?? completedSessions[completedSessions.length - 1];
  if (!s) return '';
  return s.events.map(e => JSON.stringify(e)).join('\n');
}
