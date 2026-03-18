import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import API_BASE, { POC_CONFIG } from '../config';

/**
 * POC Automation Page
 *
 * Left panel:  "Uketsuke"    (受付)     — automated login + order lookup
 * Right panel: "Tehai Kido"  (手配起動) — automated login + order edit screen
 *
 * Both panels share the same log panel at the bottom.
 * Each panel has its own 3270 session (independent connections).
 *
 * Tehai Kido step H opens an inline edit view matching the TB03 screen layout.
 */

// ============================================
//  SHARED HELPERS
// ============================================

function screenText(lines, row, startCol, length) {
  if (!lines || row < 1 || row > lines.length) return '';
  const line = lines[row - 1] || '';
  return line.substring(startCol - 1, startCol - 1 + length);
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function extract(line, startCol, endCol) {
  if (!line) return '';
  return line.substring(startCol - 1, endCol) || '';
}

function hasContent(str) {
  return str && str.trim().length > 0;
}

// ============================================
//  EDIT SCREEN CONSTANTS (TB03 layout)
// ============================================

const EDITABLE_FIELDS = [
  { id: 'a', startCol: 2,  endCol: 2  },
  { id: 'b', startCol: 4,  endCol: 4  },
  { id: 'g', startCol: 46, endCol: 49 },
  { id: 'h', startCol: 51, endCol: 54 },
  { id: 'i', startCol: 56, endCol: 56 },
  { id: 'j', startCol: 58, endCol: 67 },
  { id: 'k', startCol: 69, endCol: 70 },
  { id: 'l', startCol: 72, endCol: 75 },
  { id: 'm', startCol: 77, endCol: 78 },
  { id: 'n', startCol: 80, endCol: 83 },
];
const DATA_ROW_START = 6;
const DATA_ROW_END = 25;
const BLOCK_NO_ROW = 2;
const BLOCK_NO_START = 21;
const BLOCK_NO_END = 25;
const CHAR_W = 7.22;
const CHAR_H = 17;
const EDIT_FONT = '11.5px';

// ============================================
//  MAIN COMPONENT
// ============================================

export default function PocPage() {
  // --- Shared state ---
  const [logs, setLogs] = useState([]);
  const logEndRef = useRef(null);
  const DELAY_MS = POC_CONFIG.operationDelay;

  // --- Uketsuke state ---
  const [ukSettsuNo, setUkSettsuNo] = useState('');
  const [ukRunning, setUkRunning] = useState(false);
  const [ukError, setUkError] = useState(null);
  const [ukResult27, setUkResult27] = useState('');

  // --- Tehai state ---
  const [thSettsuNo, setThSettsuNo] = useState('');
  const [thRunning, setThRunning] = useState(false);
  const [thError, setThError] = useState(null);
  const [thSessionId, setThSessionId] = useState(null);
  const [thScreenLines, setThScreenLines] = useState(null);
  const [thShowEdit, setThShowEdit] = useState(false);

  // --- Edit screen state ---
  const [editBlockNo, setEditBlockNo] = useState('');
  const [editFields, setEditFields] = useState({});

  // Initialize edit fields from screen data
  useEffect(() => {
    if (!thScreenLines || thScreenLines.length === 0) return;
    setEditBlockNo(extract(thScreenLines[BLOCK_NO_ROW - 1], BLOCK_NO_START, BLOCK_NO_END).trim());
    const vals = {};
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      const line = thScreenLines[row - 1] || '';
      for (const f of EDITABLE_FIELDS) {
        vals[`${row}-${f.id}`] = extract(line, f.startCol, f.endCol);
      }
    }
    setEditFields(vals);
  }, [thScreenLines]);

  const editActiveRows = useMemo(() => {
    const result = {};
    if (!thScreenLines) return result;
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      result[row] = hasContent(extract(thScreenLines[row - 1] || '', 11, 25));
    }
    return result;
  }, [thScreenLines]);

  const updateEditField = (row, fieldId, value) => {
    setEditFields(prev => ({ ...prev, [`${row}-${fieldId}`]: value }));
  };

  // --- Logging ---
  const addLog = useCallback((type, message, screenData) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => {
      const newLogs = [...prev, { ts, type, message }];
      if (screenData) {
        const screenStr = Array.isArray(screenData)
          ? screenData.map((l, i) => `  ${String(i + 1).padStart(2, '0')}| ${l}`).join('\n')
          : JSON.stringify(screenData, null, 2);
        newLogs.push({ ts, type: 'SCREEN', message: screenStr });
      }
      return newLogs;
    });
    setTimeout(() => {
      if (logEndRef.current) logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }, 50);
  }, []);

  const logStep = useCallback((m, s) => addLog('STEP', m, s), [addLog]);
  const logOk = useCallback((m) => addLog('OK', m), [addLog]);
  const logErr = useCallback((m) => addLog('ERROR', m), [addLog]);
  const logApi = useCallback((m, s) => addLog('API', m, s), [addLog]);

  // --- API ---
  const apiCall = async (method, path, body, sid) => {
    const headers = { 'Content-Type': 'application/json' };
    if (sid) headers['X-Session-Id'] = sid;
    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);
    const res = await fetch(`${API_BASE}${path}`, opts);
    return await res.json();
  };
  const getLines = (json) => json?.data?.screenLines || [];

  // ============================================
  //  SHARED LOGIN STEPS A-D
  // ============================================
  const runLoginSteps = async (label) => {
    // Step A: Connect
    logStep(`[${label}] Step A: Connecting...`);
    let json, lines, sid;
    for (let attempt = 1; attempt <= POC_CONFIG.connectRetries; attempt++) {
      json = await apiCall('POST', '/connect');
      lines = getLines(json);
      sid = json.sessionId;
      logApi(`Connect attempt ${attempt}`, lines);
      if (json.success && screenText(lines, 7, 2, 6) === 'USERID') {
        logOk(`Connected. Session: ${sid}`);
        break;
      }
      if (attempt === POC_CONFIG.connectRetries) {
        throw new Error(`Connect failed. Row7: "${screenText(lines, 7, 2, 6)}"`);
      }
      await delay(2000);
    }

    // Step B: Username + Enter
    logStep(`[${label}] Step B: Login...`);
    await delay(DELAY_MS);
    json = await apiCall('POST', '/menu/command', { row: 7, column: 10, command: POC_CONFIG.username }, sid);
    logApi('Write username row7', getLines(json));
    await delay(DELAY_MS);
    json = await apiCall('POST', '/menu/command', { row: 9, column: 12, command: POC_CONFIG.username }, sid);
    logApi('Write username row9', getLines(json));
    await delay(DELAY_MS);
    json = await apiCall('POST', '/key/enter', null, sid);
    lines = getLines(json);
    logApi('Enter', lines);

    // Step C: Verify + ANEMS
    logStep(`[${label}] Step C: Verify login, enter ANEMS...`);
    const userCheck = screenText(lines, 7, 23, 8).trim();
    if (userCheck !== POC_CONFIG.username) {
      throw new Error(`Login verify failed. Expected "${POC_CONFIG.username}", got "${userCheck}"`);
    }
    logOk(`User "${userCheck}" confirmed.`);
    await delay(DELAY_MS);
    json = await apiCall('POST', '/menu/command', { row: 1, column: 2, command: 'ANEMS' }, sid);
    logApi('Write ANEMS', getLines(json));
    await delay(DELAY_MS);
    json = await apiCall('POST', '/key/enter', null, sid);
    lines = getLines(json);
    logApi('Enter after ANEMS', lines);

    // Step D: ANEMS(DESIGN) + F11
    logStep(`[${label}] Step D: ANEMS(DESIGN) check...`);
    const anems = screenText(lines, 5, 44, 14).trim();
    if (anems !== 'ANEMS(DESIGN)') {
      throw new Error(`Expected "ANEMS(DESIGN)" at row5, got "${anems}"`);
    }
    logOk('ANEMS(DESIGN) confirmed.');
    await delay(DELAY_MS);
    json = await apiCall('POST', '/key/function', { keyName: 'PF11' }, sid);
    lines = getLines(json);
    logApi('F11', lines);

    return { sid, lines };
  };

  // ============================================
  //  UKETSUKE (Left panel)
  // ============================================
  const runUketsuke = async () => {
    setUkRunning(true);
    setUkError(null);
    setUkResult27('');
    try {
      const { sid, lines: linesD } = await runLoginSteps('Uketsuke');

      // Step E: Password (U1)
      logStep('[Uketsuke] Step E: Password...');
      const pwLabel = screenText(linesD, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') throw new Error(`Expected "PASSWORD", got "${pwLabel}"`);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 10, column: 32, command: POC_CONFIG.password }, sid);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 10, column: 62, command: 'U1' }, sid);
      await delay(DELAY_MS);
      let json = await apiCall('POST', '/key/enter', null, sid);
      let lines = getLines(json);
      logApi('Enter after password', lines);

      // Step F: TC01
      logStep('[Uketsuke] Step F: TC01 check...');
      if (screenText(lines, 1, 5, 4) !== 'TC01') {
        throw new Error(`Expected "TC01", got "${screenText(lines, 1, 5, 4)}"`);
      }
      logOk('TC01 confirmed.');

      // Step G: Settsu No
      logStep('[Uketsuke] Step G: Settsu No...');
      if (!ukSettsuNo.includes('-')) throw new Error(`Invalid format: "${ukSettsuNo}"`);
      const [left, right] = ukSettsuNo.split('-');
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 14, column: 64, command: left }, sid);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 14, column: 71, command: right }, sid);
      await delay(DELAY_MS);
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after settsu', lines);

      // Step H: Row 27
      const row27 = lines.length >= 27 ? lines[26] : '';
      setUkResult27(row27);
      logOk(`Row 27: "${row27.trim()}"`);

      // Step I: F2 x4
      logStep('[Uketsuke] F2 x4...');
      for (let i = 1; i <= 4; i++) {
        await delay(DELAY_MS);
        json = await apiCall('POST', '/key/function', { keyName: 'PF2' }, sid);
        logApi(`F2 #${i}`, getLines(json));
      }
      logOk('Uketsuke complete!');
    } catch (e) {
      logErr(e.message);
      setUkError(e.message);
    } finally {
      setUkRunning(false);
    }
  };

  // ============================================
  //  TEHAI KIDO (Right panel)
  // ============================================
  const runTehaiKido = async () => {
    setThRunning(true);
    setThError(null);
    setThShowEdit(false);
    setThScreenLines(null);
    try {
      const { sid, lines: linesD } = await runLoginSteps('TehaiKido');
      setThSessionId(sid);

      // Step E: Password (T1 — different from Uketsuke)
      logStep('[TehaiKido] Step E: Password (T1)...');
      const pwLabel = screenText(linesD, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') throw new Error(`Expected "PASSWORD", got "${pwLabel}"`);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 10, column: 32, command: POC_CONFIG.password }, sid);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 10, column: 62, command: 'T1' }, sid);
      await delay(DELAY_MS);
      let json = await apiCall('POST', '/key/enter', null, sid);
      let lines = getLines(json);
      logApi('Enter after password', lines);

      // Step F: TB01 check
      logStep('[TehaiKido] Step F: TB01 check...');
      if (screenText(lines, 1, 5, 4) !== 'TB01') {
        throw new Error(`Expected "TB01" at row1:5-8, got "${screenText(lines, 1, 5, 4)}"`);
      }
      logOk('TB01 confirmed.');

      // Step G: Settsu No
      logStep('[TehaiKido] Step G: Settsu No...');
      if (!thSettsuNo.includes('-')) throw new Error(`Invalid format: "${thSettsuNo}"`);
      const [left, right] = thSettsuNo.split('-');
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 14, column: 64, command: left }, sid);
      await delay(DELAY_MS);
      await apiCall('POST', '/menu/command', { row: 14, column: 71, command: right }, sid);
      await delay(DELAY_MS);
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after settsu', lines);

      // Step H: Show edit screen
      logStep('[TehaiKido] Step H: Loading edit screen...');
      setThScreenLines(lines);
      setThShowEdit(true);
      logOk('Edit screen loaded. Row 27: "' + (lines.length >= 27 ? lines[26].trim() : '') + '"');

    } catch (e) {
      logErr(e.message);
      setThError(e.message);
    } finally {
      setThRunning(false);
    }
  };

  // ============================================
  //  STYLES
  // ============================================
  const S = {
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
    panels: { display: 'flex', gap: '24px', marginBottom: '20px' },
    panel: {
      flex: 1, background: '#fff', borderRadius: '12px', padding: '20px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
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
    btn: (color) => ({
      padding: '10px 24px', fontSize: '14px', fontWeight: 600, border: 'none', borderRadius: '8px',
      cursor: 'pointer', color: '#fff', background: color || '#4299e1', width: '100%',
    }),
    btnDisabled: { opacity: 0.5, cursor: 'not-allowed' },
    errorBox: {
      background: '#fff5f5', border: '1px solid #fc8181', borderRadius: '8px', padding: '12px',
      color: '#c53030', fontSize: '13px', marginTop: '16px', whiteSpace: 'pre-wrap', wordBreak: 'break-all',
    },
    resultBox: {
      background: '#f0fff4', border: '1px solid #68d391', borderRadius: '8px', padding: '12px',
      color: '#22543d', fontSize: '13px', marginTop: '16px', whiteSpace: 'pre-wrap',
      fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    },
    logSection: {
      background: '#fff', borderRadius: '12px', padding: '16px',
      boxShadow: '0 2px 12px rgba(0,0,0,0.08)', border: '1px solid #e2e8f0',
    },
    logTitle: {
      fontSize: '14px', fontWeight: 700, color: '#4a5568', marginBottom: '8px',
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    },
    logBox: {
      background: '#1a202c', borderRadius: '8px', padding: '12px', maxHeight: '400px',
      overflowY: 'auto', fontSize: '11px', fontFamily: "'JetBrains Mono', 'Consolas', monospace",
      lineHeight: '16px',
    },
    logEntry: (type) => ({
      color: { STEP: '#63b3ed', OK: '#68d391', ERROR: '#fc8181', API: '#b794f4', SCREEN: '#4a5568' }[type] || '#a0aec0',
    }),
    logTs: { color: '#4a5568', marginRight: '6px' },
    logType: (type) => ({
      color: type === 'ERROR' ? '#fc8181' : '#718096', marginRight: '6px', fontWeight: 700, fontSize: '10px',
    }),
    clearBtn: {
      fontSize: '11px', padding: '2px 8px', cursor: 'pointer',
      background: '#edf2f7', border: '1px solid #cbd5e0', borderRadius: '4px', color: '#4a5568',
    },
    spinner: {
      display: 'inline-block', width: '14px', height: '14px',
      border: '2px solid #bee3f8', borderTop: '2px solid #4299e1',
      borderRadius: '50%', animation: 'spin 0.8s linear infinite',
      marginRight: '8px', verticalAlign: 'middle',
    },
    // Edit screen styles (POC theme, not terminal dark theme)
    editWrap: {
      background: '#f7fafc', border: '2px solid #4299e1', borderRadius: '12px',
      padding: '16px', marginTop: '16px', overflowX: 'auto',
    },
    editTitle: {
      fontSize: '13px', fontWeight: 700, color: '#2b6cb0', marginBottom: '8px',
    },
    editRow: (dimmed) => ({
      position: 'relative', height: `${CHAR_H}px`, lineHeight: `${CHAR_H}px`,
      whiteSpace: 'pre', fontSize: EDIT_FONT, display: 'flex',
      opacity: dimmed ? 0.3 : 1,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
    }),
    editLineNum: {
      color: '#a0aec0', userSelect: 'none', width: '28px', textAlign: 'right',
      paddingRight: '6px', fontSize: '10px', flexShrink: 0, lineHeight: `${CHAR_H}px`,
    },
    editLineText: {
      color: '#2d3748', whiteSpace: 'pre', fontSize: EDIT_FONT, position: 'relative',
      letterSpacing: '0px', lineHeight: `${CHAR_H}px`,
    },
    editOverlay: (startCol, charCount) => ({
      position: 'absolute', left: `${(startCol - 1) * CHAR_W}px`,
      width: `${charCount * CHAR_W}px`, top: '0px', height: `${CHAR_H}px`,
      fontSize: EDIT_FONT, fontFamily: 'inherit', color: '#c53030',
      background: '#fed7d7', border: 'none', borderBottom: '2px solid #fc8181',
      outline: 'none', padding: '0', margin: '0', lineHeight: `${CHAR_H}px`,
      letterSpacing: '0px', boxSizing: 'border-box',
    }),
    editBlockOverlay: {
      position: 'absolute', left: `${(BLOCK_NO_START - 1) * CHAR_W}px`,
      width: `${(BLOCK_NO_END - BLOCK_NO_START + 1) * CHAR_W}px`,
      top: '0px', height: `${CHAR_H}px`, fontSize: EDIT_FONT, fontFamily: 'inherit',
      color: '#c53030', background: '#fed7d7', border: 'none',
      borderBottom: '2px solid #dd6b20', outline: 'none', padding: '0', margin: '0',
      lineHeight: `${CHAR_H}px`, letterSpacing: '0px', boxSizing: 'border-box',
    },
    editBackBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: '1px solid #cbd5e0',
      borderRadius: '6px', background: '#edf2f7', color: '#4a5568', cursor: 'pointer',
      marginRight: '8px',
    },
    editSaveBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: 'none',
      borderRadius: '6px', background: '#48bb78', color: '#fff', cursor: 'pointer',
    },
  };

  // ============================================
  //  RENDER: Edit Screen (inline in right panel)
  // ============================================
  const renderEditScreen = () => {
    if (!thScreenLines) return null;

    return (
      <div style={S.editWrap}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <div style={S.editTitle}>Edit Mode - TB03 Parts Order</div>
          <div>
            <button style={S.editBackBtn} onClick={() => setThShowEdit(false)}>Close Edit</button>
            <button style={S.editSaveBtn} onClick={() => {
              const data = { blockNo: editBlockNo, fields: editFields };
              console.log('Tehai save data:', data);
              alert('Save data logged to console.');
            }}>Save</button>
          </div>
        </div>
        <div style={{ overflowX: 'auto' }}>
          {thScreenLines.map((line, idx) => {
            const rowNum = idx + 1;
            const isDataRow = rowNum >= DATA_ROW_START && rowNum <= DATA_ROW_END;
            const isActive = isDataRow && editActiveRows[rowNum];
            const isDimmed = isDataRow && !isActive;

            return (
              <div key={idx} style={S.editRow(isDimmed)}>
                <span style={S.editLineNum}>{String(rowNum).padStart(2, '0')}</span>
                <span style={S.editLineText}>
                  {line || ''}
                  {rowNum === BLOCK_NO_ROW && (
                    <input
                      style={S.editBlockOverlay}
                      value={editBlockNo}
                      onChange={(e) => setEditBlockNo(e.target.value)}
                      maxLength={BLOCK_NO_END - BLOCK_NO_START + 1}
                    />
                  )}
                  {isActive && EDITABLE_FIELDS.map((f) => {
                    const key = `${rowNum}-${f.id}`;
                    const charCount = f.endCol - f.startCol + 1;
                    return (
                      <input
                        key={f.id}
                        style={S.editOverlay(f.startCol, charCount)}
                        value={editFields[key] || ''}
                        onChange={(e) => updateEditField(rowNum, f.id, e.target.value)}
                        maxLength={charCount}
                      />
                    );
                  })}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  // ============================================
  //  RENDER
  // ============================================
  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <div style={S.title}>POC - 3270 Automation</div>

      <div style={S.panels}>
        {/* ===== LEFT: Uketsuke ===== */}
        <div style={S.panel}>
          <div style={S.panelTitle}>受付 (Uketsuke)</div>
          <div style={S.formGroup}>
            <label style={S.label}>設通No.</label>
            <input style={S.input} value={ukSettsuNo}
              onChange={(e) => setUkSettsuNo(e.target.value)}
              placeholder="ex: QL6140-00075" disabled={ukRunning} />
          </div>
          <button
            style={{ ...S.btn('#3182ce'), ...(ukRunning || !ukSettsuNo ? S.btnDisabled : {}) }}
            onClick={runUketsuke} disabled={ukRunning || !ukSettsuNo}
          >
            {ukRunning ? <span><span style={S.spinner} /> Processing...</span> : '受付'}
          </button>
          {ukError && <div style={S.errorBox}><strong>Error:</strong> {ukError}</div>}
          {ukResult27 && (
            <div style={S.resultBox}>
              <strong>Row 27 Result:</strong>
              <div style={{ marginTop: '4px' }}>{ukResult27}</div>
            </div>
          )}
        </div>

        {/* ===== RIGHT: Tehai Kido ===== */}
        <div style={S.panel}>
          <div style={S.panelTitle}>手配起動 (Tehai Kido)</div>
          <div style={S.formGroup}>
            <label style={S.label}>設通No.</label>
            <input style={S.input} value={thSettsuNo}
              onChange={(e) => setThSettsuNo(e.target.value)}
              placeholder="ex: QL6140-00075" disabled={thRunning} />
          </div>
          <button
            style={{ ...S.btn('#38a169'), ...(thRunning || !thSettsuNo ? S.btnDisabled : {}) }}
            onClick={runTehaiKido} disabled={thRunning || !thSettsuNo}
          >
            {thRunning ? <span><span style={S.spinner} /> Processing...</span> : '手配起動'}
          </button>
          {thError && <div style={S.errorBox}><strong>Error:</strong> {thError}</div>}

          {/* Inline edit screen */}
          {thShowEdit && renderEditScreen()}
        </div>
      </div>

      {/* ===== LOG PANEL ===== */}
      <div style={S.logSection}>
        <div style={S.logTitle}>
          <span>Operation Log</span>
          <button style={S.clearBtn} onClick={() => setLogs([])}>Clear</button>
        </div>
        <div style={S.logBox}>
          {logs.length === 0 && (
            <div style={{ color: '#4a5568', fontStyle: 'italic' }}>
              Enter a settsu No and click a button to start.
            </div>
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
    </div>
  );
}
