(function (root) {
  function parseCsv(text) {
    const input = String(text || '').replace(/^\uFEFF/, '');
    // Detect one separator in the first logical row; decimal commas in a
    // semicolon-separated file must remain part of the cell value.
    const counts = { ';': 0, ',': 0, '\t': 0 };
    let quoted = false;
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') {
        if (quoted && input[i + 1] === '"') i++;
        else quoted = !quoted;
      } else if (!quoted) {
        if (ch === '\r' || ch === '\n') break;
        if (ch in counts) counts[ch]++;
      }
    }
    const delimiter = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
    const rows = [];
    let row = [], value = '';
    quoted = false;
    const finishRow = () => {
      row.push(value);
      if (row.some(cell => cell.trim() !== '')) rows.push(row);
      row = []; value = '';
    };
    for (let i = 0; i < input.length; i++) {
      const ch = input[i];
      if (ch === '"') {
        if (quoted && input[i + 1] === '"') { value += '"'; i++; }
        else quoted = !quoted;
      } else if (!quoted && ch === delimiter) {
        row.push(value); value = '';
      } else if (!quoted && (ch === '\r' || ch === '\n')) {
        if (ch === '\r' && input[i + 1] === '\n') i++;
        finishRow();
      } else value += ch;
    }
    if (quoted) throw new Error('CSV failā ir neaizvērtas pēdiņas. Saturs nav mainīts.');
    if (value || row.length) finishRow();
    return rows;
  }
  if (typeof module === 'object' && module.exports) module.exports = { parseCsv };
  else root.IpponTableImport = { parseCsv };
})(typeof globalThis === 'object' ? globalThis : this);
