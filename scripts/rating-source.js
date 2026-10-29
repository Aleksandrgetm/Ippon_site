// Recover presentation only when the original HTML explicitly identifies a
// seasonal rating. Never infer seasons or change persisted source records.
function ratingHeading(html) {
  for (const match of String(html || '').matchAll(/<(strong|h[1-6]|caption)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const text = match[2].replace(/<[^>]*>/g, ' ').replace(/\\r\\n|\\[rn]/g, ' ')
      .replace(/&quot;/gi, '"').replace(/&amp;/gi, '&').replace(/&nbsp;/gi, ' ')
      .replace(/&#(?:39|039);|&apos;/gi, "'").replace(/\s+/g, ' ').trim();
    if (/\breitings\b/i.test(text) && /\bsezona\b/i.test(text)) return text;
  }
  return '';
}

function ratingPresentation(row, override, defaultType, structured) {
  const heading = defaultType === 'reitings' ? ratingHeading(row.content) : '';
  const hasRows = ['rows', 'rating_rows', 'system_rows'].some(key =>
    Array.isArray(structured?.[key]) && structured[key].length > 0);
  const recovered = Boolean(heading && override?.record_type === 'sacensibas'
    && override?.layout_type === 'competition_default' && !hasRows
    && /<table\b/i.test(override?.custom_html || row.content || ''));
  return {
    title: String(row.name || '').trim() || heading,
    recovered,
    recordType: recovered ? 'reitings' : (override?.record_type || defaultType),
    layoutType: recovered ? 'custom_html' : (override?.layout_type || 'custom_html')
  };
}

module.exports = { ratingHeading, ratingPresentation };
