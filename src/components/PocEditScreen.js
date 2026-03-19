import React, { useState, useEffect, useMemo } from 'react';

/**
 * POC Edit Screen for TB03 Parts Order.
 *
 * Terminal dark theme: black background, dark blue text.
 * Editable fields: red text on black background (no red bg highlight).
 *
 * Active row check: cols 12-22 must have non-space, non-underscore-only content.
 * Opacity is always 1 (no dimming).
 */

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
const BLOCK_NO_START = 21;
const BLOCK_NO_END = 25;
const BLOCK_NO_ROW = 2;

const CW = '7.4px';
const CH = '18px';
const FS = '11.5px';

function extract(line, sc, ec) {
  if (!line) return '';
  return line.substring(sc - 1, ec) || '';
}

export default function PocEditScreen({ screenLines, onClose, onSave }) {
  const [blockNo, setBlockNo] = useState('');
  const [fields, setFields] = useState({});

  useEffect(() => {
    if (!screenLines || !screenLines.length) return;
    setBlockNo(extract(screenLines[BLOCK_NO_ROW - 1], BLOCK_NO_START, BLOCK_NO_END).trim());
    const v = {};
    for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
      const line = screenLines[r - 1] || '';
      for (const f of EDITABLE_FIELDS) {
        v[`${r}-${f.id}`] = extract(line, f.startCol, f.endCol);
      }
    }
    setFields(v);
  }, [screenLines]);

  // Active row: cols 12-22 must have content that is not just underscores
  const activeRows = useMemo(() => {
    const res = {};
    if (!screenLines) return res;
    for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
      const targetStr = extract(screenLines[r - 1] || '', 12, 22).trim();
      res[r] = targetStr.length > 0 && !/^_+$/.test(targetStr);
    }
    return res;
  }, [screenLines]);

  const updateField = (r, fid, val) => {
    setFields(prev => ({ ...prev, [`${r}-${fid}`]: val }));
  };

  const getFieldMap = (rowNum) => {
    if (!activeRows[rowNum]) return null;
    const map = {};
    for (const f of EDITABLE_FIELDS) {
      for (let c = f.startCol; c <= f.endCol; c++) {
        map[c - 1] = { fieldId: f.id, isStart: c === f.startCol, charCount: f.endCol - f.startCol + 1 };
      }
    }
    return map;
  };

  const blockNoMap = {};
  for (let c = BLOCK_NO_START; c <= BLOCK_NO_END; c++) {
    blockNoMap[c - 1] = { isStart: c === BLOCK_NO_START, charCount: BLOCK_NO_END - BLOCK_NO_START + 1 };
  }

  // Terminal dark theme styles
  const st = {
    wrap: {
      background: '#0a0f14', border: '1px solid #1e3a5a', borderRadius: '10px',
      padding: '16px', marginTop: '16px', overflowX: 'auto',
    },
    titleBar: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
    },
    titleText: { fontSize: '14px', fontWeight: 700, color: '#5a9fd4', letterSpacing: '1px' },
    closeBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: '1px solid #2a4a6a',
      borderRadius: '6px', background: '#0e1a2a', color: '#7ab8e0', cursor: 'pointer', marginRight: '8px',
    },
    saveBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: 'none',
      borderRadius: '6px', background: '#1a6a3a', color: '#3eff8b', cursor: 'pointer',
    },
    // Opacity always 1 — no dimming
    row: () => ({
      display: 'flex', height: CH, lineHeight: CH, whiteSpace: 'pre',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: FS, opacity: 1,
    }),
    lineNum: {
      color: '#2a4a6a', userSelect: 'none', width: '28px', textAlign: 'right',
      paddingRight: '6px', fontSize: '10px', flexShrink: 0, lineHeight: CH,
    },
    // Normal character: dark blue on black
    char: {
      display: 'inline-block', width: CW, textAlign: 'center', height: CH, lineHeight: CH,
      color: '#4a7ab8', fontSize: FS,
    },
    // Editable input: red text on black background (no red bg)
    editInput: (charCount) => ({
      display: 'inline-block', width: `calc(${CW} * ${charCount})`,
      height: CH, lineHeight: CH, fontSize: FS, fontFamily: 'inherit',
      color: '#ff6666', background: '#0a0f14', border: 'none',
      borderBottom: '1px solid #3a2020', outline: 'none', padding: '0',
      margin: '0', boxSizing: 'border-box', textAlign: 'left',
    }),
    // Block No input: orange text on black
    blockInput: (charCount) => ({
      display: 'inline-block', width: `calc(${CW} * ${charCount})`,
      height: CH, lineHeight: CH, fontSize: FS, fontFamily: 'inherit',
      color: '#ffaa44', background: '#0a0f14', border: 'none',
      borderBottom: '1px solid #4a3a1a', outline: 'none', padding: '0',
      margin: '0', boxSizing: 'border-box', textAlign: 'left',
    }),
  };

  const renderLine = (line, idx) => {
    const rowNum = idx + 1;
    const isDataRow = rowNum >= DATA_ROW_START && rowNum <= DATA_ROW_END;
    const isActive = isDataRow && activeRows[rowNum];
    const fMap = isActive ? getFieldMap(rowNum) : null;
    const isBlockRow = rowNum === BLOCK_NO_ROW;
    const chars = (line || '').split('');

    const elements = [];
    let ci = 0;
    while (ci < chars.length) {
      if (isBlockRow && blockNoMap[ci]) {
        if (blockNoMap[ci].isStart) {
          const cnt = blockNoMap[ci].charCount;
          elements.push(
            <input key={`blk-${ci}`} style={st.blockInput(cnt)} value={blockNo}
              onChange={(e) => setBlockNo(e.target.value)} maxLength={cnt} />
          );
          ci += cnt; continue;
        }
        ci++; continue;
      }

      if (fMap && fMap[ci]) {
        if (fMap[ci].isStart) {
          const { fieldId, charCount } = fMap[ci];
          const key = `${rowNum}-${fieldId}`;
          elements.push(
            <input key={`f-${ci}`} style={st.editInput(charCount)}
              value={fields[key] || ''}
              onChange={(e) => updateField(rowNum, fieldId, e.target.value)}
              maxLength={charCount} />
          );
          ci += charCount; continue;
        }
        ci++; continue;
      }

      elements.push(<span key={ci} style={st.char}>{chars[ci]}</span>);
      ci++;
    }

    return (
      <div key={idx} style={st.row()}>
        <span style={st.lineNum}>{String(rowNum).padStart(2, '0')}</span>
        <span style={{ display: 'flex' }}>{elements}</span>
      </div>
    );
  };

  return (
    <div style={st.wrap}>
      <div style={st.titleBar}>
        <div style={st.titleText}>Edit Mode - TB03 Parts Order</div>
        <div>
          <button style={st.closeBtn} onClick={onClose}>Close Edit</button>
          <button style={st.saveBtn} onClick={() => onSave && onSave({ blockNo, fields })}>Save</button>
        </div>
      </div>
      <div style={{ overflowX: 'auto' }}>
        {screenLines && screenLines.map((line, idx) => renderLine(line, idx))}
      </div>
    </div>
  );
}
