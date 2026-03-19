import React, { useState, useEffect, useMemo } from 'react';

/**
 * POC Edit Screen for TB03 Parts Order.
 *
 * Uses character-by-character rendering: each character in a line is a <span>.
 * Editable fields are rendered as <input> elements that REPLACE the character spans
 * at the exact column positions. No absolute positioning = no offset issues.
 *
 * POC-style theme (light background, red inputs).
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

const CW = '7.4px';  // character width
const CH = '18px';    // character height
const FS = '11.5px';  // font size

function extract(line, sc, ec) {
  if (!line) return '';
  return line.substring(sc - 1, ec) || '';
}

function hasContent(s) { return s && s.trim().length > 0; }

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

  const activeRows = useMemo(() => {
    const res = {};
    if (!screenLines) return res;
    for (let r = DATA_ROW_START; r <= DATA_ROW_END; r++) {
      // Row is editable only if cols 12-22 have non-space content
      res[r] = hasContent(extract(screenLines[r - 1] || '', 12, 22));
    }
    return res;
  }, [screenLines]);

  const updateField = (r, fid, val) => {
    setFields(prev => ({ ...prev, [`${r}-${fid}`]: val }));
  };

  // Build a map: for data rows, which columns are covered by which editable field?
  const getFieldMap = (rowNum) => {
    if (!activeRows[rowNum]) return null;
    const map = {}; // col (0-based) -> { fieldId, isStart, charCount }
    for (const f of EDITABLE_FIELDS) {
      for (let c = f.startCol; c <= f.endCol; c++) {
        map[c - 1] = { fieldId: f.id, isStart: c === f.startCol, charCount: f.endCol - f.startCol + 1 };
      }
    }
    return map;
  };

  // Same for blockNo on row 2
  const blockNoMap = {};
  for (let c = BLOCK_NO_START; c <= BLOCK_NO_END; c++) {
    blockNoMap[c - 1] = { isStart: c === BLOCK_NO_START, charCount: BLOCK_NO_END - BLOCK_NO_START + 1 };
  }

  const st = {
    wrap: {
      background: '#f7fafc', border: '2px solid #4299e1', borderRadius: '12px',
      padding: '16px', marginTop: '16px', overflowX: 'auto',
    },
    titleBar: {
      display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px',
    },
    titleText: { fontSize: '14px', fontWeight: 700, color: '#2b6cb0' },
    closeBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: '1px solid #cbd5e0',
      borderRadius: '6px', background: '#edf2f7', color: '#4a5568', cursor: 'pointer', marginRight: '8px',
    },
    saveBtn: {
      padding: '6px 16px', fontSize: '12px', fontWeight: 600, border: 'none',
      borderRadius: '6px', background: '#48bb78', color: '#fff', cursor: 'pointer',
    },
    row: (dimmed) => ({
      display: 'flex', height: CH, lineHeight: CH, whiteSpace: 'pre',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace",
      fontSize: FS, opacity: dimmed ? 0.3 : 1,
    }),
    lineNum: {
      color: '#a0aec0', userSelect: 'none', width: '28px', textAlign: 'right',
      paddingRight: '6px', fontSize: '10px', flexShrink: 0, lineHeight: CH,
    },
    char: {
      display: 'inline-block', width: CW, textAlign: 'center', height: CH, lineHeight: CH,
      color: '#2d3748', fontSize: FS,
    },
    editInput: (charCount) => ({
      display: 'inline-block', width: `calc(${CW} * ${charCount})`,
      height: CH, lineHeight: CH, fontSize: FS, fontFamily: 'inherit',
      color: '#c53030', background: '#fed7d7', border: 'none',
      borderBottom: '2px solid #fc8181', outline: 'none', padding: '0',
      margin: '0', boxSizing: 'border-box', textAlign: 'left',
    }),
    blockInput: (charCount) => ({
      display: 'inline-block', width: `calc(${CW} * ${charCount})`,
      height: CH, lineHeight: CH, fontSize: FS, fontFamily: 'inherit',
      color: '#c53030', background: '#fefcbf', border: 'none',
      borderBottom: '2px solid #dd6b20', outline: 'none', padding: '0',
      margin: '0', boxSizing: 'border-box', textAlign: 'left',
    }),
  };

  const renderLine = (line, idx) => {
    const rowNum = idx + 1;
    const isDataRow = rowNum >= DATA_ROW_START && rowNum <= DATA_ROW_END;
    const isActive = isDataRow && activeRows[rowNum];
    const isDimmed = isDataRow && !isActive;
    const fMap = isActive ? getFieldMap(rowNum) : null;
    const isBlockRow = rowNum === BLOCK_NO_ROW;
    const chars = (line || '').split('');

    const elements = [];
    let ci = 0;
    while (ci < chars.length) {
      // Check block no field (row 2)
      if (isBlockRow && blockNoMap[ci]) {
        if (blockNoMap[ci].isStart) {
          const cnt = blockNoMap[ci].charCount;
          elements.push(
            <input key={`blk-${ci}`} style={st.blockInput(cnt)} value={blockNo}
              onChange={(e) => setBlockNo(e.target.value)} maxLength={cnt} />
          );
          ci += cnt;
          continue;
        }
        // Non-start chars of block field are skipped (covered by input)
        ci++;
        continue;
      }

      // Check editable data field
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
          ci += charCount;
          continue;
        }
        ci++;
        continue;
      }

      // Normal character
      elements.push(
        <span key={ci} style={st.char}>{chars[ci]}</span>
      );
      ci++;
    }

    return (
      <div key={idx} style={st.row(isDimmed)}>
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
