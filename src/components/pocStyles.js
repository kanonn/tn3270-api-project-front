import { useState, useRef, useCallback } from 'react';

/**
 * Shared log hook for POC pages.
 */
export function useLog() {
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  const addLog = useCallback((type, message, screenData) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => {
      const arr = [...prev, { ts, type, message }];
      if (screenData) {
        const str = Array.isArray(screenData)
          ? screenData.map((l, i) => `  ${String(i + 1).padStart(2, '0')}| ${l}`).join('\n')
          : JSON.stringify(screenData, null, 2);
        arr.push({ ts, type: 'SCREEN', message: str });
      }
      return arr;
    });
    setTimeout(() => {
      if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const logStep = useCallback((m, s) => addLog('STEP', m, s), [addLog]);
  const logOk = useCallback((m) => addLog('OK', m), [addLog]);
  const logErr = useCallback((m) => addLog('ERROR', m), [addLog]);
  const logApi = useCallback((m, s) => addLog('API', m, s), [addLog]);
  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, logEndRef, logStep, logOk, logErr, logApi, clearLogs };
}

/**
 * Shared POC page styles.
 */
export const S = {
  page: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
    fontFamily: "'Segoe UI', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif",
    padding: '24px', color: '#1a202c',
  },
  title: {
    fontSize: '24px', fontWeight: 700, color: '#2d3748', marginBottom: '20px',
    borderBottom: '3px solid #4299e1', paddingBottom: '8px',
  },
  panel: {
    background: '#fff', borderRadius: '12px', padding: '20px',
    boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
    marginBottom: '20px',
  },
  panelTitle: {
    fontSize: '16px', fontWeight: 700, color: '#2b6cb0', marginBottom: '16px',
    paddingBottom: '8px', borderBottom: '2px solid #bee3f8',
  },
  formGroup: { marginBottom: '16px' },
  label: { display: 'block', fontSize: '13px', fontWeight: 600, color: '#4a5568', marginBottom: '6px' },
  input: {
    width: '100%', padding: '10px 12px', fontSize: '14px', border: '2px solid #e2e8f0',
    borderRadius: '8px', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  },
  inputSmall: {
    padding: '6px 10px', fontSize: '13px', border: '2px solid #e2e8f0',
    borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace", width: '200px',
  },
  btn: (color) => ({
    padding: '10px 24px', fontSize: '14px', fontWeight: 600, border: 'none', borderRadius: '8px',
    cursor: 'pointer', color: '#fff', background: color || '#4299e1',
  }),
  btnSmall: (color) => ({
    padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: 'none', borderRadius: '6px',
    cursor: 'pointer', color: '#fff', background: color || '#4299e1', marginRight: '8px',
  }),
  btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
  errorBox: {
    background: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', padding: '12px',
    color: '#c53030', fontSize: '13px', marginTop: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
  },
  resultBox: {
    background: '#f0fff4', border: '1px solid #68d391', borderRadius: '8px', padding: '12px',
    color: '#22543d', fontSize: '13px', marginTop: '12px', whiteSpace: 'pre-wrap',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  },
  statusLabel: (connected) => ({
    display: 'inline-block', padding: '4px 12px', borderRadius: '12px', fontSize: '12px', fontWeight: 600,
    marginLeft: '12px',
    background: connected ? '#c6f6d5' : '#fed7d7',
    color: connected ? '#22543d' : '#c53030',
    border: `1px solid ${connected ? '#68d391' : '#fc8181'}`,
  }),
  // Log panel — terminal dark style
  logSection: {
    background: '#0a0f14', borderRadius: '12px', padding: '16px',
    border: '1px solid #1e3a2a',
  },
  logTitle: {
    fontSize: '14px', fontWeight: 700, color: '#3eff8b', marginBottom: '8px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logBox: {
    background: '#0c0f14', borderRadius: '8px', padding: '12px', maxHeight: '400px',
    overflowY: 'auto', fontSize: '11px', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    lineHeight: '16px', border: '1px solid #1a2a1a',
  },
  logEntry: (type) => ({
    color: { STEP: '#63b3ed', OK: '#3eff8b', ERROR: '#ff6b6b', API: '#b794f4', SCREEN: '#3a5a4a' }[type] || '#6a8a7a',
  }),
  logTs: { color: '#3a5a4a', marginRight: '6px' },
  logType: (type) => ({
    color: type === 'ERROR' ? '#ff6b6b' : '#2a4a3a', marginRight: '6px', fontWeight: 700, fontSize: '10px',
  }),
  clearBtn: {
    fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
    background: '#1a2a1a', border: '1px solid #2a4a2a', borderRadius: '4px', color: '#3eff8b',
  },
  spinner: {
    display: 'inline-block', width: '14px', height: '14px',
    border: '2px solid #bee3f8', borderTop: '2px solid #4299e1',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    marginRight: '8px', verticalAlign: 'middle',
  },
  row: { display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap' },
};

/**
 * Shared Log Panel component.
 */
export function LogPanel({ logs, logEndRef, clearLogs }) {
  return (
    <div style={S.logSection}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.logTitle}>
        <span>Operation Log</span>
        <button style={S.clearBtn} onClick={clearLogs}>Clear</button>
      </div>
      <div style={S.logBox}>
        {logs.length === 0 && (
          <div style={{ color: '#3a5a4a', fontStyle: 'italic' }}>No log entries yet.</div>
        )}
        {logs.map((entry, i) => (
          <div key={i} style={S.logEntry(entry.type)}>
            <span style={S.logTs}>[{entry.ts}]</span>
            <span style={S.logType(entry.type)}>{entry.type.padEnd(6)}</span>
            <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{entry.message}</span>
          </div>
        ))}
        <div ref={logEndRef} />
      </div>
    </div>
  );
}
