/**
 * Debug utility for consistent logging across the app
 * Supports different log levels with color-coded console output
 */

export const debug = {
  /**
   * Info level log - blue
   */
  log: (tag: string, msg: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `%c[${timestamp}] [${tag}]`,
      'color: #3b82f6; font-weight: bold',
      msg,
      data || ''
    );
  },

  /**
   * Success level log - green
   */
  success: (tag: string, msg: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.log(
      `%c[${timestamp}] [${tag}]`,
      'color: #22c55e; font-weight: bold',
      msg,
      data || ''
    );
  },

  /**
   * Warning level log - yellow
   */
  warn: (tag: string, msg: string, data?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.warn(
      `%c[${timestamp}] [${tag}]`,
      'color: #f59e0b; font-weight: bold',
      msg,
      data || ''
    );
  },

  /**
   * Error level log - red
   */
  error: (tag: string, msg: string, err?: any) => {
    const timestamp = new Date().toLocaleTimeString();
    console.error(
      `%c[${timestamp}] [${tag}]`,
      'color: #ef4444; font-weight: bold',
      msg,
      err || ''
    );
  },

  /**
   * Group related logs together
   */
  group: (label: string) => {
    console.group(`%c${label}`, 'color: #8b5cf6; font-weight: bold');
  },

  /**
   * End log group
   */
  groupEnd: () => {
    console.groupEnd();
  },

  /**
   * Table log - useful for displaying arrays/objects
   */
  table: (data: any) => {
    console.table(data);
  },
};

/**
 * Debug helper to inspect AI Agent response structure
 * Useful for understanding why model may or may not call tools
 */
export const debugResponse = (response: any) => {
  debug.group('Response Structure Analysis');
  
  debug.log('RESPONSE', 'Has text content:', !!response.text && response.text.trim().length > 0);
  if (response.text) {
    debug.log('RESPONSE', `Text length: ${response.text.length} chars`);
    debug.log('RESPONSE', `Text preview: "${response.text.substring(0, 100)}..."`);
  }

  debug.log('RESPONSE', 'Has function calls:', !!response.functionCalls);
  if (response.functionCalls) {
    debug.log('RESPONSE', `Function call count: ${response.functionCalls.length}`);
    response.functionCalls.forEach((call: any, idx: number) => {
      debug.log('RESPONSE', `  [${idx}] ${call.name}`, call.args);
    });
  }

  const candidates = response.candidates?.[0];
  debug.log('RESPONSE', 'Has candidates:', !!candidates);
  if (candidates) {
    debug.log('RESPONSE', 'Candidate content:', candidates.content);
    debug.log('RESPONSE', 'Has grounding metadata:', !!candidates.groundingMetadata);
    if (candidates.groundingMetadata?.groundingChunks) {
      debug.log('RESPONSE', `Grounding chunks: ${candidates.groundingMetadata.groundingChunks.length}`);
    }
  }

  debug.log('RESPONSE', 'Full response object:', response);
  debug.groupEnd();
};
