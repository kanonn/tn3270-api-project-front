import React, { useState, useEffect, useMemo } from 'react';

/**
 * Order Model Screen
 *
 * Displays parts order data from 3270 screen with editable input fields.
 * Field positions are fixed based on the ANEMS TB03 screen layout.
 *
 * Row/col references are 1-based (matching the terminal display line numbers).
 * The 3270 screen data is passed via the screenLines prop.
 *
 * Editable rules:
 * - Row is editable only if column D (cols 11-25) has non-space characters
 * - When editable: columns a,b,g,h,i,j,k,l,m,n are input fields
 * - When not editable: entire row is grayed out
 * - Block No (row 2, cols 21-25) is always editable
 */

/** Column definitions for the data rows (rows 6-25) */
const COL_DEFS = [
  { id: 'a', startCol: 2,   endCol: 2,   editable: true },
  { id: 'b', startCol: 4,   endCol: 4,   editable: true },
  { id: 'c', startCol: 6,   endCol: 9,   editable: false },
  { id: 'd', startCol: 11,  endCol: 25,  editable: false },
  { id: 'e', startCol: 27,  endCol: 41,  editable: false },
  { id: 'f', startCol: 43,  endCol: 44,  editable: false },
  { id: 'g', startCol: 46,  endCol: 49,  editable: true },
  { id: 'h', startCol: 51,  endCol: 54,  editable: true },
  { id: 'i', startCol: 56,  endCol: 56,  editable: true },
  { id: 'j', startCol: 58,  endCol: 67,  editable: true },
  { id: 'k', startCol: 69,  endCol: 70,  editable: true },
  { id: 'l', startCol: 72,  endCol: 75,  editable: true },
  { id: 'm', startCol: 77,  endCol: 78,  editable: true },
  { id: 'n', startCol: 80,  endCol: 83,  editable: true },
  { id: 'o', startCol: 85,  endCol: 89,  editable: false },
  { id: 'p', startCol: 91,  endCol: 95,  editable: false },
  { id: 'q', startCol: 97,  endCol: 101, editable: false },
  { id: 'r', startCol: 103, endCol: 107, editable: false },
  { id: 's', startCol: 109, endCol: 113, editable: false },
  { id: 't', startCol: 115, endCol: 119, editable: false },
  { id: 'u', startCol: 121, endCol: 125, editable: false },
  { id: 'v', startCol: 127, endCol: 131, editable: false },
];

/** Data row range (1-based) */
const DATA_ROW_START = 6;
const DATA_ROW_END = 25;

/** Block No field position (1-based) */
const BLOCK_NO_ROW = 2;
const BLOCK_NO_START_COL = 21;
const BLOCK_NO_END_COL = 25;

/**
 * Extract substring from a screen line.
 * startCol/endCol are 1-based inclusive.
 */
function extractField(line, startCol, endCol) {
  if (!line) return '';
  return line.substring(startCol - 1, endCol) || '';
}

/**
 * Check if a string has any non-space visible characters
 */
function hasContent(str) {
  return str && str.trim().length > 0;
}

