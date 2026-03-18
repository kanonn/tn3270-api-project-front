import React, { useState } from 'react';
import { POC_CONFIG } from '../config';
import { screenText, delayMs, apiCall, getLines, runLoginStepsAtoD } from './pocHelpers';
import { useLog, S, LogPanel } from './pocStyles';

/**
 * Uketsuke (受付) Page
 *
 * Layout:
 *   - ANEMS接続 / ANEMS切断 buttons + connection status
 *   - F11 button (login to subsystem)
 *   - 設通No. input + 受付 button
 *   - Error/Result display
 *   - Log panel (terminal dark style)
 */
export default function UketsukePage() {
  const [sid, setSid] = useState(null);
  const [connected, setConnected] = useState(false); // ANEMS connected (after step D)
  const [loggedIn, setLoggedIn] = useState(false);    // After F11 + password
  const [running, setRunning] = useState(false);
  const [error, setError] = useState(null);
  const [settsuNo, setSettsuNo] = useState('');
  const [result27, setResult27] = useState('');
  const { logs, logEndRef, logStep, logOk, logErr, logApi, clearLogs } = useLog();
  const D = POC_CONFIG.operationDelay;

  // ===== ANEMS接続 =====
  const handleConnect = async () => {
    setRunning(true);
    setError(null);
    try {
      const { sid: newSid } = await runLoginStepsAtoD('Uketsuke', logStep, logOk, logErr, logApi);
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
      logStep('[Uketsuke] Disconnecting (F2 x4)...');
      for (let i = 1; i <= 4; i++) {
        await delayMs(D);
        const json = await apiCall('POST', '/key/function', { keyName: 'PF2' }, sid);
        logApi(`F2 #${i}`, getLines(json));
      }
      setConnected(false);
      setLoggedIn(false);
      setSid(null);
      logOk('ANEMS disconnected.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== F11 (login to subsystem) =====
  const handleF11 = async () => {
    if (!sid || !connected) return;
    setRunning(true);
    setError(null);
    try {
      logStep('[Uketsuke] F11: entering subsystem...');
      await delayMs(D);
      let json = await apiCall('POST', '/key/function', { keyName: 'PF11' }, sid);
      let lines = getLines(json);
      logApi('F11 result', lines);

      // Step E: Password
      const pwLabel = screenText(lines, 10, 21, 8);
      if (pwLabel !== 'PASSWORD') throw new Error(`Expected "PASSWORD", got "${pwLabel}"`);
      logOk('PASSWORD prompt found.');

      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 32, command: POC_CONFIG.password }, sid);
      await delayMs(D);
      await apiCall('POST', '/menu/command', { row: 10, column: 62, command: 'U1' }, sid);
      await delayMs(D);
      json = await apiCall('POST', '/key/enter', null, sid);
      lines = getLines(json);
      logApi('Enter after password', lines);

      // Step F: TC01 check
      const tc01 = screenText(lines, 1, 5, 4);
      if (tc01 !== 'TC01') throw new Error(`Expected "TC01", got "${tc01}"`);
      setLoggedIn(true);
      logOk('TC01 confirmed. Subsystem ready.');
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // ===== 受付 (settsu lookup) =====
  const handleUketsuke = async () => {
    if (!sid || !loggedIn) return;
    setRunning(true);
    setError(null);
    setResult27('');
    try {
      logStep('[Uketsuke] Step G: Settsu No...');
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

      // Step H: Row 27
      const row27 = lines.length >= 27 ? lines[26] : '';
      setResult27(row27);
      logOk(`Row 27: "${row27.trim()}"`);
    } catch (e) {
      logErr(e.message);
      setError(e.message);
    } finally {
      setRunning(false);
    }
  };

  // Status text
  const statusText = loggedIn ? 'Subsystem Ready' : connected ? 'ANEMS接続中' : '未接続';

  return (
    <div style={S.page}>
      <div style={S.title}>受付 (Uketsuke)</div>

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

        {/* Settsu No + 受付 */}
        <div style={S.row}>
          <div style={{ flex: 1 }}>
            <label style={S.label}>設通No.</label>
            <input style={S.inputSmall} value={settsuNo}
              onChange={(e) => setSettsuNo(e.target.value)}
              placeholder="ex: QL6140-00075" disabled={running || !loggedIn} />
          </div>
          <button style={{ ...S.btn('#38a169'), ...(running || !loggedIn || !settsuNo ? S.btnDisabled : {}), marginTop: '20px' }}
            onClick={handleUketsuke} disabled={running || !loggedIn || !settsuNo}>
            受付
          </button>
        </div>

        {error && <div style={S.errorBox}><strong>Error:</strong> {error}</div>}
        {result27 && (
          <div style={S.resultBox}><strong>Row 27 Result:</strong><div style={{marginTop:'4px'}}>{result27}</div></div>
        )}
      </div>

      <LogPanel logs={logs} logEndRef={logEndRef} clearLogs={clearLogs} />
    </div>
  );
}
