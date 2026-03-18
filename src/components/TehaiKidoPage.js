import React, { useState } from 'react';
import { POC_CONFIG } from '../config';
import { screenText, delayMs, apiCall, getLines, runLoginStepsAtoD } from './pocHelpers';
import { useLog, S, LogPanel } from './pocStyles';
import PocEditScreen from './PocEditScreen';

/**
 * Tehai Kido (手配起動) Page
 *
 * Same connection flow as Uketsuke but:
 * - Step E sends "T1" (not "U1")
 * - Step F checks "TB01" (not "TC01")
 * - Step H opens inline edit screen
 */
export default function TehaiKidoPage() {
  const [sid, setSid] = useState(null);
  const [connected, setConnected] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [settsuNo, setSettsuNo] = useState('');
  const [editScreenLines, setEditScreenLines] = useState(null);
  const [showEdit, setShowEdit] = useState(false);
  const { logs, logEndRef, logStep, logOk, logErr, logApi, clearLogs } = useLog();
  const D = POC_CONFIG.operationDelay;

  // ===== ANEMS接続 =====
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
      setSid(null);
      setShowEdit(false);
      setEditScreenLines(null);
      logOk('ANEMS disconnected.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== F11 (login with T1) =====
  const handleF11 = async () => {
    if (!sid || !connected) return;
    setRunning(true);
    setError(null);
    try {
      logStep('[TehaiKido] F11: entering subsystem...');
      await delayMs(D);
      let json = await apiCall('POST', '/key/function', { keyName: 'PF11' }, sid);
      let lines = getLines(json);
      logApi('F11 result', lines);

      // Step E: Password with T1
      const pwLabel = screenText(lines, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') throw new Error(`Expected "PASSWORD", got "${pwLabel}"`);
      logOk('PASSWORD prompt found.');

      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 32, command: POC_CONFIG.password }, sid);
      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 62, command: 'T1' }, sid);
      await delayMs(D);
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after password', lines);

      // Step F: TB01 check
      const tb01 = screenText(lines, 1, 5, 4);
      if (tb01 !== 'TB01') throw new Error(`Expected "TB01", got "${tb01}"`);
      setLoggedIn(true);
      logOk('TB01 confirmed. Subsystem ready.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== 手配起動 (settsu lookup + edit) =====
  const handleTehaiKido = async () => {
    if (!sid || !loggedIn) return;
    setRunning(true);
    setError(null);
    setShowEdit(false);
    setEditScreenLines(null);
    try {
      logStep('[TehaiKido] Step G: Settsu No...');
      if (!settsuNo.includes('-')) throw new Error(`Invalid format: "${settsuNo}"`);
      const [left, right] = settsuNo.split('-');

      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 14, column: 64, command: left }, sid);
      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 14, column: 71, command: right }, sid);
      await delayMs(D);
      const json = await apiCall('POST', '/key/enter', null, sid);
      const lines = getLines(json);
      logApi('Enter after settsu', lines);

      // Step H: Show edit screen
      logStep('[TehaiKido] Step H: Loading edit screen...');
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
        {/* Connection row */}
        <div style={S.row}>
          <button style={{ ...S.btnSmall('#3182ce'), ...(running || connected ? S.btnDisabled : {}) }}
            onClick={handleConnect} disabled={running || connected}>
            {running && !connected ? <span><span style={S.spinner}/>...</span> : 'ANEMS接続'}
          </button>
          <button style={{ ...S.btnSmall('#e53e3e'), ...(running || !connected ? S.btnDisabled : {}) }}
            onClick={handleDisconnect} disabled={running || !connected}>
            ANEMS切断
          </button>
          <span style={S.statusLabel(connected)}>{statusText}</span>
        </div>

        {/* F11 row */}
        <div style={S.row}>
          <button style={{ ...S.btnSmall('#805ad5'), ...(running || !connected || loggedIn ? S.btnDisabled : {}) }}
            onClick={handleF11} disabled={running || !connected || loggedIn}>
            F11
          </button>
        </div>

        {/* Settsu No + 手配起動 */}
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>設通No.</label>
            <input style={S.inputSmall} value={settsuNo}
              onChange={(e) => setSettsuNo(e.target.value)}
              placeholder="ex: QL6140-00075" disabled={running || !loggedIn} />
          </div>
          <button style={{ ...S.btn('#38a169'), ...(running || !loggedIn || !settsuNo ? S.btnDisabled : {}), marginTop: '20px' }}
            onClick={handleTehaiKido} disabled={running || !loggedIn || !settsuNo}>
            手配起動
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

      <LogPanel logs={logs} logEndRef={logEndRef} clearLogs={clearLogs} />
    </div>
  );
}
