import React, { useState, useEffect, useMemo } from 'react';

/**
 * Order Model Screen
 *
 * Renders the 3270 screen character-by-character (same as terminal view),
 * but overlays editable input fields at specific column positions for data rows.
 *
 * All row/col values are 1-based (matching terminal line numbers).
 *
 * Editable logic:
 * - If column D (cols 11-25) of a data row has non-space content, the row is active
 * - Active rows: columns a,b,g,h,i,j,k,l,m,n are editable (red background inputs)
 * - Inactive rows: grayed out, all read-only
 * - Block No (row 2, cols 21-25) is always editable
 */

/** Editable field definitions for data rows (rows 6-25) */
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

/** Character width in px — must match exactly for alignment */
const CHAR_W = 7.22;
const CHAR_H = 17;
const FONT_SIZE = '11.5px';

/** Extract substring from a line (1-based inclusive cols) */
function extract(line, startCol, endCol) {
  if (!line) return '';
  return line.substring(startCol - 1, endCol) || '';
}

function hasContent(str) {
  return str && str.trim().length > 0;
}

export default function OrderModelScreen({ screenLines, onBack, onSave }) {
  const [blockNo, setBlockNo] = useState('');
  const [fieldValues, setFieldValues] = useState({});

  // Initialize from screen data
  useEffect(() => {
    if (!screenLines || screenLines.length === 0) return;

    setBlockNo(extract(screenLines[BLOCK_NO_ROW - 1], BLOCK_NO_START, BLOCK_NO_END).trim());

    const vals = {};
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      const line = screenLines[row - 1] || '';
      for (const f of EDITABLE_FIELDS) {
        vals[`${row}-${f.id}`] = extract(line, f.startCol, f.endCol);
      }
    }
    setFieldValues(vals);
  }, [screenLines]);

  // Which rows have content in col D (11-25)?
  const activeRows = useMemo(() => {
    const result = {};
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      const line = screenLines ? screenLines[row - 1] || '' : '';
      result[row] = hasContent(extract(line, 11, 25));
    }
    return result;
  }, [screenLines]);

  const updateField = (row, fieldId, value) => {
    setFieldValues(prev => ({ ...prev, [`${row}-${fieldId}`]: value }));
  };

  // Collect all field positions for a given row into a Set for quick lookup
  const getEditableRanges = (row) => {
    if (!activeRows[row]) return null;
    const ranges = [];
    for (const f of EDITABLE_FIELDS) {
      ranges.push({ ...f, key: `${row}-${f.id}` });
    }
    return ranges;
  };

  // ============================================
  //  STYLES
  // ============================================
  const s = {
    root: {
      minHeight: '100vh',
      background: 'linear-gradient(145deg, #0a0a12 0%, #0d1117 50%, #0a0f18 100%)',
      color: '#c9d1d9',
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', 'Consolas', monospace",
      padding: '16px',
      maxWidth: '1250px',
      margin: '0 auto',
    },
    header: {
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      marginBottom: '12px', borderBottom: '1px solid #1e3a2a', paddingBottom: '10px',
    },
    title: { fontSize: '16px', fontWeight: 700, color: '#3eff8b', letterSpacing: '2px', textTransform: 'uppercase' },
    toolbar: { display: 'flex', gap: '8px', marginBottom: '12px' },
    btn: (variant) => {
      const v = { primary: { bg: '#0d4429', border: '#1e6d3e', color: '#3eff8b' },
        back: { bg: '#2d1f00', border: '#5a3d00', color: '#ffaa44' } }[variant]
        || { bg: '#161b22', border: '#30363d', color: '#c9d1d9' };
      return { padding: '6px 14px', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600,
        border: `1px solid ${v.border}`, borderRadius: '6px', background: v.bg,
        color: v.color, cursor: 'pointer', whiteSpace: 'nowrap' };
    },
    screenWrap: {
      background: '#0c0f14', border: '1px solid #1e3a2a', borderRadius: '8px',
      padding: '10px', marginBottom: '12px', overflowX: 'auto',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
    },
    row: (dimmed) => ({
      position: 'relative', height: `${CHAR_H}px`, lineHeight: `${CHAR_H}px`,
      whiteSpace: 'pre', fontSize: FONT_SIZE, display: 'flex',
      opacity: dimmed ? 0.3 : 1,
    }),
    lineNum: {
      color: '#3a4a5a', userSelect: 'none', width: '28px', textAlign: 'right',
      paddingRight: '6px', fontSize: '10px', flexShrink: 0, lineHeight: `${CHAR_H}px`,
    },
    lineText: {
      color: '#33ff77', whiteSpace: 'pre', fontSize: FONT_SIZE,
      letterSpacing: '0px', lineHeight: `${CHAR_H}px`, position: 'relative',
    },
    fieldOverlay: (startCol, charCount) => ({
      position: 'absolute',
      left: `${(startCol - 1) * CHAR_W}px`,
      width: `${charCount * CHAR_W}px`,
      top: '0px',
      height: `${CHAR_H}px`,
      fontSize: FONT_SIZE,
      fontFamily: 'inherit',
      color: '#ff8888',
      background: '#1a0e0e',
      border: 'none',
      borderBottom: '1px solid #5a3030',
      outline: 'none',
      padding: '0',
      margin: '0',
      lineHeight: `${CHAR_H}px`,
      letterSpacing: '0px',
      boxSizing: 'border-box',
    }),
    blockNoOverlay: {
      position: 'absolute',
      left: `${(BLOCK_NO_START - 1) * CHAR_W}px`,
      width: `${(BLOCK_NO_END - BLOCK_NO_START + 1) * CHAR_W}px`,
      top: '0px',
      height: `${CHAR_H}px`,
      fontSize: FONT_SIZE,
      fontFamily: 'inherit',
      color: '#ff8888',
      background: '#1a0e0e',
      border: 'none',
      borderBottom: '1px solid #6b4400',
      outline: 'none',
      padding: '0',
      margin: '0',
      lineHeight: `${CHAR_H}px`,
      letterSpacing: '0px',
      boxSizing: 'border-box',
    },
  };

  // ============================================
  //  RENDER
  // ============================================
  const totalRows = screenLines ? screenLines.length : 0;

  return (
    <div style={s.root}>
      <div style={s.header}>
        <div style={s.title}>Order Model - Parts Order</div>
      </div>

      <div style={s.toolbar}>
        <button style={s.btn('back')} onClick={onBack}>Back to Terminal</button>
        <button style={s.btn('primary')} onClick={() => onSave && onSave({ blockNo, fieldValues })}>
          Save Changes
        </button>
      </div>

      <div style={s.screenWrap}>
        {screenLines && screenLines.map((line, idx) => {
          const rowNum = idx + 1;
          const isDataRow = rowNum >= DATA_ROW_START && rowNum <= DATA_ROW_END;
          const isActive = isDataRow && activeRows[rowNum];
          const isDimmed = isDataRow && !isActive;

          return (
            <div key={idx} style={s.row(isDimmed)}>
              <span style={s.lineNum}>{String(rowNum).padStart(2, '0')}</span>
              <span style={s.lineText}>
                {/* Base text layer — full line from 3270 */}
                {line || ''}

                {/* Block No input overlay (row 2) */}
                {rowNum === BLOCK_NO_ROW && (
                  <input
                    style={s.blockNoOverlay}
                    value={blockNo}
                    onChange={(e) => setBlockNo(e.target.value)}
                    maxLength={BLOCK_NO_END - BLOCK_NO_START + 1}
                  />
                )}

                {/* Editable field overlays for active data rows */}
                {isActive && EDITABLE_FIELDS.map((f) => {
                  const key = `${rowNum}-${f.id}`;
                  const charCount = f.endCol - f.startCol + 1;
                  return (
                    <input
                      key={f.id}
                      style={s.fieldOverlay(f.startCol, charCount)}
                      value={fieldValues[key] || ''}
                      onChange={(e) => updateField(rowNum, f.id, e.target.value)}
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
}
