(function () {
  const PLACEHOLDER = '/uploads/footer/footer.png';

  function normalizeImage(value) {
    const text = String(value || '').trim();
    if (!text) return '';
    if (/^(https?:)?\/\//i.test(text) || text.startsWith('/') || text.startsWith('data:')) return text;
    return '/uploads/' + text.replace(/^\/+/, '');
  }

  function pick(row, keys, fallback = '') {
    for (const key of keys) {
      if (row && row[key] != null && String(row[key]).trim() !== '') return String(row[key]).trim();
    }
    return fallback;
  }

  function getIdFromPath() {
    return decodeURIComponent(window.location.pathname.split('/').filter(Boolean).pop() || '');
  }

  function getIdFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get('id') || params.get('slug');
    if (queryId) return queryId;

    const parts = window.location.pathname.split('/').filter(Boolean);
    const last = parts[parts.length - 1] || '';
    if (/\.html?$/i.test(last)) return '';
    return decodeURIComponent(last);
  }

  function getTableName() {
    const path = window.location.pathname.toLowerCase();

    if (path.includes('treneri') || path.includes('treneris')) return 'ippon_trener';
    if (path.includes('sportisti') || path.includes('sportists')) return 'ippon_sportists';
    if (path.includes('jaunumi')) return 'ippon_news';
    if (path.includes('rezultati')) return 'ippon_results';

    return null;
  }

  async function fetchJson(url) {
    const response = await fetch(url);
    const text = await response.text();
    if (/^\s*</.test(text)) {
      console.error('API returned HTML instead of JSON:', url, text.slice(0, 200));
      throw new Error('API returned HTML instead of JSON');
    }
    let json = {};
    try {
      json = text ? JSON.parse(text) : {};
    } catch (error) {
      console.error('Invalid JSON from API:', url, text.slice(0, 200));
      throw error;
    }
    if (!response.ok) throw new Error(json.error || `HTTP ${response.status}`);
    return json;
  }

  async function fetchRows(tableNames, params = {}) {
    const names = Array.isArray(tableNames) ? tableNames : [tableNames];
    let lastError = null;
    for (const name of names) {
      const query = new URLSearchParams({ name, ...params });
      try {
        const data = await fetchJson('/api/table.php?' + query.toString());
        if (Array.isArray(data.rows)) {
          return {
            rows: data.rows,
            total: Number(data.total ?? data.rows.length),
          };
        }
      } catch (error) {
        lastError = error;
        console.error(error);
      }
    }
    if (lastError) throw lastError;
    return { rows: [], total: 0 };
  }

  function findById(rows, id) {
    return (Array.isArray(rows) ? rows : []).find((row) => String(row.id) === String(id)) || null;
  }

  async function loadSingleItem() {
    const id = getIdFromUrl();
    const table = getTableName();

    if (!id || !table) {
      console.error('Missing single page id or table name', { id, table, path: window.location.pathname });
      return null;
    }

    const data = await fetchRows(table, { limit: 500, offset: 0 });
    if (!Array.isArray(data.rows)) {
      console.error('Invalid response', data);
      return null;
    }

    const item = findById(data.rows, id);
    if (!item) {
      console.error('Not found', { id, table });
      return null;
    }

    return item;
  }

  window.siteDataApi = {
    PLACEHOLDER,
    normalizeImage,
    pick,
    getIdFromPath,
    getIdFromUrl,
    getTableName,
    fetchJson,
    fetchRows,
    findById,
    loadSingleItem,
  };
})();