export default function OrderModelScreen({ screenLines, onBack, onSave, sessionId }) {
  // --- State for editable fields ---
  const [blockNo, setBlockNo] = useState('');
  const [rowData, setRowData] = useState({}); // { "6-a": "value", "6-b": "value", ... }

  // Initialize field values from screen data
  useEffect(() => {
    if (!screenLines || screenLines.length === 0) return;

    // Block No
    const blockLine = screenLines[BLOCK_NO_ROW - 1] || '';
    setBlockNo(extractField(blockLine, BLOCK_NO_START_COL, BLOCK_NO_END_COL).trim());

    // Data rows
    const newRowData = {};
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      const line = screenLines[row - 1] || '';
      for (const col of COL_DEFS) {
        const key = `${row}-${col.id}`;
        newRowData[key] = extractField(line, col.startCol, col.endCol);
      }
    }
    setRowData(newRowData);
  }, [screenLines]);

  // Determine which rows are active (have content in column D)
  const activeRows = useMemo(() => {
    const result = {};
    for (let row = DATA_ROW_START; row <= DATA_ROW_END; row++) {
      const dValue = rowData[`${row}-d`] || '';
      result[row] = hasContent(dValue);
    }
    return result;
  }, [rowData]);

  // Update a field value
  const updateField = (row, colId, value) => {
    setRowData(prev => ({ ...prev, [`${row}-${colId}`]: value }));
  };

  // Header rows (rows 1-5) displayed as plain text
  const headerLines = screenLines ? screenLines.slice(0, 5) : [];

  // Footer rows (rows 26+) displayed as plain text
  const footerLines = screenLines ? screenLines.slice(25) : [];

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
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '12px',
      borderBottom: '1px solid #1e3a2a',
      paddingBottom: '10px',
    },
    title: {
      fontSize: '16px',
      fontWeight: 700,
      color: '#3eff8b',
      letterSpacing: '2px',
      textTransform: 'uppercase',
    },
    toolbar: {
      display: 'flex',
      gap: '8px',
      marginBottom: '12px',
    },
    btn: (variant = 'default') => {
      const v = {
        default: { bg: '#161b22', border: '#30363d', color: '#c9d1d9' },
        primary: { bg: '#0d4429', border: '#1e6d3e', color: '#3eff8b' },
        action:  { bg: '#1a1e29', border: '#2d3548', color: '#7eb6ff' },
        back:    { bg: '#2d1f00', border: '#5a3d00', color: '#ffaa44' },
      }[variant] || { bg: '#161b22', border: '#30363d', color: '#c9d1d9' };
      return {
        padding: '6px 14px', fontSize: '12px', fontFamily: 'inherit', fontWeight: 600,
        border: `1px solid ${v.border}`, borderRadius: '6px', background: v.bg,
        color: v.color, cursor: 'pointer', whiteSpace: 'nowrap',
      };
    },
    screenWrap: {
      background: '#0c0f14',
      border: '1px solid #1e3a2a',
      borderRadius: '8px',
      padding: '10px',
      marginBottom: '12px',
      overflowX: 'auto',
      boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.5)',
    },
    headerLine: {
      fontSize: '11px',
      color: '#33ff77',
      lineHeight: '17px',
      whiteSpace: 'pre',
      height: '17px',
    },
    blockNoWrap: {
      display: 'inline',
    },
    blockNoInput: {
      width: '50px',
      padding: '1px 3px',
      fontSize: '11px',
      fontFamily: 'inherit',
      background: '#2a1a0a',
      border: '1px solid #6b4400',
      borderRadius: '2px',
      color: '#ff8888',
      outline: 'none',
    },
    dataRow: (active) => ({
      display: 'flex',
      alignItems: 'center',
      height: '20px',
      lineHeight: '20px',
      opacity: active ? 1 : 0.35,
      gap: '0px',
    }),
    lineNum: {
      color: '#3a4a5a',
      userSelect: 'none',
      width: '28px',
      textAlign: 'right',
      paddingRight: '6px',
      fontSize: '10px',
      flexShrink: 0,
    },
    cellInput: (width, editable) => ({
      width: `${width}ch`,
      padding: '0 2px',
      fontSize: '11px',
      fontFamily: 'inherit',
      background: editable ? '#1a0e0e' : 'transparent',
      border: editable ? '1px solid #3a2020' : '1px solid transparent',
      borderBottom: editable ? '1px solid #5a3030' : '1px solid #1a2a1a',
      borderRadius: '1px',
      color: editable ? '#ff8888' : '#33ff77',
      outline: 'none',
      height: '18px',
      lineHeight: '18px',
      boxSizing: 'border-box',
    }),
    cellReadonly: (width) => ({
      width: `${width}ch`,
      padding: '0 2px',
      fontSize: '11px',
      fontFamily: 'inherit',
      color: '#33ff77',
      height: '18px',
      lineHeight: '18px',
      display: 'inline-block',
      overflow: 'hidden',
      whiteSpace: 'pre',
    }),
    sep: {
      width: '1ch',
      display: 'inline-block',
      height: '18px',
    },
    footerLine: {
      fontSize: '11px',
      color: '#33ff77',
      lineHeight: '17px',
      whiteSpace: 'pre',
      height: '17px',
    },
  };

  // ============================================
  //  RENDER HELPERS
  // ============================================

  /** Render a header line with optional Block No input */
  const renderHeaderLine = (line, lineIdx) => {
    const rowNum = lineIdx + 1;

    // Row 2: embed Block No input field
    if (rowNum === BLOCK_NO_ROW && line) {
      const before = line.substring(0, BLOCK_NO_START_COL - 1);
      const after = line.substring(BLOCK_NO_END_COL);
      return (
        <div key={lineIdx} style={s.headerLine}>
          <span style={s.lineNum}>{String(rowNum).padStart(2, '0')}</span>
          {before}
          <input
            style={s.blockNoInput}
            value={blockNo}
            onChange={(e) => setBlockNo(e.target.value)}
            maxLength={BLOCK_NO_END_COL - BLOCK_NO_START_COL + 1}
          />
          {after}
        </div>
      );
    }

    return (
      <div key={lineIdx} style={s.headerLine}>
        <span style={s.lineNum}>{String(rowNum).padStart(2, '0')}</span>
        {line || ''}
      </div>
    );
  };

  /** Render a single data row with input fields */
  const renderDataRow = (row) => {
    const active = activeRows[row];

    return (
      <div key={row} style={s.dataRow(active)}>
        <span style={s.lineNum}>{String(row).padStart(2, '0')}</span>
        {COL_DEFS.map((col, idx) => {
          const key = `${row}-${col.id}`;
          const value = rowData[key] || '';
          const charWidth = col.endCol - col.startCol + 1;
          const isEditable = active && col.editable;

          return (
            <React.Fragment key={col.id}>
              {idx > 0 && <span style={s.sep} />}
              {isEditable ? (
                <input
                  style={s.cellInput(charWidth, true)}
                  value={value}
                  onChange={(e) => updateField(row, col.id, e.target.value)}
                  maxLength={charWidth}
                  disabled={!active}
                />
              ) : (
                <span style={s.cellReadonly(charWidth)}>
                  {value}
                </span>
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ============================================
  //  RENDER
  // ============================================
  return (
    <div style={s.root}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.title}>Order Model - Parts Order</div>
      </div>

      {/* Toolbar */}
      <div style={s.toolbar}>
        <button style={s.btn('back')} onClick={onBack}>
          Back to Terminal
        </button>
        <button style={s.btn('primary')} onClick={() => onSave && onSave({ blockNo, rowData })}>
          Save Changes
        </button>
      </div>

      {/* Screen content */}
      <div style={s.screenWrap}>
        {/* Header rows (1-5) */}
        {headerLines.map((line, i) => renderHeaderLine(line, i))}

        {/* Data rows (6-25) */}
        {Array.from({ length: DATA_ROW_END - DATA_ROW_START + 1 }, (_, i) =>
          renderDataRow(DATA_ROW_START + i)
        )}

        {/* Footer rows (26+) */}
        {footerLines.map((line, i) => (
          <div key={`footer-${i}`} style={s.footerLine}>
            <span style={s.lineNum}>{String(26 + i).padStart(2, '0')}</span>
            {line || ''}
          </div>
        ))}
      </div>
    </div>
  );
}
