import React, { useState, useRef, useEffect, useCallback } from 'react';
import API_BASE from '../config';

/** 3270 screen column count (always 80) */
const COLS = 80;

/** Default empty screen (will resize when data arrives) */
const emptyScreen = () => Array.from({ length: 24 }, () => ' '.repeat(COLS));

/**
 * TN3270 Terminal Emulator Component
 * 
 * Features:
 * - Screen display with line numbers (24x80 character grid)
 * - Staged input system: queue multiple row/col/text inputs before sending
 * - Live yellow preview for current input, red for staged inputs
 * - Enter sends all staged inputs then presses Enter
 * - Operation logging with toggle switches
 */
export default function TN3270Terminal() {
  // --- State ---
  const [sessionId, setSessionId] = useState(null);
  const [screenLines, setScreenLines] = useState(emptyScreen());
  const [inputRow, setInputRow] = useState('');
  const [inputCol, setInputCol] = useState('');
  const [inputText, setInputText] = useState('');
  const [stagedInputs, setStagedInputs] = useState([]); // [{row, col, text}, ...]
  const [logs, setLogs] = useState([]);
  const [logOperations, setLogOperations] = useState(true);
  const [logRawJson, setLogRawJson] = useState(false);
  const [loading, setLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState('Disconnected');

  // --- Refs ---
  const logEndRef = useRef(null);

  // Auto-scroll log panel
  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // --- Logging helpers ---
  const addLog = useCallback((type, message) => {
    const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
    setLogs(prev => [...prev, { ts, type, message }]);
  }, []);

  const logOperation = useCallback((message) => {
    if (logOperations) addLog('OP', message);
  }, [logOperations, addLog]);

  const logRaw = useCallback((label, data) => {
    if (logRawJson) addLog('RAW', `${label}: ${JSON.stringify(data)}`);
  }, [logRawJson, addLog]);

  const logFormatted = useCallback((label, data) => {
    addLog('JSON', `${label}: ${JSON.stringify(data, null, 2)}`);
  }, [addLog]);

  // --- API call helper ---
  const apiCall = async (method, path, body = null) => {
    const headers = { 'Content-Type': 'application/json' };
    if (sessionId) headers['X-Session-Id'] = sessionId;

    const opts = { method, headers };
    if (body) opts.body = JSON.stringify(body);

    const res = await fetch(`${API_BASE}${path}`, opts);
    const json = await res.json();
    return json;
  };

  /** Update screen from API response data */
  const updateScreen = (data) => {
    if (data?.screenLines?.length > 0) {
      const padded = data.screenLines.map(line =>
        (line || '').padEnd(COLS).substring(0, COLS)
      );
      // Don't pad to fixed rows — screen may be 24 or 43 rows
      setScreenLines(padded);
    }
  };

  // ============================================
  //  STAGED INPUT SYSTEM
  // ============================================

  /** Stage current input (save row/col/text, show red on screen) */
  const handleStageInput = () => {
    const row = parseInt(inputRow);
    const col = parseInt(inputCol);
    const text = inputText;
    if (!row || !col || !text) return;

    const newEntry = { row, col, text };
    setStagedInputs(prev => [...prev, newEntry]);
    logOperation(`Staged input #${stagedInputs.length + 1}: [Row:${row}, Col:${col}] "${text}"`);

    // Clear input fields for next entry
    setInputRow('');
    setInputCol('');
    setInputText('');
  };

  /** Remove a specific staged input by index */
  const removeStagedInput = (index) => {
    setStagedInputs(prev => prev.filter((_, i) => i !== index));
    logOperation(`Removed staged input #${index + 1}`);
  };

  /** Clear all staged inputs */
  const clearStagedInputs = () => {
    setStagedInputs([]);
    logOperation('Cleared all staged inputs');
  };

  // ============================================
  //  API ACTIONS
  // ============================================

  const handleConnect = async () => {
    setLoading(true);
    setStatusMsg('Connecting...');
    logOperation('Connect request sent');
    try {
      const json = await apiCall('POST', '/connect');
      logRaw('Connect response (raw)', json);
      logFormatted('Connect response', json);

      if (json.success) {
        setSessionId(json.sessionId);
        updateScreen(json.data);
        setStatusMsg(`Connected - Session: ${json.sessionId.substring(0, 8)}...`);
        logOperation(`Connected. Session ID: ${json.sessionId}`);
      } else {
        setStatusMsg('Connection failed');
        logOperation(`Connection failed: ${json.message}`);
      }
    } catch (e) {
      setStatusMsg('Connection error');
      logOperation(`Connect error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleRefresh = async () => {
    if (!sessionId) return;
    setLoading(true);
    logOperation('Screen refresh requested');
    try {
      const json = await apiCall('GET', '/screen');
      logRaw('Screen response (raw)', json);
      logFormatted('Screen response', json);
      updateScreen(json.data);
      logOperation('Screen refreshed');
    } catch (e) {
      logOperation(`Refresh error: ${e.message}`);
    }
    setLoading(false);
  };

  /**
   * Send Text: immediately write text to the screen WITHOUT pressing Enter.
   * - If Row + Col are provided: sends to specified position via /menu/command
   * - If Row + Col are empty: sends to current cursor position via /send/string
   * This mimics the Falcon client's typing behavior.
   */
  const handleSendText = async () => {
    if (!sessionId || !inputText) return;
    setLoading(true);

    const row = parseInt(inputRow);
    const col = parseInt(inputCol);
    const text = inputText;

    if (row && col) {
      // Send to specific position (like fillField)
      logOperation(`Send text at [Row:${row}, Col:${col}]: "${text}"`);
      try {
        const json = await apiCall('POST', '/menu/command', {
          row: row,
          column: col,
          command: text,
        });
        logRaw('SendText response (raw)', json);
        logFormatted('SendText response', json);
        updateScreen(json.data);
        logOperation(`Text sent to [Row:${row}, Col:${col}]`);
      } catch (e) {
        logOperation(`SendText error: ${e.message}`);
      }
    } else {
      // No position: send to current cursor (like typing in Falcon)
      logOperation(`Send text at cursor: "${text}"`);
      try {
        const json = await apiCall('POST', '/send/string', { text: text });
        logRaw('SendString response (raw)', json);
        logFormatted('SendString response', json);
        updateScreen(json.data);
        logOperation(`Text sent at cursor position`);
      } catch (e) {
        logOperation(`SendString error: ${e.message}`);
      }
    }

    // Clear text input after sending
    setInputText('');
    setLoading(false);
  };

  /**
   * Enter: send all staged inputs to mainframe, then press Enter.
   * If no staged inputs, just sends Enter key.
   */
  const handleEnter = async () => {
    if (!sessionId) return;
    setLoading(true);

    // If staged inputs exist, send them all first
    if (stagedInputs.length > 0) {
      logOperation(`Sending ${stagedInputs.length} staged input(s) then Enter...`);

      for (let i = 0; i < stagedInputs.length; i++) {
        const { row, col, text } = stagedInputs[i];
        logOperation(`  Sending #${i + 1}: [Row:${row}, Col:${col}] "${text}"`);
        try {
          const json = await apiCall('POST', '/menu/command', {
            row: row,
            column: col,
            command: text,
          });
          logRaw(`Input #${i + 1} response (raw)`, json);
          if (!json.success) {
            logOperation(`  Input #${i + 1} failed: ${json.message}`);
          }
        } catch (e) {
          logOperation(`  Input #${i + 1} error: ${e.message}`);
        }
      }

      // Clear staged inputs after sending
      setStagedInputs([]);
    } else {
      logOperation('Sending Enter key (no staged inputs)');
    }

    // Now press Enter
    try {
      const json = await apiCall('POST', '/key/enter');
      logRaw('Enter response (raw)', json);
      logFormatted('Enter response', json);
      updateScreen(json.data);
      logOperation('Enter sent successfully');
    } catch (e) {
      logOperation(`Enter error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleKeyAction = async (displayName, endpoint) => {
    if (!sessionId) return;
    setLoading(true);
    logOperation(`Key pressed: ${displayName}`);
    try {
      const json = await apiCall('POST', endpoint);
      logRaw(`${displayName} response (raw)`, json);
      logFormatted(`${displayName} response`, json);
      updateScreen(json.data);
      logOperation(`${displayName} sent successfully`);
    } catch (e) {
      logOperation(`${displayName} error: ${e.message}`);
    }
    setLoading(false);
  };

  const handleFunctionKey = async (keyName) => {
    if (!sessionId) return;
    setLoading(true);
    logOperation(`Function key pressed: ${keyName}`);
    try {
      const json = await apiCall('POST', '/key/function', { keyName });
      logRaw(`${keyName} response (raw)`, json);
      logFormatted(`${keyName} response`, json);
      updateScreen(json.data);
      logOperation(`${keyName} sent successfully`);
    } catch (e) {
      logOperation(`${keyName} error: ${e.message}`);
    }
    setLoading(false);
  };

  const clearLogs = () => setLogs([]);

  // ============================================
  //  SCREEN RENDERING WITH OVERLAYS
  // ============================================

  /**
   * Build a character map with type for each cell:
   * 'staged'  = red   (committed staged input)
   * 'preview' = yellow (current live preview, not yet staged)
   * null      = normal green
   */
  const getDisplayData = () => {
    const numRows = screenLines.length;
    const chars = screenLines.map(line => [...line]);
    const types = Array.from({ length: numRows }, () => Array(COLS).fill(null));

    // Layer 1: staged inputs (red)
    for (const { row, col, text } of stagedInputs) {
      const r = row - 1;
      const c = col - 1;
      if (r >= 0 && r < numRows) {
        for (let i = 0; i < text.length && c + i < COLS; i++) {
          chars[r][c + i] = text[i];
          types[r][c + i] = 'staged';
        }
      }
    }

    // Layer 2: current preview (yellow)
    const pRow = parseInt(inputRow);
    const pCol = parseInt(inputCol);
    const pText = inputText;
    if (pRow >= 1 && pRow <= numRows && pCol >= 1 && pCol <= COLS && pText) {
      const r = pRow - 1;
      const c = pCol - 1;
      for (let i = 0; i < pText.length && c + i < COLS; i++) {
        chars[r][c + i] = pText[i];
        types[r][c + i] = 'preview';
      }
    }

    return { chars, types };
  };

  const { chars: displayChars, types: displayTypes } = getDisplayData();

  // ============================================
  //  STYLES
  // ============================================
  const styles = {
    root: {
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0a0a12 0%, #0d1117 50%, #0a0f18 100%)',
      color: '#c9d1d9',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      padding: '20px',
      maxWidth: '960px',
      margin: '0 auto',
    },
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '16px',
      borderBottom: '1px solid #1e3a2a',
      paddingBottom: '12px',
    },
    title: {
      fontSize: '18px',
      fontWeight: 700,
      color: '#3eff8b',
      letterSpacing: '2px',
      textTransform: 'uppercase',
    },
    status: {
      fontSize: '12px',
      padding: '4px 12px',
      borderRadius: '12px',
      background: sessionId ? '#0d2818' : '#2d1216',
      color: sessionId ? '#3eff8b' : '#ff6b6b',
      border: `1px solid ${sessionId ? '#1e3a2a' : '#3d1f24'}`,
    },
    toolbar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '16px',
      flexWrap: 'wrap',
    },
    screenWrap: {
      background: '#0c0f14',
      border: '1px solid #1e3a2a',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '16px',
      overflowX: 'auto',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
    },
    screenRow: { display: 'flex', lineHeight: '20px', height: '20px' },
    lineNum: {
      color: '#3a4a5a',
      userSelect: 'none',
      width: '36px',
      textAlign: 'right',
      paddingRight: '8px',
      fontSize: '13px',
      flexShrink: 0,
    },
    charBase: {
      fontSize: '13px',
      display: 'inline-block',
      width: '8.4px',
      textAlign: 'center',
      height: '20px',
      lineHeight: '20px',
    },
    section: {
      background: '#0e1218',
      border: '1px solid #1b2332',
      borderRadius: '8px',
      padding: '12px',
      marginBottom: '12px',
    },
    sectionTitle: {
      fontSize: '11px',
      fontWeight: 700,
      color: '#5a6a7a',
      textTransform: 'uppercase',
      letterSpacing: '1px',
      marginBottom: '10px',
    },
    inputPanel: { display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' },
    inputGroup: { display: 'flex', alignItems: 'center', gap: '6px' },
    label: {
      fontSize: '11px',
      color: '#6a7a8a',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.5px',
    },
    toggleWrap: { display: 'flex', gap: '20px', marginBottom: '12px' },
    toggle: { display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '12px' },
    logBox: {
      background: '#080a0e',
      border: '1px solid #1b2332',
      borderRadius: '6px',
      padding: '8px',
      maxHeight: '220px',
      overflowY: 'auto',
      fontSize: '11px',
      lineHeight: '18px',
    },
    logTs: { color: '#3a4a5a', marginRight: '6px' },
    stagedList: {
      background: '#0a0e14',
      border: '1px solid #2a1a1a',
      borderRadius: '6px',
      padding: '8px',
      marginTop: '10px',
    },
    stagedItem: {
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: '4px 8px',
      marginBottom: '4px',
      background: '#1a0e0e',
      border: '1px solid #3a1a1a',
      borderRadius: '4px',
      fontSize: '12px',
    },
    stagedLabel: { color: '#ff6666', fontWeight: 600 },
    stagedInfo: { color: '#cc8888', fontSize: '11px' },
    stagedRemoveBtn: {
      background: 'none',
      border: '1px solid #4a2a2a',
      borderRadius: '3px',
      color: '#884444',
      fontSize: '10px',
      padding: '2px 6px',
      cursor: 'pointer',
      fontFamily: 'inherit',
    },
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: '18px',
      height: '18px',
      borderRadius: '9px',
      background: '#6b2020',
      color: '#ff8888',
      fontSize: '10px',
      fontWeight: 700,
      marginLeft: '6px',
      padding: '0 5px',
    },
  };

  const charStyle = (type) => {
    if (type === 'staged') {
      return { ...styles.charBase, color: '#ff4444', background: '#2a0e0e', fontWeight: 700 };
    }
    if (type === 'preview') {
      return { ...styles.charBase, color: '#ffcc00', background: '#664d00', fontWeight: 700, borderRadius: '1px' };
    }
    return { ...styles.charBase, color: '#33ff77' };
  };

  const btnStyle = (variant = 'default') => {
    const variants = {
      default: { bg: '#161b22', border: '#30363d', color: '#c9d1d9' },
      primary: { bg: '#0d4429', border: '#1e6d3e', color: '#3eff8b' },
      stage:   { bg: '#3a2200', border: '#6b4400', color: '#ffaa00' },
      action:  { bg: '#1a1e29', border: '#2d3548', color: '#7eb6ff' },
      key:     { bg: '#1c1c2e', border: '#333366', color: '#b8b8ff' },
    };
    const v = variants[variant] || variants.default;
    return {
      padding: '6px 14px',
      fontSize: '12px',
      fontFamily: 'inherit',
      fontWeight: 600,
      border: `1px solid ${v.border}`,
      borderRadius: '6px',
      background: v.bg,
      color: v.color,
      cursor: 'pointer',
      transition: 'all 0.15s ease',
      whiteSpace: 'nowrap',
    };
  };

  const inputStyle = (width = '60px') => ({
    width,
    padding: '6px 8px',
    fontSize: '13px',
    fontFamily: 'inherit',
    background: '#0c0f14',
    border: '1px solid #30363d',
    borderRadius: '4px',
    color: '#e6e6e6',
    outline: 'none',
  });

  const toggleSwitchStyle = (on) => ({
    width: '36px',
    height: '20px',
    borderRadius: '10px',
    background: on ? '#0d4429' : '#21262d',
    border: `1px solid ${on ? '#1e6d3e' : '#30363d'}`,
    position: 'relative',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
    flexShrink: 0,
  });

  const toggleKnobStyle = (on) => ({
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: on ? '#3eff8b' : '#6a7a8a',
    position: 'absolute',
    top: '2px',
    left: on ? '18px' : '2px',
    transition: 'all 0.2s ease',
  });

  const logTypeStyle = (type) => ({
    color: type === 'OP' ? '#1a6b3a' : type === 'RAW' ? '#555' : '#2a4a7a',
    marginRight: '6px',
    fontWeight: 700,
    fontSize: '10px',
  });

  const logEntryColor = (type) => {
    const colors = { OP: '#3eff8b', RAW: '#888', JSON: '#7eb6ff' };
    return colors[type] || '#c9d1d9';
  };

  // ============================================
  //  RENDER
  // ============================================
  return (
    <div style={styles.root}>

      {/* Header */}
      <div style={styles.header}>
        <div style={styles.title}>TN3270 Terminal</div>
        <div style={styles.status}>{statusMsg}</div>
      </div>

      {/* Connection Toolbar */}
      <div style={styles.toolbar}>
        <button
          style={btnStyle('primary')}
          onClick={handleConnect}
          disabled={loading || !!sessionId}
        >
          Connect
        </button>
        <button
          style={btnStyle('action')}
          onClick={handleRefresh}
          disabled={loading || !sessionId}
        >
          Refresh Screen
        </button>
        {loading && (
          <span style={{ fontSize: '12px', color: '#6a7a8a', alignSelf: 'center' }}>
            Processing...
          </span>
        )}
      </div>

      {/* Screen Display Area */}
      <div style={styles.screenWrap}>
        {displayChars.map((row, ri) => (
          <div key={ri} style={styles.screenRow}>
            <span style={styles.lineNum}>
              {String(ri + 1).padStart(2, '0')}
            </span>
            <span>
              {row.map((ch, ci) => (
                <span key={ci} style={charStyle(displayTypes[ri][ci])}>
                  {ch}
                </span>
              ))}
            </span>
          </div>
        ))}
      </div>

      {/* Cursor Position & Input */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Cursor Position & Input</div>
        <div style={styles.inputPanel}>
          <div style={styles.inputGroup}>
            <span style={styles.label}>Row</span>
            <input
              style={inputStyle('52px')}
              type="number"
              min="1"
              max="99"
              placeholder={"1-" + screenLines.length}
              value={inputRow}
              onChange={(e) => setInputRow(e.target.value)}
            />
          </div>
          <div style={styles.inputGroup}>
            <span style={styles.label}>Col</span>
            <input
              style={inputStyle('52px')}
              type="number"
              min="1"
              max="80"
              placeholder="1-80"
              value={inputCol}
              onChange={(e) => setInputCol(e.target.value)}
            />
          </div>
          <div style={styles.inputGroup}>
            <span style={styles.label}>Text</span>
            <input
              style={inputStyle('280px')}
              type="text"
              placeholder="Enter text to stage..."
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleStageInput(); }}
            />
          </div>
        </div>

        {/* Staged Inputs List */}
        {stagedInputs.length > 0 && (
          <div style={styles.stagedList}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '11px', color: '#ff6666', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Staged Inputs ({stagedInputs.length})
              </span>
              <button style={styles.stagedRemoveBtn} onClick={clearStagedInputs}>
                Clear All
              </button>
            </div>
            {stagedInputs.map((item, i) => (
              <div key={i} style={styles.stagedItem}>
                <div>
                  <span style={styles.stagedLabel}>#{i + 1}</span>
                  <span style={styles.stagedInfo}>
                    {' '}Row:{item.row} Col:{item.col} "{item.text}"
                  </span>
                </div>
                <button style={styles.stagedRemoveBtn} onClick={() => removeStagedInput(i)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Terminal Keys */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>Terminal Keys</div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
          <button
            style={btnStyle('stage')}
            onClick={handleStageInput}
            disabled={!inputRow || !inputCol || !inputText}
          >
            Stage Input
          </button>
          <button
            style={btnStyle('primary')}
            onClick={handleSendText}
            disabled={loading || !sessionId || !inputText}
          >
            Send Text
          </button>
          <span style={{ color: '#333', fontSize: '16px', alignSelf: 'center' }}>|</span>
          <button
            style={btnStyle('key')}
            onClick={() => handleKeyAction('Reset', '/key/reset')}
            disabled={loading || !sessionId}
          >
            Reset
          </button>
          <button
            style={btnStyle('key')}
            onClick={() => handleFunctionKey('PF2')}
            disabled={loading || !sessionId}
          >
            F2
          </button>
          <button
            style={btnStyle('key')}
            onClick={() => handleFunctionKey('PF3')}
            disabled={loading || !sessionId}
          >
            F3
          </button>
          <button
            style={btnStyle('action')}
            onClick={handleEnter}
            disabled={loading || !sessionId}
          >
            Enter
            {stagedInputs.length > 0 && (
              <span style={styles.badge}>{stagedInputs.length}</span>
            )}
          </button>
          <button
            style={btnStyle('action')}
            onClick={() => handleKeyAction('Tab', '/key/tab')}
            disabled={loading || !sessionId}
          >
            Tab
          </button>
          <button
            style={btnStyle('key')}
            onClick={() => handleFunctionKey('Clear')}
            disabled={loading || !sessionId}
          >
            Clear
          </button>
        </div>
      </div>

      {/* Operation Log */}
      <div style={styles.section}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={styles.sectionTitle}>Operation Log</div>
          <button
            style={{ ...btnStyle('default'), fontSize: '10px', padding: '3px 8px' }}
            onClick={clearLogs}
          >
            Clear
          </button>
        </div>

        <div style={styles.toggleWrap}>
          <div style={styles.toggle} onClick={() => setLogOperations(!logOperations)}>
            <div style={toggleSwitchStyle(logOperations)}>
              <div style={toggleKnobStyle(logOperations)} />
            </div>
            <span style={{ color: logOperations ? '#3eff8b' : '#6a7a8a' }}>
              Log Operations
            </span>
          </div>
          <div style={styles.toggle} onClick={() => setLogRawJson(!logRawJson)}>
            <div style={toggleSwitchStyle(logRawJson)}>
              <div style={toggleKnobStyle(logRawJson)} />
            </div>
            <span style={{ color: logRawJson ? '#3eff8b' : '#6a7a8a' }}>
              Log Raw JSON
            </span>
          </div>
        </div>

        <div style={styles.logBox}>
          {logs.length === 0 && (
            <div style={{ color: '#3a4a5a', fontStyle: 'italic' }}>
              No log entries yet. Connect to start.
            </div>
          )}
          {logs.map((entry, i) => (
            <div key={i} style={{ color: logEntryColor(entry.type) }}>
              <span style={styles.logTs}>[{entry.ts}]</span>
              <span style={logTypeStyle(entry.type)}>{entry.type}</span>
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
