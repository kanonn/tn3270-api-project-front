import API_BASE, { POC_CONFIG } from '../config';

/**
 * Shared 3270 automation helpers.
 * Used by both UketsukePage and TehaiKidoPage.
 */

export function screenText(lines, row, startCol, length) {
  if (!lines || row < 1 || row > lines.length) return '';
  const line = lines[row - 1] || '';
  return line.substring(startCol - 1, startCol - 1 + length);
}

export function delayMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function apiCall(method, path, body, sid) {
  const headers = { 'Content-Type': 'application/json' };
  if (sid) headers['X-Session-Id'] = sid;
  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API_BASE}${path}`, opts);
  return await res.json();
}

export function getLines(json) {
  return json?.data?.screenLines || [];
}

/**
 * Run login steps A-D (shared between Uketsuke and Tehai).
 * Returns { sid, lines } after F11.
 */
export async function runLoginStepsAtoD(label, logStep, logOk, logErr, logApi) {
  const D = POC_CONFIG.operationDelay;
  let json, lines, sid;

  // Step A: Connect
  logStep(`[${label}] Step A: Connecting...`);
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
    await delayMs(2000);
  }

  // Step B: Username + Enter
  logStep(`[${label}] Step B: Login...`);
  await delayMs(D);
  json = await apiCall('POST', '/menu/command', { row: 7, column: 10, command: POC_CONFIG.username }, sid);
  logApi('Write username row7', getLines(json));
  await delayMs(D);
  json = await apiCall('POST', '/menu/command', { row: 9, column: 12, command: POC_CONFIG.username }, sid);
  logApi('Write username row9', getLines(json));
  await delayMs(D);
  json = await apiCall('POST', '/key/enter', null, sid);
  lines = getLines(json);
  logApi('Enter', lines);

  // Step C: Verify + ANEMS
  logStep(`[${label}] Step C: Verify, enter ANEMS...`);
  const userCheck = screenText(lines, 7, 23, 8).trim();
  if (userCheck !== POC_CONFIG.username) {
    throw new Error(`Login verify failed. Expected "${POC_CONFIG.username}", got "${userCheck}"`);
  }
  logOk(`User "${userCheck}" confirmed.`);
  await delayMs(D);
  json = await apiCall('POST', '/menu/command', { row: 1, column: 2, command: 'ANEMS' }, sid);
  logApi('Write ANEMS', getLines(json));
  await delayMs(D);
  json = await apiCall('POST', '/key/enter', null, sid);
  lines = getLines(json);
  logApi('Enter after ANEMS', lines);

  // Step D: ANEMS(DESIGN) check
  logStep(`[${label}] Step D: ANEMS(DESIGN) check...`);
  const anems = screenText(lines, 5, 44, 14).trim();
  if (anems !== 'ANEMS(DESIGN)') {
    throw new Error(`Expected "ANEMS(DESIGN)", got "${anems}"`);
  }
  logOk('ANEMS(DESIGN) confirmed.');

  return { sid, lines };
}
