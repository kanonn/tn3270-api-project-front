import { useState, useRef, useCallback } from 'react';

/**
 * Shared log hook for POC pages.
 * Tracks both operation logs and latest ANEMS screen content.
 */
export function useLog() {
  const [logs, setLogs] = useState([]);
  const [anemsScreen, setAnemsScreen] = useState([]); // latest 3270 screen lines
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
    // Update ANEMS display with latest screen
    if (screenData && Array.isArray(screenData)) {
      setAnemsScreen(screenData);
    }
    setTimeout(() => {
      if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const logStep = useCallback((m, s) => addLog('STEP', m, s), [addLog]);
  const logOk = useCallback((m) => addLog('OK', m), [addLog]);
  const logErr = useCallback((m) => addLog('ERROR', m), [addLog]);
  const logApi = useCallback((m, s) => addLog('API', m, s), [addLog]);
  const clearLogs = useCallback(() => setLogs([]), []);

  return { logs, anemsScreen, logEndRef, logStep, logOk, logErr, logApi, clearLogs };
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
  label: { fontSize: '13px', fontWeight: 600, color: '#4a5568', marginBottom: '4px' },
  labelInline: { fontSize: '12px', fontWeight: 600, color: '#4a5568', marginRight: '4px' },
  input: {
    padding: '8px 10px', fontSize: '13px', border: '2px solid #e2e8f0',
    borderRadius: '6px', outline: 'none', boxSizing: 'border-box',
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  },
  menuLabel: {
    display: 'inline-flex', alignItems: 'center', gap: '4px',
    padding: '8px 12px', fontSize: '13px', fontWeight: 600,
    background: '#edf2f7', border: '2px solid #e2e8f0', borderRadius: '6px',
    color: '#2d3748', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  },
  btn: (color) => ({
    padding: '8px 20px', fontSize: '13px', fontWeight: 600, border: 'none', borderRadius: '6px',
    cursor: 'pointer', color: '#fff', background: color || '#4299e1', whiteSpace: 'nowrap',
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
    background: connected ? '#c6f6d5' : '#fed7d7',
    color: connected ? '#22543d' : '#c53030',
    border: `1px solid ${connected ? '#68d391' : '#fc8181'}`,
  }),
  row: {
    display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap',
  },
  spacer: { flex: 1 },
  spinner: {
    display: 'inline-block', width: '14px', height: '14px',
    border: '2px solid #bee3f8', borderTop: '2px solid #4299e1',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite',
    marginRight: '6px', verticalAlign: 'middle',
  },
  // ANEMS display panel (terminal dark)
  anemsSection: {
    background: '#0a0f14', borderRadius: '10px', padding: '14px',
    border: '1px solid #1e3a2a', marginBottom: '16px',
  },
  anemsTitle: {
    fontSize: '13px', fontWeight: 700, color: '#3eff8b', marginBottom: '8px',
    letterSpacing: '1px', textTransform: 'uppercase',
  },
  anemsBox: {
    background: '#0c0f14', borderRadius: '6px', padding: '10px',
    maxHeight: '500px', overflowY: 'auto', overflowX: 'auto',
    fontSize: '11.5px', fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    lineHeight: '17px', border: '1px solid #1a2a1a',
  },
  anemsLine: {
    color: '#33ff77', whiteSpace: 'pre', height: '17px', lineHeight: '17px',
    display: 'flex',
  },
  anemsLineNum: {
    color: '#3a5a4a', userSelect: 'none', width: '28px', textAlign: 'right',
    paddingRight: '6px', fontSize: '10px', flexShrink: 0,
  },
  // Log panel (lighter terminal style)
  logSection: {
    background: '#1a202c', borderRadius: '10px', padding: '14px',
    border: '1px solid #2d3748',
  },
  logTitle: {
    fontSize: '13px', fontWeight: 700, color: '#a0aec0', marginBottom: '8px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  logBox: {
    background: '#171923', borderRadius: '6px', padding: '10px', maxHeight: '300px',
    overflowY: 'auto', fontSize: '11px', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    lineHeight: '16px', border: '1px solid #2d3748',
  },
  logEntry: (type) => ({
    color: { STEP: '#63b3ed', OK: '#68d391', ERROR: '#fc8181', API: '#b794f4', SCREEN: '#4a5568' }[type] || '#718096',
  }),
  logTs: { color: '#4a5568', marginRight: '6px' },
  logType: (type) => ({
    color: type === 'ERROR' ? '#fc8181' : '#718096', marginRight: '6px', fontWeight: 700, fontSize: '10px',
  }),
  clearBtn: {
    fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
    background: '#2d3748', border: '1px solid #4a5568', borderRadius: '4px', color: '#a0aec0',
  },
};

/**
 * ANEMS Screen Display Panel (terminal dark style).
 */
export function AnemsDisplayPanel({ anemsScreen }) {
  return (
    <div style={S.anemsSection}>
      <div style={S.anemsTitle}>ANEMS Screen Display</div>
      <div style={S.anemsBox}>
        {(!anemsScreen || anemsScreen.length === 0) ? (
          <div style={{ color: '#3a5a4a', fontStyle: 'italic' }}>No screen data yet.</div>
        ) : (
          anemsScreen.map((line, i) => (
            <div key={i} style={S.anemsLine}>
              <span style={S.anemsLineNum}>{String(i + 1).padStart(2, '0')}</span>
              <span>{line}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

/**
 * Operation Log Panel.
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
          <div style={{ color: '#4a5568', fontStyle: 'italic' }}>No log entries yet.</div>
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
