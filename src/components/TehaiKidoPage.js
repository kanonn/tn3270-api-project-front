import React, { useState } from 'react';
import { POC_CONFIG } from '../config';
import { screenText, delayMs, apiCall, getLines, runLoginStepsAtoD } from './pocHelpers';
import { useLog, S, AnemsDisplayPanel, LogPanel } from './pocStyles';
import PocEditScreen from './PocEditScreen';

/**
 * Tehai Kido (手配起動) Page
 *
 * Layout:
 *   Row 1: [ANEMS接続] [F11] ---status--- [ANEMS切断]
 *   Row 2: [設通No.___] [PASSWORD___] MENU:T1 [手配起動] [手配起動編集]
 *   Error display
 *   Edit screen (when active)
 *   ANEMS Screen Display
 *   Operation Log
 *
 * Flow:
 *   1. ANEMS接続 → connect + login to ANEMS (steps A-D)
 *   2. F11 → enter subsystem with T1 + password (steps E-F)
 *   3. 手配起動 → write settsu no to 3270, pause (step G, no Enter yet)
 *   4. 手配起動編集 → press Enter, show edit screen (step H)
 */
export default function TehaiKidoPage() {
  const [sid, setSid] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [settsuWritten, setSettsuWritten] = useState(false); // after step G, before Enter
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [settsuNo, setSettsuNo] = useState('');
  const [password, setPassword] = useState('');
  const [editScreenLines, setEditScreenLines] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const { logs, anemsScreen, logEndRef, logStep, logOk, logErr, logApi, clearLogs } = useLog();
  const D = POC_CONFIG.operationDelay;

  // ===== ANEMS接続 (Steps A-D) =====
  const handleConnect = async () => {
    setRunning(true);
    setError(null);
    try {
      const { sid: newSid } = await runLoginStepsAtoD('TehaiKido', logStep, logOk, logErr, logApi);
      setSid(newSid);
      setConnected(true);
      logOk('ANEMS connected.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== F11 (just sends F11 key, no password) =====
  const handleF11 = async () => {
    if (!sid || !connected) return;
    setRunning(true);
    setError(null);
    try {
      logStep('[TehaiKido] F11...');
      await delayMs(D);
      let json = await apiCall('POST', '/key/function', { keyName: 'PF11' }, sid);
      let lines = getLines(json);
      logApi('F11', lines);

      const pwLabel = screenText(lines, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') throw new Error(`Expected "PASSWORD", got "${pwLabel}"`);
      logOk('PASSWORD prompt found. Enter password and click 手配起動.');
      setLoggedIn(true);
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== ANEMS切断 (F2 x4) =====
  const handleDisconnect = async () => {
    if (!sid) return;
    setRunning(true);
    setError(null);
    try {
      logStep('[TehaiKido] Disconnecting (F2 x4)...');
      for (let i = 1; i <= 4; i++) {
        await delayMs(D);
        const json = await apiCall('POST', '/key/function', { keyName: 'PF2' }, sid);
        logApi(`F2 #${i}`, getLines(json));
      }
      setConnected(false);
      setLoggedIn(false);
      setSettsuWritten(false);
      setSid(null);
      setShowEdit(false);
      setEditScreenLines(null);
      logOk('Disconnected.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== 手配起動 (password + T1 + Enter, then settsu no) =====
  const handleTehaiKido = async () => {
    if (!sid || !loggedIn) return;
    setRunning(true);
    setError(null);
    setShowEdit(false);
    setEditScreenLines(null);
    setSettsuWritten(false);
    try {
      // Step E: Password + T1 + Enter
      if (!password) throw new Error('Please enter PASSWORD.');
      logStep('[TehaiKido] Step E: Sending password + T1...');
      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 32, command: password }, sid);
      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 62, command: 'T1' }, sid);
      await delayMs(D);
      let json = await apiCall('POST', '/key/enter', null, sid);
      let lines = getLines(json);
      logApi('Enter after password', lines);

      // Step F: TB01 check
      if (screenText(lines, 1, 5, 4) !== 'TB01') {
        throw new Error(`Expected "TB01", got "${screenText(lines, 1, 5, 4)}"`);
      }
      logOk('TB01 confirmed.');

      // Step G: Write settsu no
      logStep('[TehaiKido] Step G: Writing Settsu No...');
      if (!settsuNo.includes('-')) throw new Error(`Invalid: "${settsuNo}"`);
      const [left, right] = settsuNo.split('-');

      await delayMs(D);
      json = await apiCall('POST', '/menu/command', { row: 14, column: 64, command: left }, sid);
      logApi('Write left part', getLines(json));
      await delayMs(D);
      json = await apiCall('POST', '/menu/command', { row: 14, column: 71, command: right }, sid);
      logApi('Write right part', getLines(json));

      setSettsuWritten(true);
      logOk('Settsu No written. Press "手配起動編集" to continue.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== 手配起動編集 (Step H: press Enter, show edit screen) =====
  const handleTehaiEdit = async () => {
    if (!sid || !settsuWritten) return;
    setRunning(true);
    setError(null);
    try {
      logStep('[TehaiKido] Step H: Pressing Enter, loading edit screen...');
      await delayMs(D);
      const json = await apiCall('POST', '/key/enter', null, sid);
      const lines = getLines(json);
      logApi('Enter result', lines);

      setEditScreenLines(lines);
      setShowEdit(true);
      const row27 = lines.length >= 27 ? lines[26].trim() : '';
      logOk(`Edit screen loaded. Row 27: "${row27}"`);
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  const statusText = loggedIn ? 'Subsystem Ready' : connected ? 'ANEMS接続中' : '未接続';

  return (
    <div style={S.page}>
      <div style={S.title}>手配起動 (Tehai Kido)</div>

      <div style={S.panel}>
        {/* Row 1: [ANEMS接続] [F11] ---status--- [ANEMS切断] */}
        <div style={S.row}>
          <button style={{ ...S.btn('#3182ce'), ...(running || connected ? S.btnDisabled : {}) }}
            onClick={handleConnect} disabled={running || connected}>
            {running && !connected ? <span><span style={S.spinner}/>...</span> : 'ANEMS接続'}
          </button>
          <button style={{ ...S.btn('#805ad5'), ...(running || !connected || loggedIn ? S.btnDisabled : {}) }}
            onClick={handleF11} disabled={running || !connected || loggedIn}>
            F11
          </button>
          <div style={S.spacer} />
          <span style={S.statusLabel(connected)}>{statusText}</span>
          <div style={S.spacer} />
          <button style={{ ...S.btn('#e53e3e'), ...(running || !connected ? S.btnDisabled : {}) }}
            onClick={handleDisconnect} disabled={running || !connected}>
            ANEMS切断
          </button>
        </div>

        {/* Row 2: [設通No.] [PASSWORD] MENU:T1 [手配起動] [手配起動編集] */}
        <div style={S.row}>
          <span style={S.labelInline}>設通No.</span>
          <input style={{ ...S.input, width: '180px' }} value={settsuNo}
            onChange={(e) => setSettsuNo(e.target.value)}
            placeholder="ex: QL6140-00075" disabled={running || !loggedIn} />
          <span style={S.labelInline}>PASSWORD</span>
          <input style={{ ...S.input, width: '120px' }} type="password" value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password" disabled={running || !connected} />
          <div style={S.menuLabel}>
            <span style={{ color: '#718096', fontSize: '11px' }}>MENU:</span>
            <span style={{ fontWeight: 700 }}>T1</span>
          </div>
          <button style={{ ...S.btn('#38a169'), ...(running || !loggedIn || !settsuNo ? S.btnDisabled : {}) }}
            onClick={handleTehaiKido} disabled={running || !loggedIn || !settsuNo}>
            手配起動
          </button>
          <button style={{ ...S.btn('#d69e2e'), ...(running || !settsuWritten ? S.btnDisabled : {}) }}
            onClick={handleTehaiEdit} disabled={running || !settsuWritten}>
            手配起動編集
          </button>
        </div>

        {error && <div style={S.errorBox}><strong>Error:</strong> {error}</div>}

        {/* Inline edit screen */}
        {showEdit && editScreenLines && (
          <PocEditScreen
            screenLines={editScreenLines}
            onClose={() => setShowEdit(false)}
            onSave={(data) => { console.log('Tehai save:', data); alert('Saved to console.'); }}
          />
        )}
      </div>

      {/* ANEMS Screen Display */}
      <AnemsDisplayPanel anemsScreen={anemsScreen} />

      {/* Operation Log */}
      <LogPanel logs={logs} logEndRef={logEndRef} clearLogs={clearLogs} />
    </div>
  );
}
