import React, { useState, useRef, useCallback } from 'react';
import API_BASE, { POC_CONFIG } from '../config';

/**
 * POC Automation Page
 *
 * Left panel: "Uketsuke" (受付) — automated login and order lookup
 * Right panel: "Tehai Kido" (手配起動) — placeholder for future
 *
 * Each step validates the 3270 screen response before proceeding.
 * All operations and screen results are logged in a visible log panel.
 */

// ============================================
//  HELPERS
// ============================================

/** Extract substring from screen line (1-based row/col, inclusive) */
function screenText(lines, row, startCol, length) {
  if (!lines || row < 1 || row > lines.length) return '';
  const line = lines[row - 1] || '';
  return line.substring(startCol - 1, startCol - 1 + length);
}

/** Wait for specified milliseconds */
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default function PocPage() {
  // --- State ---
  const [sessionId, setSessionId] = useState(null);
  const [settsuNo, setSettsuNo] = useState('');
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [result27, setResult27] = useState('');
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);

  const DELAY = POC_CONFIG.operationDelay;

  // --- Logging ---
  const addLog = useCallback((type, message, screenData) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => {
      const newLogs = [...prev, { ts, type, message }];
      // Log screen data as separate entry if provided
      if (screenData) {
        const screenStr = Array.isArray(screenData)
          ? screenData.map((l, i) => `  ${String(i + 1).padStart(2, '0')}| ${l}`).join('\n')
          : JSON.stringify(screenData, null, 2);
        newLogs.push({ ts, type: 'SCREEN', message: screenStr });
      }
      return newLogs;
    });
    // Auto-scroll
    setTimeout(() => {
      if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const logStep = useCallback((msg, screen) => addLog('STEP', msg, screen), [addLog]);
  const logOk = useCallback((msg) => addLog('OK', msg), [addLog]);
  const logErr = useCallback((msg) => addLog('ERROR', msg), [addLog]);
  const logApi = useCallback((msg, screen) => addLog('API', msg, screen), [addLog]);

  // --- API call ---
  const apiCall = async (method, path, body, sid) => {
    const headers = { 'Content-Type': 'application/json' };
    if (sid) headers['X-Session-Id'] = sid;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    return await res.json();
  };

  // --- Extract screen lines from API response ---
  const getLines = (json) => json?.data?.screenLines || [];

  // ============================================
  //  UKETSUKE AUTOMATION
  // ============================================
  const runUketsuke = async () => {
    setRunning(true);
    setError(null);
    setResult27('');

    try {
      // ========== STEP A: Connect ==========
      logStep('Step A: Connecting to 3270...');
      let json, lines, sid;

      for (let attempt = 1; attempt <= POC_CONFIG.connectRetries; attempt++) {
        json = await apiCall('POST', '/connect');
        lines = getLines(json);
        sid = json.sessionId;
        logApi(`Connect attempt ${attempt}`, lines);

        if (json.success) {
          const check = screenText(lines, 7, 2, 6);
          if (check === 'USERID') {
            logOk(`Connect OK. Found "USERID" at row 7. Session: ${sid}`);
            setSessionId(sid);
            break;
          } else {
            logErr(`Attempt ${attempt}: Expected "USERID" at row7:col2-7, got "${check}"`);
            if (attempt === POC_CONFIG.connectRetries) {
              throw new Error(`Connect failed after ${POC_CONFIG.connectRetries} attempts. Row 7 content: "${check}"`);
            }
            await delay(2000);
          }
        } else {
          logErr(`Connect attempt ${attempt} failed: ${json.message}`);
          if (attempt === POC_CONFIG.connectRetries) {
            throw new Error(`Connect failed: ${json.message}`);
          }
          await delay(2000);
        }
      }

      // ========== STEP B: Login (username + enter) ==========
      logStep('Step B: Entering username...');

      // Write username at row 7 col 10
      logStep(`Writing username "${POC_CONFIG.username}" at row:7, col:10`);
      await delay(DELAY);
      json = await apiCall('POST', '/menu/command', {
        row: 7, column: 10, command: POC_CONFIG.username
      }, sid);
      lines = getLines(json);
      logApi('Write username at row 7', lines);

      await delay(DELAY);

      // Write username again at row 9 col 12 (password field uses same value per spec)
      logStep(`Writing username "${POC_CONFIG.username}" at row:9, col:12`);
      json = await apiCall('POST', '/menu/command', {
        row: 9, column: 12, command: POC_CONFIG.username
      }, sid);
      lines = getLines(json);
      logApi('Write username at row 9', lines);

      await delay(DELAY);

      // Press Enter
      logStep('Pressing Enter...');
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter result', lines);

      // ========== STEP C: Verify login, enter ANEMS ==========
      logStep('Step C: Verifying login and entering ANEMS...');

      const userCheck = screenText(lines, 7, 23, 8).trim();
      if (userCheck !== POC_CONFIG.username) {
        throw new Error(`Login verification failed. Expected "${POC_CONFIG.username}" at row7:col23-30, got "${userCheck}"`);
      }
      logOk(`Login verified. User "${userCheck}" confirmed.`);

      // Write "ANEMS" at row 1 col 2
      logStep('Writing "ANEMS" at row:1, col:2');
      await delay(DELAY);
      json = await apiCall('POST', '/menu/command', {
        row: 1, column: 2, command: 'ANEMS'
      }, sid);
      lines = getLines(json);
      logApi('Write ANEMS', lines);

      await delay(DELAY);

      // Press Enter
      logStep('Pressing Enter...');
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after ANEMS', lines);

      // ========== STEP D: Verify ANEMS(DESIGN), press F11 ==========
      logStep('Step D: Checking ANEMS(DESIGN)...');

      const anems = screenText(lines, 5, 44, 14).trim();
      if (anems !== 'ANEMS(DESIGN)') {
        throw new Error(`Expected "ANEMS(DESIGN)" at row5:col44-58, got "${anems}"`);
      }
      logOk('ANEMS(DESIGN) screen confirmed.');

      logStep('Pressing F11...');
      await delay(DELAY);
      json = await apiCall('POST', '/key/function', { keyName: 'PF11' }, sid);
      lines = getLines(json);
      logApi('F11 result', lines);

      // ========== STEP E: Password entry ==========
      logStep('Step E: Entering password...');

      const pwLabel = screenText(lines, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') {
        throw new Error(`Expected "PASSWORD" at row10:col21-28, got "${pwLabel}"`);
      }
      logOk('PASSWORD prompt found.');

      // Write password at row 10 col 32
      logStep(`Writing password at row:10, col:32`);
      await delay(DELAY);
      json = await apiCall('POST', '/menu/command', {
        row: 10, column: 32, command: POC_CONFIG.password
      }, sid);
      lines = getLines(json);
      logApi('Write password', lines);

      await delay(DELAY);

      // Write "U1" at row 10 col 62
      logStep('Writing "U1" at row:10, col:62');
      json = await apiCall('POST', '/menu/command', {
        row: 10, column: 62, command: 'U1'
      }, sid);
      lines = getLines(json);
      logApi('Write U1', lines);

      await delay(DELAY);

      // Press Enter
      logStep('Pressing Enter...');
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after password', lines);

      // ========== STEP F: Verify TC01 ==========
      logStep('Step F: Checking TC01...');

      const tc01 = screenText(lines, 1, 5, 4);
      if (tc01 !== 'TC01') {
        throw new Error(`Expected "TC01" at row1:col5-8, got "${tc01}"`);
      }
      logOk('TC01 screen confirmed.');

      // ========== STEP G: Enter settsu no ==========
      logStep('Step G: Entering settsu No...');

      if (!settsuNo || !settsuNo.includes('-')) {
        throw new Error(`Invalid settsu No format: "${settsuNo}". Expected format: "XXXXXX-YYYYYY"`);
      }

      const parts = settsuNo.split('-');
      const leftPart = parts[0];
      const rightPart = parts[1];

      logStep(`Writing left part "${leftPart}" at row:14, col:64`);
      await delay(DELAY);
      json = await apiCall('POST', '/menu/command', {
        row: 14, column: 64, command: leftPart
      }, sid);
      lines = getLines(json);
      logApi('Write left part', lines);

      await delay(DELAY);

      logStep(`Writing right part "${rightPart}" at row:14, col:71`);
      json = await apiCall('POST', '/menu/command', {
        row: 14, column: 71, command: rightPart
      }, sid);
      lines = getLines(json);
      logApi('Write right part', lines);

      await delay(DELAY);

      // Press Enter
      logStep('Pressing Enter...');
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after settsu No', lines);

      // ========== STEP H: Get row 27 result ==========
      logStep('Step H: Reading result from row 27...');

      const row27 = lines.length >= 27 ? lines[26] : '';
      setResult27(row27);
      logOk(`Row 27 result: "${row27.trim()}"`);

      // ========== STEP I: Press F2 four times ==========
      logStep('Step I: Pressing F2 x4 to return...');
      for (let i = 1; i <= 4; i++) {
        await delay(DELAY);
        logStep(`F2 press ${i}/4...`);
        json = await apiCall('POST', '/key/function', { keyName: 'PF2' }, sid);
        lines = getLines(json);
        logApi(`F2 #${i} result`, lines);
      }

      logOk('Uketsuke complete!');

    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ============================================
  //  STYLES
  // ============================================
  const styles = {
    page: {
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #f0f4f8 0%, #e2e8f0 100%)',
      fontFamily: "'Segoe UI', 'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif",
      padding: '24px',
      color: '#1a202c',
    },
    title: {
      fontSize: '24px',
      fontWeight: 700,
      color: '#2d3748',
      marginBottom: '20px',
      borderBottom: '3px solid #4299e1',
      paddingBottom: '8px',
    },
    panels: {
      display: 'flex',
      gap: '24px',
      marginBottom: '20px',
    },
    panel: {
      flex: 1,
      background: '#fff',
      borderRadius: '12px',
      padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0',
    },
    panelTitle: {
      fontSize: '16px',
      fontWeight: 700,
      color: '#2b6cb0',
      marginBottom: '16px',
      paddingBottom: '8px',
      borderBottom: '2px solid #bee3f8',
    },
    formGroup: {
      marginBottom: '16px',
    },
    label: {
      display: 'block',
      fontSize: '13px',
      fontWeight: 600,
      color: '#4a5568',
      marginBottom: '6px',
    },
    input: {
      width: '100%',
      padding: '10px 12px',
      fontSize: '14px',
      border: '2px solid #e2e8f0',
      borderRadius: '8px',
      outline: 'none',
      transition: 'border-color 0.2s',
      boxSizing: 'border-box',
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    },
    btn: (color) => ({
      padding: '10px 24px',
      fontSize: '14px',
      fontWeight: 600,
      border: 'none',
      borderRadius: '8px',
      cursor: 'pointer',
      color: '#fff',
      background: color || '#4299e1',
      transition: 'opacity 0.2s',
      width: '100%',
    }),
    btnDisabled: {
      opacity: 0.5,
      cursor: 'not-allowed',
    },
    errorBox: {
      background: '#fff5f5',
      border: '1px solid #fc8181',
      borderRadius: '8px',
      padding: '12px',
      color: '#c53030',
      fontSize: '13px',
      marginBottom: '12px',
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-all',
    },
    resultBox: {
      background: '#f0fff4',
      border: '1px solid #68d391',
      borderRadius: '8px',
      padding: '12px',
      color: '#22543d',
      fontSize: '13px',
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      marginBottom: '12px',
      whiteSpace: 'pre-wrap',
    },
    logSection: {
      background: '#fff',
      borderRadius: '12px',
      padding: '16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)',
      border: '1px solid #e2e8f0',
    },
    logTitle: {
      fontSize: '14px',
      fontWeight: 700,
      color: '#4a5568',
      marginBottom: '8px',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    logBox: {
      background: '#1a202c',
      borderRadius: '8px',
      padding: '12px',
      maxHeight: '400px',
      overflowY: 'auto',
      fontSize: '11px',
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      lineHeight: '16px',
    },
    logEntry: (type) => {
      const colors = {
        STEP: '#63b3ed',
        OK: '#68d391',
        ERROR: '#fc8181',
        API: '#b794f4',
        SCREEN: '#4a5568',
      };
      return { color: colors[type] || '#a0aec0' };
    },
    logTs: { color: '#4a5568', marginRight: '6px' },
    logType: (type) => ({
      color: type === 'ERROR' ? '#fc8181' : '#718096',
      marginRight: '6px', fontWeight: 700, fontSize: '10px',
    }),
    clearBtn: {
      fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
      background: '#edf2f7', border: '1px solid #cbd5e0', borderRadius: '4px', color: '#4a5568',
    },
    placeholder: {
      color: '#a0aec0',
      fontSize: '14px',
      textAlign: 'center',
      padding: '40px 20px',
    },
    spinner: {
      display: 'inline-block',
      width: '14px',
      height: '14px',
      border: '2px solid #bee3f8',
      borderTop: '2px solid #4299e1',
      borderRadius: '50%',
      animation: 'spin 0.8s linear infinite',
      marginRight: '8px',
      verticalAlign: 'middle',
    },
  };

  // ============================================
  //  RENDER
  // ============================================
  return (
    <div style={styles.page}>
      {/* CSS animation for spinner */}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={styles.title}>POC - 3270 Automation</div>

      {/* Two-panel layout */}
      <div style={styles.panels}>
        {/* LEFT PANEL: Uketsuke */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>受付 (Uketsuke)</div>

          <div style={styles.formGroup}>
            <label style={styles.label}>設通No.</label>
            <input
              style={styles.input}
              value={settsuNo}
              onChange={(e) => setSettsuNo(e.target.value)}
              placeholder="ex: QL6140-00075"
              disabled={running}
            />
          </div>

          <button
            style={{
              ...styles.btn('#3182ce'),
              ...(running || !settsuNo ? styles.btnDisabled : {}),
            }}
            onClick={runUketsuke}
            disabled={running || !settsuNo}
          >
            {running ? (
              <span><span style={styles.spinner} /> Processing...</span>
            ) : (
              '受付'
            )}
          </button>

          {/* Error display (persistent) */}
          {error && (
            <div style={{ ...styles.errorBox, marginTop: '16px' }}>
              <strong>Error:</strong> {error}
            </div>
          )}

          {/* Result display */}
          {result27 && (
            <div style={{ ...styles.resultBox, marginTop: '16px' }}>
              <strong>Row 27 Result:</strong>
              <div style={{ marginTop: '4px' }}>{result27}</div>
            </div>
          )}
        </div>

        {/* RIGHT PANEL: Tehai Kido (placeholder) */}
        <div style={styles.panel}>
          <div style={styles.panelTitle}>手配起動 (Tehai Kido)</div>
          <div style={styles.placeholder}>
            Coming soon...
          </div>
        </div>
      </div>

      {/* LOG PANEL */}
      <div style={styles.logSection}>
        <div style={styles.logTitle}>
          <span>Operation Log</span>
          <button style={styles.clearBtn} onClick={() => setLogs([])}>Clear</button>
        </div>
        <div style={styles.logBox}>
          {logs.length === 0 && (
            <div style={{ color: '#4a5568', fontStyle: 'italic' }}>
              Enter a settsu No and click the button to start.
            </div>
          )}
          {logs.map((entry, i) => (
            <div key={i} style={styles.logEntry(entry.type)}>
              <span style={styles.logTs}>[{entry.ts}]</span>
              <span style={styles.logType(entry.type)}>{entry.type.padEnd(6)}</span>
              <span style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                {entry.message}
              </span>
            </div>
          ))}
          <div ref={logEndRef} />
        </div>
      </div>
    </div>
  );
}
