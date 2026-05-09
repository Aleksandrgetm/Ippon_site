const http = require('http');
const fs = require('fs');
const path = require('path');
const Database = require('better-sqlite3');


const ROOT = __dirname;

const DEFAULT_DB_PATH = path.join(ROOT, 'data', 'ippon.db');
const DB_PATH = path.resolve(process.env.DB_PATH || DEFAULT_DB_PATH);
const ENV_PATH = path.join(ROOT, '.env');

const db = new Database(DB_PATH);
console.log('SQLite подключена')

loadEnvFile(ENV_PATH);

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';
const DB_DIR = path.dirname(DB_PATH);
const SPACES_PUBLIC_BASE = String(process.env.SPACES_PUBLIC_BASE || 'https://ippon.fra1.digitaloceanspaces.com').replace(/\/+$/, '');
const UPLOADS_DIR = path.join(ROOT, 'uploads');
const NEWS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'news');
const RULES_UPLOADS_DIR = path.join(UPLOADS_DIR, 'rules');
const HALLS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'halls');
const NODARBIBAS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'nodarbibas');
const TRAINERS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'trainers');
const RESULTS_UPLOADS_DIR = path.join(UPLOADS_DIR, 'results');
const SADARBIBA_UPLOADS_DIR = path.join(UPLOADS_DIR, 'sadarbiba');
const GALLERY_UPLOADS_DIR = path.join(UPLOADS_DIR, 'gallery');
const LEGACY_IMPORT_DIR = path.join(ROOT, 'legacy_import');

const DUMP_FILES = [
  path.join(LEGACY_IMPORT_DIR, 'ippon_galery.sql'),
  path.join(LEGACY_IMPORT_DIR, 'ippon_images.sql'),
  path.join(LEGACY_IMPORT_DIR, 'ippon_results.sql'),
  path.join(LEGACY_IMPORT_DIR, 'ippon_sorevnovanija.sql'),
  path.join(LEGACY_IMPORT_DIR, 'ippon_sportists.sql')
];

const ALLOWED_TABLES = new Set([
  'ippon_galery',
  'ippon_images',
  'ippon_results',
  'ippon_sorevnovanija',
  'ippon_sportists',
  'sportisti_sasniegumi',
  'jaunumi',
  'treneri',
  'kluba_noteikumi',
  'zales_imanta',
  'zales_zolitude',
  'zales_sloka',
  'nodarbibas_saraksts',
  'nodarbibas_izlases_grupas',
  'nodarbibas_individualas_nodarbibas',
  'sadarbiba_sporta_zales_ire',
  'sadarbiba_sponsoru_atbalsts',
  'sadarbiba_musu_partneri',
  'video_galerija',
  'raksti_prese'
]);

const HALL_TABLES = {
  imanta: {
    table: 'zales_imanta',
    title: 'SPORTA ZALE RIGA (IMANTA)',
    intro: 'Kluba IPPON.LV Rigas (Imantas) filiale atrodas biznesa parka ABAVA telpas.'
  },
  zolitude: {
    table: 'zales_zolitude',
    title: 'SPORTA ZALE RIGA (ZOLITUDE)',
    intro: 'Kluba IPPON.LV Rigas (Zolitudes) filiale piedava musdienigu un ertu treninu vidi.'
  },
  sloka: {
    table: 'zales_sloka',
    title: 'SPORTA ZALE JURMALA (SLOKA)',
    intro: 'Kluba IPPON.LV Jurmalas (Slokas) filiale ir aprikota karate treniniem un fiziskai sagatavosanai.'
  }
};
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2'
};

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const unquoted = rawValue.replace(/^(['"])(.*)\1$/, '$2');
    if (key && process.env[key] == null) {
      process.env[key] = unquoted;
    }
  }
}

function logSqliteError(context, error) {
  const details = error && error.message ? error.message : String(error);
  console.error(`[sqlite] ${context}: ${details}`);
  if (error && error.code) {
    console.error(`[sqlite] code: ${error.code}`);
  }
}

function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

ensureDir(DB_DIR);
ensureDir(UPLOADS_DIR);
ensureDir(NEWS_UPLOADS_DIR);
ensureDir(RULES_UPLOADS_DIR);
ensureDir(HALLS_UPLOADS_DIR);
ensureDir(NODARBIBAS_UPLOADS_DIR);
ensureDir(TRAINERS_UPLOADS_DIR);
ensureDir(RESULTS_UPLOADS_DIR);
ensureDir(SADARBIBA_UPLOADS_DIR);
ensureDir(GALLERY_UPLOADS_DIR);

if (!fs.existsSync(DB_PATH)) {
  console.warn(`[startup] SQLite database not found at ${DB_PATH}`);
  console.warn('[startup] If this is a fresh server, copy data/ippon.db before starting or add SQL dumps to legacy_import/.');
}


function nowTs() {
  return Math.floor(Date.now() / 1000);
}

function slugify(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

const UPLOAD_SCOPE_TO_CATEGORY = {
  news: 'news',
  halls: 'halls',
  nodarbibas: 'nodarbibas',
  sportists: 'athletes',
  athletes: 'athletes',
  treneri: 'trainers',
  trainers: 'trainers',
  sadarbiba: 'sadarbiba',
  gallery: 'gallery',
  events: 'events',
  rezultati: 'results',
  results: 'results',
  rules: 'rules',
  calendar: 'events',
  raksti_prese: 'raksti-prese'
};

function sanitizeStorageSegment(input, fallback = 'item') {
  const value = String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[\\/]+/g, '-')
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-._]+|[-._]+$/g, '')
    .slice(0, 120);
  return value || fallback;
}

function normalizeUploadCategory(rawCategory, rawScope) {
  const direct = sanitizeStorageSegment(rawCategory, '').replace(/\.+/g, '-');
  if (!direct) {
    throw new Error('Upload category is required');
  }
  return UPLOAD_SCOPE_TO_CATEGORY[direct] || direct;
}

function normalizeEntityId(rawEntityId) {
  const value = String(rawEntityId ?? '').trim();
  if (!value) {
    throw new Error('Upload entityId is required');
  }
  return sanitizeStorageSegment(value, 'item');
}

function normalizeUploadSubPath(rawSubPath) {
  const input = Array.isArray(rawSubPath)
    ? rawSubPath
    : String(rawSubPath || '').split(/[\\/]+/);
  return input
    .map((segment) => sanitizeStorageSegment(segment, ''))
    .filter(Boolean)
    .slice(0, 4);
}

function normalizeFileExtension(rawExt) {
  const ext = String(rawExt || '').toLowerCase().replace(/^\.+/, '');
  if (!ext) return '';
  if (ext === 'jpeg') return 'jpg';
  return ext.replace(/[^a-z0-9]+/g, '').slice(0, 10);
}

function stripExtensionArtifacts(baseName, normalizedExt) {
  let next = String(baseName || '').trim();
  if (!next) return next;
  const escapedExt = normalizedExt.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const duplicateExtPattern = new RegExp(`(?:\\.${escapedExt}(?:-\\d+)?)$`, 'i');
  while (duplicateExtPattern.test(next)) {
    next = next.replace(duplicateExtPattern, '');
  }
  while (/\.[a-z0-9]{1,10}$/i.test(next)) {
    next = next.replace(/\.[a-z0-9]{1,10}$/i, '');
  }
  return next;
}

function sanitizeUploadFileName(originalName, preferredExt, fallbackStem = 'file') {
  const rawName = path.basename(String(originalName || '').trim()) || fallbackStem;
  const normalizedExt = normalizeFileExtension(preferredExt || path.extname(rawName));
  const rawStem = rawName.slice(0, rawName.length - path.extname(rawName).length) || fallbackStem;
  const cleanedStem = sanitizeStorageSegment(stripExtensionArtifacts(rawStem, normalizedExt), fallbackStem)
    .replace(/\.+/g, '-');
  return normalizedExt ? `${cleanedStem}.${normalizedExt}` : cleanedStem;
}

function buildUploadStorageKey({ category, entityId, subPath = [], fileName }) {
  return ['uploads', category, entityId, ...subPath, fileName].join('/');
}

function buildPublicUploadUrl(storageKey) {
  return `${SPACES_PUBLIC_BASE}/${String(storageKey || '').replace(/^\/+/, '')}`;
}

function uploadKeyToLocalPath(storageKey) {
  const parts = String(storageKey || '').replace(/^\/+/, '').split('/').filter(Boolean);
  return path.join(ROOT, ...parts);
}

function resolveUploadTarget(options = {}) {
  const category = normalizeUploadCategory(options.category, options.scope);
  const entityId = normalizeEntityId(options.entityId ?? options.id ?? options.itemId);
  const subPath = normalizeUploadSubPath(options.subPath ?? options.pathSegments ?? options.path);
  const fileName = sanitizeUploadFileName(options.fileName, options.ext, options.fallbackStem);
  const storageKey = buildUploadStorageKey({ category, entityId, subPath, fileName });
  return {
    category,
    entityId,
    subPath,
    fileName,
    storageKey,
    localPath: uploadKeyToLocalPath(storageKey),
    publicUrl: buildPublicUploadUrl(storageKey)
  };
}

function uniqueNewsSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug) || `jaunums-${nowTs()}`;
  let candidate = base;
  let i = 2;

  while (true) {
    let row;
    if (excludeId == null) {
      row = db.prepare('SELECT id FROM jaunumi WHERE slug = ? LIMIT 1').get(candidate);
    } else {
      row = db.prepare('SELECT id FROM jaunumi WHERE slug = ? AND id <> ? LIMIT 1').get(candidate, excludeId);
    }
    if (!row) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

function uniqueTrainerSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug) || `treneris-${nowTs()}`;
  let candidate = base;
  let i = 2;

  while (true) {
    let row;
    if (excludeId == null) {
      row = db.prepare('SELECT id FROM treneri WHERE slug = ? LIMIT 1').get(candidate);
    } else {
      row = db.prepare('SELECT id FROM treneri WHERE slug = ? AND id <> ? LIMIT 1').get(candidate, excludeId);
    }
    if (!row) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

const REZULTATI_RECORD_TYPES = new Set(['sacensibas', 'eksamens', 'reitings']);
const REZULTATI_LAYOUT_TYPES = new Set([
  'competition_default',
  'exam_simple_table',
  'exam_with_gallery',
  'rating_two_tables',
  'rating_custom_table',
  'custom_html'
]);
const REZULTATI_SOURCE_TABLES = new Set(['ippon_sorevnovanija', 'ippon_galery', 'ippon_text']);
const EXAM_KEYWORDS = [
  'eksamens',
  'eksamena',
  'eksamenu',
  'eksāmens',
  'eksāmena',
  'экзамен',
  'exam'
];
const EXAM_EXCLUDE_KEYWORDS = ['ekskurs', 'экскурс'];
const REITING_KEYWORDS = [
  'reitings',
  'reiting',
  'sezonas reitings',
  'sezonas reiting'
];
const KALENDARS_KEYWORDS = [
  'kalendars',
  'kalendars',
  'pasakumu kalendars',
  'pasakumu kalendars',
  'calendar'
];

function defaultLayoutForRecordType(recordType) {
  if (recordType === 'eksamens') return 'exam_simple_table';
  if (recordType === 'reitings') return 'rating_two_tables';
  return 'competition_default';
}

function normalizeRezultatiRecordType(value) {
  const next = String(value || '').trim().toLowerCase();
  return REZULTATI_RECORD_TYPES.has(next) ? next : 'sacensibas';
}

function normalizeRezultatiLayoutType(value, recordType) {
  const next = String(value || '').trim().toLowerCase();
  if (REZULTATI_LAYOUT_TYPES.has(next)) return next;
  return defaultLayoutForRecordType(normalizeRezultatiRecordType(recordType));
}

function parseStructuredDataObject(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'object') return raw;
  const text = String(raw || '').trim();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function stringifyStructuredData(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (!text) return null;
    const parsed = parseStructuredDataObject(text);
    if (parsed == null) return null;
    return JSON.stringify(parsed);
  }
  if (typeof raw === 'object') {
    return JSON.stringify(raw);
  }
  return null;
}

function uniqueRezultatiSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug) || `rezultati-${nowTs()}`;
  let candidate = base;
  let i = 2;
  while (true) {
    let row;
    if (excludeId == null) {
      row = db.prepare('SELECT id FROM ippon_sorevnovanija WHERE slug = ? LIMIT 1').get(candidate);
    } else {
      row = db.prepare('SELECT id FROM ippon_sorevnovanija WHERE slug = ? AND id <> ? LIMIT 1').get(candidate, excludeId);
    }
    if (!row) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

function uniqueManualRezultatiSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug) || `manual-${nowTs()}`;
  let candidate = base;
  let i = 2;

  while (true) {
    let row;
    if (excludeId == null) {
      row = db.prepare('SELECT id FROM ippon_rezultati_records WHERE slug = ? LIMIT 1').get(candidate);
    } else {
      row = db.prepare('SELECT id FROM ippon_rezultati_records WHERE slug = ? AND id <> ? LIMIT 1').get(candidate, excludeId);
    }
    if (!row) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

function uniqueKalendarsSlug(baseSlug, excludeId = null) {
  const base = slugify(baseSlug) || `kalendars-${nowTs()}`;
  let candidate = base;
  let i = 2;
  while (true) {
    let row;
    if (excludeId == null) {
      row = db.prepare('SELECT id FROM ippon_kalendars_records WHERE slug = ? LIMIT 1').get(candidate);
    } else {
      row = db.prepare('SELECT id FROM ippon_kalendars_records WHERE slug = ? AND id <> ? LIMIT 1').get(candidate, excludeId);
    }
    if (!row) return candidate;
    candidate = `${base}-${i}`;
    i += 1;
  }
}

function ensureJaunumiTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS jaunumi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datums TEXT NOT NULL,
      nosaukums TEXT NOT NULL,
      foto_attels TEXT,
      galerija TEXT,
      ievads TEXT,
      zina TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      position INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM jaunumi').get().c;
  if (count > 0) return;

  const seedRows = [
    {
      datums: '03.02.2026',
      nosaukums: 'Budapest Open 2024',
      foto_attels: 'https://club-wp.eu/wp-content/uploads/2024/10/IMG_3676-1024x683.jpg',
      ievads: 'MÅ«su sportisti veiksmÄ«gi piedalÄ«jÄs vienÄ no lielÄkajiem turnÄ«riem EiropÄ.',
      zina: 'MÅ«su sportisti veiksmÄ«gi piedalÄ«jÄs vienÄ no lielÄkajiem turnÄ«riem EiropÄ. Komanda demonstrÄ“ja stabilu tehniku, disciplÄ«nu un izcilu raksturu visÄs cÄ«Å†Äs.'
    },
    {
      datums: '03.02.2026',
      nosaukums: 'Latvijas KaratÄ“ ÄempionÄts 2024',
      foto_attels: 'https://club-wp.eu/wp-content/uploads/2024/10/IMG_2116-1024x683.jpg',
      ievads: 'Komanda demonstrÄ“ja augstu disciplÄ«nu un izcilus rezultÄtus nacionÄlajÄs sacensÄ«bÄs.',
      zina: 'Latvijas ÄempionÄtÄ mÅ«su sportisti izcÄ«nÄ«ja vairÄkas godalgas. Pateicamies treneriem un vecÄkiem par ieguldÄ«jumu sportistu attÄ«stÄ«bÄ.'
    },
    {
      datums: '03.02.2026',
      nosaukums: 'UzÅ†emÅ¡ana',
      foto_attels: 'https://club-wp.eu/wp-content/uploads/2025/09/463784438_1064866684998728_2161927365756605866_n-1024x683.jpg',
      ievads: 'AicinÄm zÄ“nus un meitenes no 4 gadiem uz nodarbÄ«bÄm.',
      zina: 'AicinÄm zÄ“nus un meitenes no 4 gadu vecuma pievienoties karatÄ“ nodarbÄ«bÄm. TreniÅ†i notiek draudzÄ«gÄ un droÅ¡Ä vidÄ“ pieredzÄ“juÅ¡u treneru vadÄ«bÄ.'
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO jaunumi (datums, nosaukums, foto_attels, galerija, ievads, zina, slug, position, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const ts = nowTs();
  for (const row of seedRows) {
    stmt.run(
      row.datums,
      row.nosaukums,
      row.foto_attels,
      null,
      row.ievads,
      row.zina,
      uniqueNewsSlug(row.nosaukums),
      0,
      ts,
      ts
    );
  }
}

function ensureTreneriTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS treneri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      vards_uzvards TEXT NOT NULL,
      dzimsanas_datums TEXT,
      foto_attels TEXT,
      galerija TEXT,
      izglitiba TEXT,
      josta TEXT,
      saka_studet TEXT,
      koucinga_pieredze TEXT,
      par_mani TEXT,
      sasniegumi TEXT,
      slug TEXT NOT NULL UNIQUE,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function ensureKlubaNoteikumiTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kluba_noteikumi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      faili TEXT,
      teksts TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM kluba_noteikumi').get().c;
  if (count > 0) return;

  const seedRows = [
    {
      teksts: 'TreniÅ†os ievÄ“rojam cieÅ†pilnu attieksmi pret treneriem, sportistiem un inventÄru.',
      faili: null
    },
    {
      teksts: 'Uz nodarbÄ«bÄm ierodamies vismaz 10 minÅ«tes pirms sÄkuma, sagatavotÄ formÄ.',
      faili: null
    }
  ];

  const stmt = db.prepare(`
    INSERT INTO kluba_noteikumi (faili, teksts, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `);
  const ts = nowTs();
  for (const row of seedRows) {
    stmt.run(row.faili, row.teksts, ts, ts);
  }
}

function ensureSingleHallTable(tableName, seedTitle, seedIntro) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ${tableName} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums TEXT NOT NULL,
      ievads TEXT,
      attels TEXT,
      galerija TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare(`SELECT COUNT(*) AS c FROM ${tableName}`).get().c;
  if (count > 0) return;

  const ts = nowTs();
  db.prepare(`
    INSERT INTO ${tableName} (nosaukums, ievads, attels, galerija, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(seedTitle, seedIntro, null, '[]', ts, ts);
}

function ensureHallsTables() {
  ensureSingleHallTable(
    HALL_TABLES.imanta.table,
    HALL_TABLES.imanta.title,
    HALL_TABLES.imanta.intro
  );
  ensureSingleHallTable(
    HALL_TABLES.zolitude.table,
    HALL_TABLES.zolitude.title,
    HALL_TABLES.zolitude.intro
  );
  ensureSingleHallTable(
    HALL_TABLES.sloka.table,
    HALL_TABLES.sloka.title,
    HALL_TABLES.sloka.intro
  );
}

function ensureNodarbibasSarakstsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodarbibas_saraksts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      attels TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM nodarbibas_saraksts').get().c;
  if (count > 0) return;

  const ts = nowTs();
  db.prepare(`
    INSERT INTO nodarbibas_saraksts (attels, created_at, updated_at)
    VALUES (?, ?, ?)
  `).run(null, ts, ts);
}

function ensureNodarbibasIzlasesGrupasTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodarbibas_izlases_grupas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ievads TEXT,
      attels TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM nodarbibas_izlases_grupas').get().c;
  if (count > 0) return;

  const ts = nowTs();
  db.prepare(`
    INSERT INTO nodarbibas_izlases_grupas (ievads, attels, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run('', null, ts, ts);
}

function ensureNodarbibasIndividualasNodarbibasTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS nodarbibas_individualas_nodarbibas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ievads TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const count = db.prepare('SELECT COUNT(*) AS c FROM nodarbibas_individualas_nodarbibas').get().c;
  if (count > 0) return;

  const ts = nowTs();
  db.prepare(`
    INSERT INTO nodarbibas_individualas_nodarbibas (ievads, created_at, updated_at)
    VALUES (?, ?, ?)
  `).run('', ts, ts);
}

function ensureTableColumn(tableName, columnName, columnSql) {
  const exists = db.prepare(`PRAGMA table_info(${tableName})`).all().some((col) => col.name === columnName);
  if (!exists) {
    db.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnSql}`);
  }
}

function ensureSportistiMediaColumns() {
  ensureTableColumn('ippon_sportists', 'foto_attels', 'TEXT');
  ensureTableColumn('ippon_sportists', 'galerija', 'TEXT');
  ensureTableColumn('ippon_sportists', 'is_hidden', 'INTEGER NOT NULL DEFAULT 0');
  ensureTableColumn('ippon_sportists', 'position', 'INTEGER NOT NULL DEFAULT 0');
}

function ensureJaunumiMediaColumns() {
  ensureTableColumn('jaunumi', 'galerija', 'TEXT');
  ensureTableColumn('jaunumi', 'position', 'INTEGER NOT NULL DEFAULT 0');
}

function ensureRezultatiSchema() {
  ensureTableColumn('ippon_sorevnovanija', 'record_type', "TEXT DEFAULT 'sacensibas'");
  ensureTableColumn('ippon_sorevnovanija', 'layout_type', "TEXT DEFAULT 'competition_default'");
  ensureTableColumn('ippon_sorevnovanija', 'slug', 'TEXT');
  ensureTableColumn('ippon_sorevnovanija', 'foto_attels', 'TEXT');
  ensureTableColumn('ippon_sorevnovanija', 'galerija', 'TEXT');
  ensureTableColumn('ippon_sorevnovanija', 'structured_data', 'TEXT');
  ensureTableColumn('ippon_sorevnovanija', 'custom_html', 'TEXT');
  ensureTableColumn('ippon_sorevnovanija', 'created_at', 'INTEGER');
  ensureTableColumn('ippon_sorevnovanija', 'updated_at', 'INTEGER');

  db.exec(`
    UPDATE ippon_sorevnovanija
    SET record_type = 'sacensibas'
    WHERE record_type IS NULL
       OR TRIM(record_type) = ''
       OR record_type NOT IN ('sacensibas', 'eksamens', 'reitings')
       OR record_type IN ('eksamens', 'reitings')
  `);
  db.exec(`
    UPDATE ippon_sorevnovanija
    SET layout_type = CASE
      WHEN record_type = 'sacensibas' THEN 'competition_default'
      WHEN record_type = 'eksamens' AND COALESCE(galery_id, 0) > 0 THEN 'exam_with_gallery'
      WHEN record_type = 'eksamens' THEN 'exam_simple_table'
      WHEN record_type = 'reitings' THEN 'rating_custom_table'
      ELSE 'competition_default'
    END
    WHERE layout_type IS NULL
       OR TRIM(layout_type) = ''
       OR layout_type NOT IN (
         'competition_default',
         'exam_simple_table',
         'exam_with_gallery',
         'rating_two_tables',
         'rating_custom_table',
         'custom_html'
       )
       OR (record_type = 'eksamens' AND layout_type = 'competition_default')
       OR (record_type = 'reitings' AND layout_type = 'competition_default')
  `);
  db.exec(`
    UPDATE ippon_sorevnovanija
    SET created_at = COALESCE(c_time, ${nowTs()})
    WHERE created_at IS NULL
  `);
  db.exec(`
    UPDATE ippon_sorevnovanija
    SET updated_at = COALESCE(m_time, c_time, ${nowTs()})
    WHERE updated_at IS NULL
  `);

  const rowsWithoutSlug = db.prepare(`
    SELECT id, name_lv, name_ru, name_en
    FROM ippon_sorevnovanija
    WHERE slug IS NULL OR TRIM(slug) = ''
    ORDER BY id ASC
  `).all();

  const updateSlugStmt = db.prepare('UPDATE ippon_sorevnovanija SET slug = ? WHERE id = ?');
  for (const row of rowsWithoutSlug) {
    const base = String(row.name_lv || row.name_ru || row.name_en || `rezultati-${row.id}`).trim();
    const slug = uniqueRezultatiSlug(base, row.id);
    updateSlugStmt.run(slug, row.id);
  }
}

function ensureRezultatiManualTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ippon_rezultati_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT,
      image TEXT,
      slug TEXT NOT NULL UNIQUE,
      record_type TEXT NOT NULL DEFAULT 'reitings',
      layout_type TEXT NOT NULL DEFAULT 'rating_two_tables',
      structured_data TEXT,
      custom_html TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ippon_rezultati_source_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_table TEXT NOT NULL,
      source_id INTEGER NOT NULL,
      record_type TEXT,
      layout_type TEXT,
      slug_override TEXT,
      structured_data TEXT,
      custom_html TEXT,
      image_override TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE(source_table, source_id)
    )
  `);
}

function ensureKalendarsTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS ippon_kalendars_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      date TEXT,
      image TEXT,
      slug TEXT NOT NULL UNIQUE,
      content_html TEXT,
      is_published INTEGER NOT NULL DEFAULT 1,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  db.exec(`
    CREATE TABLE IF NOT EXISTS ippon_kalendars_source_overrides (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_id INTEGER NOT NULL UNIQUE,
      title_override TEXT,
      date_override TEXT,
      image_override TEXT,
      content_override TEXT,
      slug_override TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function ensureSadarbibaSportaZalesIreTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sadarbiba_sporta_zales_ire (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums TEXT,
      saturs TEXT,
      foto_attels TEXT,
      galerija TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const hasAny = db.prepare('SELECT id FROM sadarbiba_sporta_zales_ire LIMIT 1').get();
  if (hasAny) {
    const existing = db.prepare('SELECT * FROM sadarbiba_sporta_zales_ire ORDER BY id DESC LIMIT 1').get();
    if (existing) {
      const resolved = resolveSadarbibaSportaZalesIreMedia(existing);
      const existingFoto = String(existing.foto_attels || '').trim();
      const existingGal = parseGallery(existing.galerija);
      const changedGallery = JSON.stringify(existingGal) !== JSON.stringify(resolved.galerija);
      if ((!existingFoto && resolved.foto_attels) || changedGallery) {
        db.prepare(`
          UPDATE sadarbiba_sporta_zales_ire
          SET foto_attels = ?, galerija = ?, updated_at = ?
          WHERE id = ?
        `).run(
          resolved.foto_attels,
          resolved.galerija.length ? JSON.stringify(resolved.galerija) : null,
          nowTs(),
          existing.id
        );
      }
    }
    return;
  }

  let legacy = null;
  try {
    legacy = db.prepare(`
      SELECT id, area_id, galery_id, image, name, content
      FROM ippon_text
      WHERE area_id = 21 AND lang = 'lv'
      ORDER BY id DESC
      LIMIT 1
    `).get();
  } catch {}

  const now = nowTs();
  const nosaukums = String(legacy?.name || '').trim() || 'Sporta zāles īre';
  const saturs = String(legacy?.content || '').trim();
  let fotoAttels = legacy?.image ? (mapLegacyImageById(legacy.image)?.url || '') : '';
  if (!fotoAttels) {
    try {
      const legacyWithImage = db.prepare(`
        SELECT image
        FROM ippon_text
        WHERE area_id = 21 AND image > 0
        ORDER BY CASE WHEN lang = 'lv' THEN 0 ELSE 1 END, id DESC
        LIMIT 1
      `).get();
      fotoAttels = legacyWithImage?.image ? (mapLegacyImageById(legacyWithImage.image)?.url || '') : '';
    } catch {}
  }

  let galerija = [];
  const legacyGaleryId = Number(legacy?.galery_id || 0);
  if (legacyGaleryId > 0) {
    try {
      const gRows = db.prepare(`
        SELECT image
        FROM ippon_galery
        WHERE id = ? OR area_id = ?
        ORDER BY date DESC, id DESC
        LIMIT 40
      `).all(legacyGaleryId, legacyGaleryId);
      galerija = gRows.map((r) => String(r.image || '').trim()).filter(Boolean);
    } catch {}
  }
  if (!galerija.length) {
    galerija = collectSadarbibaLegacyGalleryCandidates();
  }
  galerija = pickUniqueGalleryImages(galerija);

  db.prepare(`
    INSERT INTO sadarbiba_sporta_zales_ire (
      nosaukums, saturs, foto_attels, galerija, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    nosaukums,
    saturs,
    fotoAttels || null,
    galerija.length ? JSON.stringify(galerija) : null,
    now,
    now
  );
}

function ensureSadarbibaSponsoruAtbalstsTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sadarbiba_sponsoru_atbalsts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums TEXT,
      saturs TEXT,
      foto_attels TEXT,
      galerija TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);

  const hasAny = db.prepare('SELECT id FROM sadarbiba_sponsoru_atbalsts LIMIT 1').get();
  if (hasAny) return;

  const now = nowTs();
  db.prepare(`
    INSERT INTO sadarbiba_sponsoru_atbalsts (
      nosaukums, saturs, foto_attels, galerija, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'Sponsoru atbalsts',
    '',
    null,
    null,
    now,
    now
  );
}

function ensureSadarbibaMusuPartneriTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sadarbiba_musu_partneri (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums TEXT NOT NULL,
      links TEXT,
      foto_attels TEXT,
      informacija TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function ensureVideoGalerijaTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS video_galerija (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nosaukums TEXT NOT NULL,
      video_saite TEXT NOT NULL,
      date TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function ensureRakstiPreseTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS raksti_prese (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      datums TEXT,
      nosaukums TEXT NOT NULL,
      attels TEXT,
      ievads TEXT,
      zina TEXT,
      saite TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function ensureSportistiSasniegumiTable() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sportisti_sasniegumi (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sportist_id INTEGER NOT NULL,
      datums TEXT,
      nosaukums TEXT,
      rezultats TEXT,
      vieta TEXT,
      statuss TEXT,
      informacija TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    )
  `);
}

function parseGallery(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.map((v) => normalizeStoredMediaUrl(v)).filter(Boolean);
  const text = String(value).trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) {
      return parsed.map((v) => normalizeStoredMediaUrl(v)).filter(Boolean);
    }
  } catch {}
  return text
    .split(/[\n,;]/)
    .map((v) => normalizeStoredMediaUrl(v))
    .filter(Boolean);
}

function normalizeStoredMediaUrl(value) {
  const text = String(value || '').trim();
  if (!text) return '';
  if (/^(?:https?:)?\/\//i.test(text) || text.startsWith('data:') || text.startsWith('/legacy_import/')) {
    return text;
  }
  if (text.startsWith('/uploads/')) {
    return buildPublicUploadUrl(text.slice(1));
  }
  if (text.startsWith('uploads/')) {
    return buildPublicUploadUrl(text);
  }
  return text;
}

function isImageFileName(name) {
  return /\.(jpg|jpeg|png|webp|gif)$/i.test(String(name || ''));
}

function listImageFilesInDir(dirPath, { recursive = false } = {}) {
  if (!dirPath || !fs.existsSync(dirPath)) return [];
  const out = [];
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    for (const entry of entries) {
      const abs = path.join(dirPath, entry.name);
      if (entry.isFile() && isImageFileName(entry.name)) {
        out.push(abs);
        continue;
      }
      if (recursive && entry.isDirectory()) {
        out.push(...listImageFilesInDir(abs, { recursive: true }));
      }
    }
  } catch {
    return [];
  }
  return out.sort((a, b) => path.basename(a).localeCompare(path.basename(b)));
}

function localPathToUploadsStorageKey(filePath) {
  const relative = path.relative(ROOT, filePath).replace(/\\/g, '/');
  if (!relative || relative.startsWith('..') || !relative.startsWith('uploads/')) return '';
  return relative;
}

function getMainImage(category, id) {
  const normalizedCategory = sanitizeStorageSegment(category, '');
  const normalizedId = sanitizeStorageSegment(id, '');
  if (!normalizedCategory || !normalizedId) return null;

  const baseDir = path.join(ROOT, 'uploads', normalizedCategory, normalizedId);
  const files = listImageFilesInDir(baseDir, { recursive: false });
  if (!files.length) return null;

  const preferred = files.find((filePath) => /^main\.[a-z0-9]+$/i.test(path.basename(filePath)))
    || files.find((filePath) => /^profile\.[a-z0-9]+$/i.test(path.basename(filePath)))
    || files[0];
  const storageKey = localPathToUploadsStorageKey(preferred);
  return storageKey ? buildPublicUploadUrl(storageKey) : null;
}

function getGallery(id) {
  const normalizedId = sanitizeStorageSegment(id, '');
  if (!normalizedId) return [];

  const baseDir = path.join(ROOT, 'uploads', 'gallery', normalizedId);
  const files = listImageFilesInDir(baseDir, { recursive: true });
  return files
    .map((filePath) => localPathToUploadsStorageKey(filePath))
    .filter(Boolean)
    .map((storageKey) => buildPublicUploadUrl(storageKey));
}

function withResolvedMedia(item, options = {}) {
  if (!item || typeof item !== 'object') return item;
  const id = options.id ?? item.id ?? item.source_id ?? null;
  const category = options.category || '';
  const fallbackMain = normalizeStoredMediaUrl(
    options.fallbackMain
    ?? item.mainImage
    ?? item.foto_attels
    ?? item.attels
    ?? item.foto
    ?? item.image
    ?? ''
  ) || null;
  const mainImage = (category && id != null ? getMainImage(category, id) : null) || fallbackMain || null;
  const gallery = id != null ? getGallery(id) : [];

  return {
    ...item,
    mainImage,
    gallery,
    foto_attels: item.foto_attels !== undefined ? (mainImage || item.foto_attels || null) : item.foto_attels,
    attels: item.attels !== undefined ? (mainImage || item.attels || null) : item.attels,
    foto: item.foto !== undefined ? (mainImage || item.foto || null) : item.foto,
    galerija: gallery
  };
}

function pickUniqueGalleryImages(urls) {
  const groups = new Map();
  for (const rawUrl of urls || []) {
    const url = String(rawUrl || '').trim();
    if (!url) continue;
    const baseName = path.basename(url).toLowerCase();
    if (!isImageFileName(baseName)) continue;
    const normalized = baseName.replace(/-\d+(?=\.[^.]+$)/, '');
    if (!groups.has(normalized)) groups.set(normalized, []);
    groups.get(normalized).push(url);
  }

  const out = [];
  for (const items of groups.values()) {
    const preferred = items.find((u) => !/-\d+(?=\.[^.]+$)/i.test(path.basename(u))) || items[0];
    out.push(preferred);
  }
  return out.filter((v, i, arr) => arr.indexOf(v) === i);
}

function collectSadarbibaLegacyGalleryCandidates() {
  const candidates = [];
  const roots = [
    {
      abs: path.join(ROOT, 'uploads', 'gallery', '1'),
      prefix: 'https://ippon.fra1.digitaloceanspaces.com/uploads/gallery/1'
    },
    {
      abs: path.join(ROOT, 'legacy_import', 'images', '25', '1'),
      prefix: '/legacy_import/images/25/1'
    }
  ];

  for (const root of roots) {
    try {
      if (!fs.existsSync(root.abs)) continue;
      const files = fs.readdirSync(root.abs, { withFileTypes: true })
        .filter((d) => d.isFile() && isImageFileName(d.name))
        .map((d) => `${root.prefix}/${d.name}`);
      candidates.push(...files);
    } catch {}
  }

  return pickUniqueGalleryImages(candidates);
}

function resolveSadarbibaSportaZalesIreMedia(existingRow = null) {
  const foto = String(existingRow?.foto_attels || '').trim();
  const gallery = parseGallery(existingRow?.galerija);
  const resolved = {
    foto_attels: foto || null,
    galerija: gallery
  };

  if (!resolved.foto_attels) {
    try {
      const legacyPhoto = db.prepare(`
        SELECT image
        FROM ippon_text
        WHERE area_id = 21 AND image > 0
        ORDER BY CASE WHEN lang = 'lv' THEN 0 ELSE 1 END, id DESC
        LIMIT 1
      `).get();
      if (legacyPhoto?.image) {
        resolved.foto_attels = mapLegacyImageById(legacyPhoto.image)?.url || null;
      }
    } catch {}
  }

  if (!resolved.foto_attels) {
    const fallbackPath = path.join(ROOT, 'legacy_import', 'images', '21', '14');
    try {
      if (fs.existsSync(fallbackPath)) {
        const file = fs.readdirSync(fallbackPath, { withFileTypes: true })
          .find((d) => d.isFile() && isImageFileName(d.name));
        if (file) {
          resolved.foto_attels = `/legacy_import/images/21/14/${file.name}`;
        }
      }
    } catch {}
  }

  const discoveredGallery = collectSadarbibaLegacyGalleryCandidates();
  if (discoveredGallery.length) {
    resolved.galerija = pickUniqueGalleryImages([...(resolved.galerija || []), ...discoveredGallery]);
  }

  if (resolved.foto_attels) {
    resolved.galerija = resolved.galerija.filter((u) => String(u).trim() !== String(resolved.foto_attels).trim());
  }

  return {
    foto_attels: resolved.foto_attels || null,
    galerija: resolved.galerija.filter(Boolean)
  };
}

function mapHallRow(slug, row) {
  if (!row) return null;
  return withResolvedMedia({
    slug,
    id: row.id,
    nosaukums: row.nosaukums,
    ievads: row.ievads,
    attels: normalizeStoredMediaUrl(row.attels),
    galerija: parseGallery(row.galerija),
    created_at: row.created_at,
    updated_at: row.updated_at
  }, { category: 'halls', id: row.id, fallbackMain: row.attels });
}

function isHallTable(table) {
  return table === 'zales_imanta' || table === 'zales_zolitude' || table === 'zales_sloka';
}
function isNodarbibasTable(table) {
  return table === 'nodarbibas_saraksts'
    || table === 'nodarbibas_izlases_grupas'
    || table === 'nodarbibas_individualas_nodarbibas';
}
function isSadarbibaCmsTable(table) {
  return table === 'sadarbiba_sporta_zales_ire'
    || table === 'sadarbiba_sponsoru_atbalsts';
}
function mapNewsRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    datums: row.datums,
    nosaukums: row.nosaukums,
    foto_attels: normalizeStoredMediaUrl(row.foto_attels),
    galerija: parseGallery(row.galerija),
    ievads: row.ievads,
    zina: row.zina,
    slug: row.slug,
    position: Number(row.position || 0),
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

function mapSadarbibaRow(row) {
  if (!row) return null;
  return withResolvedMedia({
    id: row.id,
    nosaukums: String(row.nosaukums || '').trim(),
    saturs: String(row.saturs || ''),
    foto_attels: normalizeStoredMediaUrl(row.foto_attels) || null,
    galerija: parseGallery(row.galerija),
    created_at: row.created_at,
    updated_at: row.updated_at
  }, { category: 'sadarbiba', id: row.id, fallbackMain: row.foto_attels });
}

function mapTrainerRow(row) {
  if (!row) return null;
  return withResolvedMedia({
    id: row.id,
    vards_uzvards: row.vards_uzvards || '',
    dzimsanas_datums: row.dzimsanas_datums || '',
    foto_attels: normalizeStoredMediaUrl(row.foto_attels) || null,
    galerija: parseGallery(row.galerija),
    izglitiba: row.izglitiba || '',
    josta: row.josta || '',
    saka_studet: row.saka_studet || '',
    koucinga_pieredze: row.koucinga_pieredze || '',
    par_mani: row.par_mani || '',
    sasniegumi: row.sasniegumi || '',
    slug: row.slug,
    created_at: row.created_at,
    updated_at: row.updated_at
  }, { category: 'trainers', id: row.id, fallbackMain: row.foto_attels });
}

function mapRezultatiRow(row) {
  if (!row) return null;
  const recordType = normalizeRezultatiRecordType(row.record_type);
  const layoutType = normalizeRezultatiLayoutType(row.layout_type, recordType);
  const structuredRaw = parseStructuredDataObject(row.structured_data);
  const structuredData = structuredRaw == null ? null : structuredRaw;
  const title = String(row.name_lv || row.name_ru || row.name_en || '').trim();
  const location = String(row.location_lv || row.location_ru || row.location_en || '').trim();
  const info = String(row.info_lv || row.info_ru || row.info_en || '').trim();

  return withResolvedMedia({
    id: row.id,
    slug: row.slug || uniqueRezultatiSlug(title || `rezultati-${row.id}`, row.id),
    record_type: recordType,
    layout_type: layoutType,
    nosaukums: title,
    datums: row.date || '',
    vieta: location,
    description: info,
    statuss: row.status_id != null ? String(row.status_id) : '',
    foto_attels: normalizeStoredMediaUrl(row.foto_attels) || ((row.image ? mapLegacyImageById(row.image)?.url : null) || null),
    structured_data: structuredData,
    custom_html: row.custom_html || '',
    created_at: row.created_at ?? row.c_time ?? null,
    updated_at: row.updated_at ?? row.m_time ?? null,
    raw: {
      area_id: row.area_id,
      galery_id: row.galery_id,
      image: row.image,
      public: row.public,
      ordering: row.ordering,
      results_url: row.results_url,
      info_lv: info
    }
  }, { category: 'events', id: row.id, fallbackMain: row.foto_attels });
}

function safeText(value) {
  return String(value || '').trim();
}

function buildSourceSlug(recordType, sourceId, baseTitle, fallbackPrefix = 'rezultati') {
  const safeType = normalizeRezultatiRecordType(recordType);
  const base = slugify(baseTitle || `${fallbackPrefix}-${sourceId}`) || `${fallbackPrefix}-${sourceId}`;
  return `${safeType}-${sourceId}-${base}`;
}

function buildManualSourceSlug(recordType, sourceId, baseTitle, fallbackPrefix = 'rezultati') {
  const safeType = normalizeRezultatiRecordType(recordType);
  const base = slugify(baseTitle || `${fallbackPrefix}-${sourceId}`) || `${fallbackPrefix}-${sourceId}`;
  return `manual-${safeType}-${sourceId}-${base}`;
}

function buildKalendarsSourceSlug(sourceId, baseTitle) {
  const base = slugify(baseTitle || `kalendars-${sourceId}`) || `kalendars-${sourceId}`;
  return `kalendars-${sourceId}-${base}`;
}

function buildKalendarsManualSlug(id, baseTitle) {
  const base = slugify(baseTitle || `kalendars-manual-${id}`) || `kalendars-manual-${id}`;
  return `kalendars-manual-${id}-${base}`;
}

function parseSourceSlug(slug) {
  const m = String(slug || '').match(/^(sacensibas|eksamens|reitings)-(\d+)-/i);
  if (!m) return null;
  return {
    record_type: normalizeRezultatiRecordType(m[1]),
    id: Number(m[2] || 0)
  };
}

function parseManualSourceSlug(slug) {
  const m = String(slug || '').match(/^manual-(sacensibas|eksamens|reitings)-(\d+)-/i);
  if (!m) return null;
  return {
    record_type: normalizeRezultatiRecordType(m[1]),
    id: Number(m[2] || 0)
  };
}

function parseKalendarsSourceSlug(slug) {
  const source = String(slug || '').match(/^kalendars-(\d+)-/i);
  if (source) return { source: true, id: Number(source[1] || 0) };
  const manual = String(slug || '').match(/^kalendars-manual-(\d+)-/i);
  if (manual) return { source: false, id: Number(manual[1] || 0) };
  return null;
}

function normalizeKeywordText(value) {
  return safeText(value)
    .toLowerCase()
    .replace(/[āăą]/g, 'a')
    .replace(/[čć]/g, 'c')
    .replace(/[ďđ]/g, 'd')
    .replace(/[ēĕėęě]/g, 'e')
    .replace(/[ģ]/g, 'g')
    .replace(/[īĭįı]/g, 'i')
    .replace(/[ķ]/g, 'k')
    .replace(/[ļĺľł]/g, 'l')
    .replace(/[ņńň]/g, 'n')
    .replace(/[ōŏő]/g, 'o')
    .replace(/[ŗř]/g, 'r')
    .replace(/[šś]/g, 's')
    .replace(/[ūŭůűų]/g, 'u')
    .replace(/[žźż]/g, 'z')
    .replace(/\s+/g, ' ')
    .trim();
}

function structuredToSearchText(value) {
  if (value == null) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    return value.map((v) => structuredToSearchText(v)).filter(Boolean).join(' ');
  }
  if (typeof value === 'object') {
    return Object.values(value).map((v) => structuredToSearchText(v)).filter(Boolean).join(' ');
  }
  return '';
}

function hasLegacyHtmlTable(row) {
  const html = String(row?.content_lv || row?.content_ru || row?.content_en || '').toLowerCase();
  return html.includes('<table');
}

function detectGalleryRecordType(row) {
  const combined = normalizeKeywordText([row?.name_lv, row?.name_ru, row?.name_en].filter(Boolean).join(' '));
  if (!combined) return null;
  const isExam = EXAM_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  const isReitings = REITING_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  const isExcluded = EXAM_EXCLUDE_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  if (isReitings) return 'reitings';
  return isExam && !isExcluded ? 'eksamens' : null;
}

function detectTextRecordType(row) {
  const combined = normalizeKeywordText([row?.name, row?.content].filter(Boolean).join(' '));
  if (!combined) return null;
  const isExam = EXAM_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  const isReitings = REITING_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  const isExcluded = EXAM_EXCLUDE_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
  if (isReitings) return 'reitings';
  return isExam && !isExcluded ? 'eksamens' : null;
}

function detectKalendarsTextRecord(row) {
  const combined = normalizeKeywordText([row?.name, row?.content].filter(Boolean).join(' '));
  if (!combined) return false;
  return KALENDARS_KEYWORDS.some((keyword) => combined.includes(normalizeKeywordText(keyword)));
}

function pickTextSourceRow(rows) {
  if (!Array.isArray(rows) || !rows.length) return null;
  const lv = rows.find((r) => normalizeKeywordText(r.lang) === 'lv');
  return lv || rows[0];
}

function getKalendarsSourceOverrideMap() {
  const rows = db.prepare('SELECT * FROM ippon_kalendars_source_overrides ORDER BY id DESC').all();
  const map = new Map();
  for (const row of rows) {
    const sourceId = Number(row.source_id || 0);
    if (!sourceId) continue;
    map.set(sourceId, row);
  }
  return map;
}

function mapKalendarsTextSource(row, overrideRow = null) {
  const title = safeText(overrideRow?.title_override || row.name);
  const baseDate = unixToIsoDate(row.c_time);
  const date = safeText(overrideRow?.date_override || baseDate);
  const baseHtml = safeText(row.content);
  const contentHtml = safeText(overrideRow?.content_override || baseHtml);
  const defaultImage = row.image ? (mapLegacyImageById(row.image)?.url || '') : '';
  const image = safeText(overrideRow?.image_override) || defaultImage || null;
  return withResolvedMedia({
    id: row.area_id,
    source_table: 'ippon_text',
    source_id: row.area_id,
    is_manual: false,
    title,
    nosaukums: title,
    date,
    datums: date,
    image,
    foto_attels: image,
    custom_html: contentHtml,
    slug: buildKalendarsSourceSlug(row.area_id, overrideRow?.slug_override || title || `kalendars-${row.area_id}`),
    created_at: row.c_time ?? null,
    updated_at: overrideRow?.updated_at ?? row.m_time ?? null
  }, { category: 'events', id: row.area_id, fallbackMain: image });
}

function mapKalendarsManualRow(row) {
  const title = safeText(row.title);
  const date = safeText(row.date);
  const image = safeText(row.image) || null;
  return withResolvedMedia({
    id: row.id,
    source_table: 'ippon_kalendars_records',
    source_id: row.id,
    is_manual: true,
    title,
    nosaukums: title,
    date,
    datums: date,
    image,
    foto_attels: image,
    custom_html: safeText(row.content_html),
    slug: buildKalendarsManualSlug(row.id, row.slug || title),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  }, { category: 'events', id: row.id, fallbackMain: image });
}

function queryKalendarsSourceItems(overrideMap) {
  const rows = db.prepare(`
    SELECT id, area_id, name, content, lang, image, c_time, m_time
    FROM ippon_text
    ORDER BY c_time DESC, id DESC
  `).all();
  const grouped = new Map();
  for (const row of rows) {
    if (!detectKalendarsTextRecord(row)) continue;
    const areaId = Number(row.area_id || 0);
    if (!areaId) continue;
    if (!grouped.has(areaId)) grouped.set(areaId, []);
    grouped.get(areaId).push(row);
  }
  return Array.from(grouped.entries()).map(([areaId, variants]) => {
    const picked = pickTextSourceRow(variants);
    const override = overrideMap.get(areaId);
    return mapKalendarsTextSource(picked, override);
  });
}

function queryKalendarsManualItems() {
  const rows = db.prepare(`
    SELECT * FROM ippon_kalendars_records
    WHERE is_published = 1
    ORDER BY date DESC, id DESC
  `).all();
  return rows.map(mapKalendarsManualRow);
}

function queryAllKalendarsItems() {
  const overrides = getKalendarsSourceOverrideMap();
  const source = queryKalendarsSourceItems(overrides);
  const manual = queryKalendarsManualItems();
  const items = [...source, ...manual];
  items.sort((a, b) => {
    const da = dateSortValue(a.date || a.datums);
    const dbv = dateSortValue(b.date || b.datums);
    if (da !== dbv) return dbv - da;
    return Number(b.source_id || 0) - Number(a.source_id || 0);
  });
  return { source, manual, items };
}

function unixToIsoDate(ts) {
  const n = Number(ts || 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  const d = new Date(n * 1000);
  if (!Number.isFinite(d.getTime())) return '';
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

function getSourceOverrideMap() {
  const rows = db.prepare(`
    SELECT *
    FROM ippon_rezultati_source_overrides
    ORDER BY id DESC
  `).all();
  const map = new Map();
  for (const row of rows) {
    const sourceTable = String(row.source_table || '').trim();
    const sourceId = Number(row.source_id || 0);
    if (!REZULTATI_SOURCE_TABLES.has(sourceTable) || !sourceId) continue;
    map.set(`${sourceTable}:${sourceId}`, row);
  }
  return map;
}

function parseManualStructuredData(raw) {
  const parsed = parseStructuredDataObject(raw);
  return parsed == null ? null : parsed;
}

function mapRezultatiManualRow(row) {
  if (!row) return null;
  const recordType = normalizeRezultatiRecordType(row.record_type || 'reitings');
  const layoutType = normalizeRezultatiLayoutType(row.layout_type, recordType);
  const title = safeText(row.title);
  return withResolvedMedia({
    id: row.id,
    source_table: 'ippon_rezultati_records',
    source_id: row.id,
    record_type: recordType,
    layout_type: layoutType,
    title,
    nosaukums: title,
    date: safeText(row.date),
    datums: safeText(row.date),
    slug: buildManualSourceSlug(recordType, row.id, row.slug || title, recordType),
    image: safeText(row.image) || null,
    foto_attels: safeText(row.image) || null,
    is_manual: true,
    structured_data: parseManualStructuredData(row.structured_data),
    custom_html: safeText(row.custom_html),
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null
  }, { category: 'events', id: row.id, fallbackMain: row.image });
}

function mapRezultatiSacensibasSource(row, overrideRow = null) {
  const title = safeText(row.name_lv || row.name_ru || row.name_en);
  const defaultImage = normalizeStoredMediaUrl(row.foto_attels) || ((row.image ? mapLegacyImageById(row.image)?.url : '') || '');
  const overrideRecordType = normalizeRezultatiRecordType(overrideRow?.record_type || 'sacensibas');
  const recordType = overrideRecordType === 'sacensibas' ? 'sacensibas' : 'sacensibas';
  const layoutType = normalizeRezultatiLayoutType(
    overrideRow?.layout_type || row.layout_type || 'competition_default',
    recordType
  );
  const structuredData = parseManualStructuredData(overrideRow?.structured_data || row.structured_data);
  return withResolvedMedia({
    id: row.id,
    source_table: 'ippon_sorevnovanija',
    source_id: row.id,
    record_type: recordType,
    layout_type: layoutType,
    title,
    nosaukums: title,
    date: safeText(row.date),
    datums: safeText(row.date),
    slug: buildSourceSlug(
      recordType,
      row.id,
      overrideRow?.slug_override || row.slug || title || `sacensibas-${row.id}`,
      'sacensibas'
    ),
    image: normalizeStoredMediaUrl(overrideRow?.image_override) || defaultImage || null,
    foto_attels: normalizeStoredMediaUrl(overrideRow?.image_override) || defaultImage || null,
    galerija: parseGallery(row.galerija),
    is_manual: false,
    structured_data: structuredData,
    custom_html: safeText(overrideRow?.custom_html || row.custom_html),
    vieta: safeText(row.location_lv || row.location_ru || row.location_en),
    location: safeText(row.location_lv || row.location_ru || row.location_en),
    statuss: row.status_id != null ? String(row.status_id) : '',
    created_at: row.created_at ?? row.c_time ?? null,
    updated_at: overrideRow?.updated_at ?? row.updated_at ?? row.m_time ?? null
  }, { category: 'events', id: row.id, fallbackMain: defaultImage });
}

function mapRezultatiLegacyHtmlSource(row, overrideRow = null, forcedType = null) {
  const title = safeText(row.name_lv || row.name_ru || row.name_en);
  const defaultRecordType = forcedType || detectGalleryRecordType(row) || 'eksamens';
  const recordType = normalizeRezultatiRecordType(overrideRow?.record_type || defaultRecordType);
  const layoutType = normalizeRezultatiLayoutType(
    overrideRow?.layout_type || 'custom_html',
    recordType
  );
  const defaultImage = row.image ? (mapLegacyImageById(row.image)?.url || '') : '';
  const baseHtml = safeText(row.content_lv || row.content_ru || row.content_en);
  return withResolvedMedia({
    id: row.id,
    source_table: 'ippon_galery',
    source_id: row.id,
    record_type: recordType,
    layout_type: layoutType,
    title,
    nosaukums: title,
    date: safeText(row.date),
    datums: safeText(row.date),
    slug: buildSourceSlug(
      recordType,
      row.id,
      overrideRow?.slug_override || title || `eksamens-${row.id}`,
      recordType
    ),
    image: safeText(overrideRow?.image_override) || defaultImage || null,
    foto_attels: safeText(overrideRow?.image_override) || defaultImage || null,
    is_manual: false,
    structured_data: parseManualStructuredData(overrideRow?.structured_data),
    custom_html: safeText(overrideRow?.custom_html || baseHtml),
    description: safeText(stripHtml(baseHtml)),
    created_at: row.c_time ?? null,
    updated_at: overrideRow?.updated_at ?? row.m_time ?? null
  }, { category: 'events', id: row.id, fallbackMain: safeText(overrideRow?.image_override) || defaultImage || null });
}

function mapRezultatiTextSource(row, overrideRow = null, forcedType = null) {
  const title = safeText(row.name);
  const defaultRecordType = forcedType || detectTextRecordType(row) || 'eksamens';
  const recordType = normalizeRezultatiRecordType(overrideRow?.record_type || defaultRecordType);
  const layoutType = normalizeRezultatiLayoutType(
    overrideRow?.layout_type || 'custom_html',
    recordType
  );
  const defaultImage = row.image ? (mapLegacyImageById(row.image)?.url || '') : '';
  const baseHtml = safeText(row.content);
  const baseDate = unixToIsoDate(row.c_time);
  return withResolvedMedia({
    id: row.area_id,
    source_table: 'ippon_text',
    source_id: row.area_id,
    record_type: recordType,
    layout_type: layoutType,
    title,
    nosaukums: title,
    date: safeText(overrideRow?.date_override || baseDate),
    datums: safeText(overrideRow?.date_override || baseDate),
    slug: buildSourceSlug(
      recordType,
      row.area_id,
      overrideRow?.slug_override || title || `${recordType}-${row.area_id}`,
      recordType
    ),
    image: safeText(overrideRow?.image_override) || defaultImage || null,
    foto_attels: safeText(overrideRow?.image_override) || defaultImage || null,
    is_manual: false,
    structured_data: parseManualStructuredData(overrideRow?.structured_data),
    custom_html: safeText(overrideRow?.custom_html || baseHtml),
    description: safeText(stripHtml(baseHtml)),
    created_at: row.c_time ?? null,
    updated_at: overrideRow?.updated_at ?? row.m_time ?? null
  }, { category: 'events', id: row.area_id, fallbackMain: safeText(overrideRow?.image_override) || defaultImage || null });
}

function dateSortValue(dateText) {
  const raw = safeText(dateText);
  if (!raw) return 0;
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) {
    const dt = new Date(`${iso[1]}-${iso[2]}-${iso[3]}T00:00:00Z`);
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
  }
  const lv = raw.match(/^(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{4})$/);
  if (lv) {
    const dd = lv[1].padStart(2, '0');
    const mm = lv[2].padStart(2, '0');
    const yy = lv[3];
    const dt = new Date(`${yy}-${mm}-${dd}T00:00:00Z`);
    return Number.isFinite(dt.getTime()) ? dt.getTime() : 0;
  }
  return 0;
}

function queryRezultatiSourceSacensibas(overrideMap) {
  const rows = db.prepare(`
    SELECT
      id, date, name_lv, name_ru, name_en,
      location_lv, location_ru, location_en,
      status_id, image, foto_attels, galerija, layout_type, slug, structured_data, custom_html, created_at, updated_at, c_time, m_time,
      (SELECT COUNT(*) FROM ippon_results r WHERE r.event_id = ippon_sorevnovanija.id) AS vietu_skaits
    FROM ippon_sorevnovanija
    ORDER BY date DESC, id DESC
  `).all();
  return rows.map((row) => {
    const item = mapRezultatiSacensibasSource(row, overrideMap.get(`ippon_sorevnovanija:${row.id}`));
    item.vietu_skaits = Number(row.vietu_skaits || 0);
    return item;
  });
}

function queryRezultatiSourceEksamens(overrideMap) {
  const rows = db.prepare(`
    SELECT id, area_id, name, content, lang, image, c_time, m_time
    FROM ippon_text
    ORDER BY c_time DESC, id DESC
  `).all();
  const grouped = new Map();
  for (const row of rows) {
    const type = detectTextRecordType(row);
    if (type !== 'eksamens') continue;
    const key = Number(row.area_id || 0);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return Array.from(grouped.entries()).map(([areaId, variants]) => {
    const picked = pickTextSourceRow(variants);
    const override = overrideMap.get(`ippon_text:${areaId}`);
    return mapRezultatiTextSource(picked, override, 'eksamens');
  });
}

function queryRezultatiSourceReitingi(overrideMap) {
  const rows = db.prepare(`
    SELECT id, area_id, name, content, lang, image, c_time, m_time
    FROM ippon_text
    ORDER BY c_time DESC, id DESC
  `).all();
  const grouped = new Map();
  for (const row of rows) {
    const type = detectTextRecordType(row);
    if (type !== 'reitings') continue;
    const key = Number(row.area_id || 0);
    if (!key) continue;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(row);
  }
  return Array.from(grouped.entries()).map(([areaId, variants]) => {
    const picked = pickTextSourceRow(variants);
    const override = overrideMap.get(`ippon_text:${areaId}`);
    return mapRezultatiTextSource(picked, override, 'reitings');
  });
}

function queryRezultatiManualItems() {
  const rows = db.prepare(`
    SELECT *
    FROM ippon_rezultati_records
    WHERE is_published = 1
    ORDER BY date DESC, id DESC
  `).all();
  return rows.map(mapRezultatiManualRow);
}

function queryAllRezultatiItems() {
  const overrideMap = getSourceOverrideMap();
  const sacensibas = queryRezultatiSourceSacensibas(overrideMap);
  const eksamens = queryRezultatiSourceEksamens(overrideMap);
  const reitingi = queryRezultatiSourceReitingi(overrideMap);
  const manual = queryRezultatiManualItems();
  const items = [...sacensibas, ...eksamens, ...reitingi, ...manual];
  items.sort((a, b) => {
    const da = dateSortValue(a.date || a.datums);
    const dbv = dateSortValue(b.date || b.datums);
    if (da !== dbv) return dbv - da;
    return Number(b.source_id || 0) - Number(a.source_id || 0);
  });
  return { sacensibas, eksamens, reitingi, manual, items };
}

function validateStructuredDataForLayout(layoutType, data) {
  if (data == null) {
    return { valid: true, normalized: null, warning: 'structured_data is empty' };
  }
  if (typeof data !== 'object') {
    return { valid: false, error: 'structured_data must be an object or array' };
  }

  const isArray = Array.isArray(data);
  if (layoutType === 'competition_default') {
    if (!data.rows || !Array.isArray(data.rows)) {
      return { valid: false, error: 'competition_default expects structured_data.rows[]' };
    }
  }
  if (layoutType === 'exam_simple_table') {
    if (!data.rows || !Array.isArray(data.rows)) {
      return { valid: false, error: 'exam_simple_table expects structured_data.rows[]' };
    }
  }
  if (layoutType === 'exam_with_gallery') {
    if (!data.rows || !Array.isArray(data.rows)) {
      return { valid: false, error: 'exam_with_gallery expects structured_data.rows[]' };
    }
    if (data.gallery && !Array.isArray(data.gallery)) {
      return { valid: false, error: 'exam_with_gallery structured_data.gallery must be array' };
    }
  }
  if (layoutType === 'rating_two_tables') {
    if (!data.system_rows || !Array.isArray(data.system_rows)) {
      return { valid: false, error: 'rating_two_tables expects structured_data.system_rows[]' };
    }
    if (!data.rating_rows || !Array.isArray(data.rating_rows)) {
      return { valid: false, error: 'rating_two_tables expects structured_data.rating_rows[]' };
    }
  }
  if (layoutType === 'rating_custom_table') {
    if (!data.columns || !Array.isArray(data.columns)) {
      return { valid: false, error: 'rating_custom_table expects structured_data.columns[]' };
    }
    if (!data.rows || !Array.isArray(data.rows)) {
      return { valid: false, error: 'rating_custom_table expects structured_data.rows[]' };
    }
  }

  if (layoutType === 'custom_html' && isArray) {
    return { valid: false, error: 'custom_html layout expects object structured_data, not array' };
  }

  return { valid: true, normalized: data };
}

function buildRezultatiPayload(body, existing = null) {
  const current = existing || {};
  const title = body.nosaukums != null
    ? String(body.nosaukums).trim()
    : String(current.name_lv || current.name_ru || current.name_en || '').trim();
  if (!title) {
    return { error: 'Field nosaukums is required' };
  }

  const recordType = normalizeRezultatiRecordType(body.record_type != null ? body.record_type : current.record_type);
  const layoutType = normalizeRezultatiLayoutType(body.layout_type != null ? body.layout_type : current.layout_type, recordType);
  const structuredSource = body.structured_data != null ? body.structured_data : current.structured_data;
  const structuredObj = parseStructuredDataObject(structuredSource);
  const validation = validateStructuredDataForLayout(layoutType, structuredObj);
  if (!validation.valid) {
    return { error: validation.error };
  }

  const customHtml = body.custom_html != null ? String(body.custom_html) : String(current.custom_html || '');
  const slugBase = body.slug != null
    ? String(body.slug).trim()
    : (title !== String(current.name_lv || '').trim() ? title : String(current.slug || '').trim());
  const slug = uniqueRezultatiSlug(slugBase || title, current.id || null);

  const datums = body.datums != null ? String(body.datums).trim() : String(current.date || '').trim();
  const vieta = body.vieta != null
    ? String(body.vieta).trim()
    : String(current.location_lv || current.location_ru || current.location_en || '').trim();
  const infoLv = body.info != null ? String(body.info).trim() : String(current.info_lv || '').trim();
  const fallbackName = title || '';
  const fallbackLocation = vieta || '';
  const fallbackInfo = infoLv || '';
  const statuss = body.statuss != null
    ? String(body.statuss).trim()
    : (current.status_id != null ? String(current.status_id) : '');
  const fotoAttels = body.foto_attels != null
    ? String(body.foto_attels).trim()
    : String(current.foto_attels || '').trim();
  const galerija = body.galerija != null ? body.galerija : current.galerija;

  return {
    values: {
      name_lv: title,
      name_ru: String(current.name_ru || '').trim() || fallbackName,
      name_en: String(current.name_en || '').trim() || fallbackName,
      date: datums || String(current.date || '').trim() || '0000-00-00',
      location_lv: vieta || null,
      location_ru: String(current.location_ru || '').trim() || fallbackLocation,
      location_en: String(current.location_en || '').trim() || fallbackLocation,
      info_lv: infoLv || '',
      info_ru: String(current.info_ru || '').trim() || fallbackInfo,
      info_en: String(current.info_en || '').trim() || fallbackInfo,
      status_id: statuss === '' ? (current.status_id ?? 0) : Number(statuss) || 0,
      galery_id: current.galery_id ?? 0,
      image: current.image ?? 0,
      public: current.public ?? 1,
      ordering: current.ordering ?? 0,
      results_url: String(current.results_url || '').trim(),
      record_type: recordType,
      layout_type: layoutType,
      slug,
      foto_attels: fotoAttels || null,
      galerija: JSON.stringify(parseGallery(galerija)),
      structured_data: stringifyStructuredData(validation.normalized),
      custom_html: customHtml || null,
      area_id: current.area_id ?? 1
    },
    warning: validation.warning || null
  };
}

function buildManualRezultatiPayload(body, existing = null) {
  const current = existing || {};
  const recordType = normalizeRezultatiRecordType(body.record_type != null ? body.record_type : (current.record_type || 'reitings'));
  const layoutType = normalizeRezultatiLayoutType(
    body.layout_type != null ? body.layout_type : (current.layout_type || defaultLayoutForRecordType(recordType)),
    recordType
  );
  const title = safeText(body.title != null ? body.title : current.title);
  if (!title) {
    return { error: 'Field title is required' };
  }
  const structuredObj = parseStructuredDataObject(body.structured_data != null ? body.structured_data : current.structured_data);
  const validation = validateStructuredDataForLayout(layoutType, structuredObj);
  if (!validation.valid) {
    return { error: validation.error };
  }
  const slugBase = safeText(body.slug != null ? body.slug : current.slug) || title;
  const slug = uniqueManualRezultatiSlug(slugBase, current.id || null);
  return {
    values: {
      title,
      date: safeText(body.date != null ? body.date : current.date) || null,
      image: safeText(body.image != null ? body.image : current.image) || null,
      record_type: recordType,
      layout_type: layoutType,
      slug,
      structured_data: stringifyStructuredData(validation.normalized),
      custom_html: safeText(body.custom_html != null ? body.custom_html : current.custom_html) || null,
      is_published: Number(body.is_published != null ? body.is_published : (current.is_published ?? 1)) ? 1 : 0
    },
    warning: validation.warning || null
  };
}

function buildRezultatiSourceOverridePayload(body, existing = null) {
  const current = existing || {};
  const sourceTable = safeText(body.source_table != null ? body.source_table : current.source_table);
  const sourceId = Number(body.source_id != null ? body.source_id : current.source_id);
  if (!REZULTATI_SOURCE_TABLES.has(sourceTable) || !Number.isFinite(sourceId) || sourceId <= 0) {
    return { error: 'Invalid source_table/source_id for source override' };
  }
  const defaultRecordType = sourceTable === 'ippon_galery' ? 'eksamens' : 'sacensibas';
  const recordType = normalizeRezultatiRecordType(
    body.record_type != null ? body.record_type : (current.record_type || defaultRecordType)
  );
  const layoutType = normalizeRezultatiLayoutType(
    body.layout_type != null ? body.layout_type : (current.layout_type || defaultLayoutForRecordType(recordType)),
    recordType
  );
  const structuredObj = parseStructuredDataObject(body.structured_data != null ? body.structured_data : current.structured_data);
  const validation = validateStructuredDataForLayout(layoutType, structuredObj);
  if (!validation.valid) {
    return { error: validation.error };
  }
  return {
    values: {
      source_table: sourceTable,
      source_id: sourceId,
      record_type: recordType,
      layout_type: layoutType,
      slug_override: safeText(body.slug_override != null ? body.slug_override : current.slug_override) || null,
      structured_data: stringifyStructuredData(validation.normalized),
      custom_html: safeText(body.custom_html != null ? body.custom_html : current.custom_html) || null,
      image_override: safeText(body.image_override != null ? body.image_override : current.image_override) || null
    },
    warning: validation.warning || null
  };
}

function buildKalendarsManualPayload(body, existing = null) {
  const current = existing || {};
  const title = safeText(body.title != null ? body.title : current.title);
  if (!title) return { error: 'Field title is required' };
  const slugBase = safeText(body.slug != null ? body.slug : current.slug) || title;
  const slug = uniqueKalendarsSlug(slugBase, current.id || null);
  return {
    values: {
      title,
      date: safeText(body.date != null ? body.date : current.date) || null,
      image: safeText(body.image != null ? body.image : current.image) || null,
      slug,
      content_html: safeText(body.content_html != null ? body.content_html : current.content_html) || null,
      is_published: Number(body.is_published != null ? body.is_published : (current.is_published ?? 1)) ? 1 : 0
    }
  };
}

function buildKalendarsSourceOverridePayload(body, existing = null) {
  const current = existing || {};
  const sourceId = Number(body.source_id != null ? body.source_id : current.source_id);
  if (!Number.isFinite(sourceId) || sourceId <= 0) {
    return { error: 'Invalid source_id for kalendars source override' };
  }
  return {
    values: {
      source_id: sourceId,
      title_override: safeText(body.title_override != null ? body.title_override : current.title_override) || null,
      date_override: safeText(body.date_override != null ? body.date_override : current.date_override) || null,
      image_override: safeText(body.image_override != null ? body.image_override : current.image_override) || null,
      content_override: safeText(body.content_override != null ? body.content_override : current.content_override) || null,
      slug_override: safeText(body.slug_override != null ? body.slug_override : current.slug_override) || null
    }
  };
}

function stripHtml(input) {
  return String(input || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseSportistAchievementsJson(raw) {
  const text = String(raw || '').trim();
  if (!text) return [];
  try {
    const parsed = JSON.parse(text);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item, index) => ({
        id: Number(item?.id || 0) || (index + 1),
        datums: String(item?.datums || '').trim(),
        nosaukums: String(item?.nosaukums || '').trim(),
        rezultats: String(item?.rezultats || '').trim(),
        vieta: String(item?.vieta || '').trim(),
        statuss: String(item?.statuss || '').trim(),
        informacija: String(item?.informacija || '').trim()
      }))
      .filter((item) =>
        item.datums || item.nosaukums || item.rezultats || item.vieta || item.statuss || item.informacija
      );
  } catch {
    return [];
  }
}

function normalizeAchievementValue(value) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function mergeAchievementsLists(...lists) {
  const out = [];
  const seen = new Set();

  for (const list of lists) {
    if (!Array.isArray(list)) continue;
    for (const rawItem of list) {
      const item = {
        id: rawItem?.id || null,
        datums: String(rawItem?.datums || '').trim(),
        nosaukums: String(rawItem?.nosaukums || '').trim(),
        rezultats: String(rawItem?.rezultats || '').trim(),
        vieta: String(rawItem?.vieta || '').trim(),
        statuss: String(rawItem?.statuss || '').trim(),
        informacija: String(rawItem?.informacija || '').trim()
      };

      if (!item.datums && !item.nosaukums && !item.rezultats && !item.vieta && !item.statuss && !item.informacija) {
        continue;
      }

      const key = [
        normalizeAchievementValue(item.datums),
        normalizeAchievementValue(item.nosaukums),
        normalizeAchievementValue(item.rezultats),
        normalizeAchievementValue(item.vieta),
        normalizeAchievementValue(item.statuss),
        normalizeAchievementValue(item.informacija)
      ].join('|');

      if (seen.has(key)) continue;
      seen.add(key);
      out.push(item);
    }
  }

  return out;
}

function translitLv(input) {
  return String(input || '')
    .replace(/[Āā]/g, 'a')
    .replace(/[Čč]/g, 'c')
    .replace(/[Ēē]/g, 'e')
    .replace(/[Ģģ]/g, 'g')
    .replace(/[Īī]/g, 'i')
    .replace(/[Ķķ]/g, 'k')
    .replace(/[Ļļ]/g, 'l')
    .replace(/[Ņņ]/g, 'n')
    .replace(/[Šš]/g, 's')
    .replace(/[Ūū]/g, 'u')
    .replace(/[Žž]/g, 'z');
}

function makeSportistSlug(name, id) {
  const base = slugify(translitLv(name || 'sportists'));
  return `${base || 'sportists'}-${id}`;
}

function parseSportistSlug(slug) {
  const m = String(slug || '').match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

function mapLegacyImageById(imageId) {
  const id = Number(imageId || 0);
  if (!id) return null;
  const img = db.prepare('SELECT id, path, filename, o_name FROM ippon_images WHERE id = ? LIMIT 1').get(id);
  if (!img) return null;
  const cleanPath = String(img.path || '').replace(/^\/+/, '');
  const legacyUrl = cleanPath ? `https://www.ippon.lv/upload/${cleanPath}` : null;
  return {
    id: img.id,
    path: img.path,
    filename: img.filename,
    original_name: img.o_name,
    url: legacyUrl
  };
}

function pickLang(row, lvKey, ruKey, enKey) {
  return String(row?.[lvKey] || row?.[ruKey] || row?.[enKey] || '').trim();
}

function toUnixTsFromValue(value) {
  if (value == null || value === '') return 0;
  const raw = String(value).trim();
  if (!raw) return 0;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split('-').map(Number);
    return Math.floor(Date.UTC(y, (m || 1) - 1, d || 1) / 1000);
  }
  const parsed = Date.parse(raw);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : 0;
}

function formatUnixTsToDateInput(value) {
  const ts = Number(value || 0);
  if (!ts) return '';
  const date = new Date(ts * 1000);
  if (Number.isNaN(date.getTime())) return '';
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function formatUnixTsToDisplayDate(value) {
  const input = formatUnixTsToDateInput(value);
  if (!input) return '';
  const [y, m, d] = input.split('-');
  return `${d}.${m}.${y}`;
}

function pickGalleryTitle(row) {
  return pickLang(row, 'name_lv', 'name_ru', 'name_en') || `Galerija #${row.id}`;
}

function pickGalleryDescription(row) {
  return pickLang(row, 'content_lv', 'content_ru', 'content_en');
}

function isImportedGalleryPlaceholderTitle(title) {
  const value = String(title || '').trim();
  if (!value) return false;
  return /^imported\s+gallery\s*#\d+$/i.test(value);
}

function buildFotoGalerijaSlug(row) {
  const base = slugify(translitLv(pickGalleryTitle(row)));
  return `${base || 'foto-galerija'}-${row.id}`;
}

function parseFotoGalerijaSlug(slug) {
  const raw = String(slug || '').trim();
  if (!raw) return null;
  if (/^\d+$/.test(raw)) return Number(raw);
  const m = raw.match(/-(\d+)$/);
  return m ? Number(m[1]) : null;
}

function resolveGalleryImagePath(imgRow) {
  const rawPath = String(imgRow?.path || '').replace(/^\/+/, '').trim();
  if (/^https?:\/\//i.test(rawPath)) {
    return rawPath;
  }
  if (rawPath.startsWith('uploads/')) {
    return buildPublicUploadUrl(rawPath);
  }
  if (rawPath) {
    const legacyAbs = path.join(ROOT, 'legacy_import', 'images', rawPath);
    if (fs.existsSync(legacyAbs)) {
      return `/legacy_import/images/${rawPath.replace(/\\/g, '/')}`;
    }
  }

  const itemId = Number(imgRow?.item_id || 0);
  const fileName = String(imgRow?.filename || '').trim();
  if (itemId && fileName) {
    const storageKey = buildUploadStorageKey({
      category: 'gallery',
      entityId: itemId,
      fileName
    });
    const uploadedAbs = uploadKeyToLocalPath(storageKey);
    if (fs.existsSync(uploadedAbs)) {
      return buildPublicUploadUrl(storageKey);
    }
  }

  return null;
}

function getGalleryImageRowsByAlbumIds(albumIds) {
  if (!Array.isArray(albumIds) || !albumIds.length) return new Map();
  const placeholders = albumIds.map(() => '?').join(', ');
  const rows = db.prepare(`
    SELECT id, area_id, item_id, filename, path, o_name, ordering, c_time, comment_lv, comment_ru, comment_en
    FROM ippon_images
    WHERE area_id = 25 AND item_id IN (${placeholders})
    ORDER BY ordering DESC, id DESC
  `).all(...albumIds);

  const map = new Map();
  for (const row of rows) {
    if (!map.has(row.item_id)) map.set(row.item_id, []);
    map.get(row.item_id).push(row);
  }
  return map;
}

function mapGalleryImageRow(row) {
  return {
    id: row.id,
    item_id: row.item_id,
    filename: row.filename,
    path: row.path,
    ordering: row.ordering,
    comment: pickLang(row, 'comment_lv', 'comment_ru', 'comment_en'),
    url: resolveGalleryImagePath(row)
  };
}

function mapFotoGalerijaAlbum(row, imagesByAlbum = new Map(), includeImages = true) {
  const images = includeImages
    ? (imagesByAlbum.get(row.id) || []).map(mapGalleryImageRow).filter((img) => img.url)
    : [];
  const preview = images[0]?.url || null;
  const coverImageId = Number(row.image || 0);
  const cover = images.find((img) => img.id === coverImageId) || null;
  const title = pickGalleryTitle(row);
  const description = pickGalleryDescription(row);
  return {
    id: row.id,
    slug: buildFotoGalerijaSlug(row),
    nosaukums: title,
    datums: formatUnixTsToDateInput(row.date),
    datums_display: formatUnixTsToDisplayDate(row.date),
    apraksts: description,
    foto_attels: cover?.url || preview,
    cover_image_id: coverImageId || (images[0]?.id || 0),
    photos_count: images.length,
    fotografijas: images
  };
}

function normalizeExternalUrl(url) {
  const value = String(url || '').trim();
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (/^\/\//.test(value)) return `https:${value}`;
  return `https://${value}`;
}

function toYoutubeEmbedUrl(rawUrl) {
  const normalized = normalizeExternalUrl(rawUrl);
  if (!normalized) return null;
  try {
    const u = new URL(normalized);
    const host = u.hostname.toLowerCase().replace(/^www\./, '');
    let videoId = '';
    if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') {
        videoId = u.searchParams.get('v') || '';
      } else if (u.pathname.startsWith('/shorts/')) {
        videoId = u.pathname.split('/')[2] || '';
      } else if (u.pathname.startsWith('/embed/')) {
        videoId = u.pathname.split('/')[2] || '';
      }
    } else if (host === 'youtu.be') {
      videoId = u.pathname.replace(/^\/+/, '').split('/')[0] || '';
    }
    videoId = String(videoId || '').trim();
    if (!videoId) return null;
    if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;
    return `https://www.youtube.com/embed/${videoId}`;
  } catch {
    return null;
  }
}

function safeResolve(base, target) {
  const resolved = path.resolve(base, target);
  if (!resolved.startsWith(base)) return null;
  return resolved;
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload));
}

function sendFile(res, filePath) {
  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const type = MIME[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': type });
    fs.createReadStream(filePath).pipe(res);
  });
}

function serveStatic(filePath, res) {
  const ext = path.extname(filePath).toLowerCase();

  const contentTypeMap = {
    '.css': 'text/css',
    '.js': 'application/javascript',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };

  const contentType = contentTypeMap[ext] || 'application/octet-stream';

  res.writeHead(200, { 'Content-Type': contentType });
  res.end(fs.readFileSync(filePath));
}

function parseDataUrlImage(dataUrl) {
  const match = String(dataUrl || '').match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  const mime = match[1].toLowerCase();
  const base64 = match[2];
  const extByMime = {
    'image/jpeg': 'jpg',
    'image/jpg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif'
  };
  const ext = extByMime[mime];
  if (!ext) return null;
  return { mime, base64, ext };
}

function parseDataUrlFile(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([a-zA-Z0-9.+/-]+);base64,([A-Za-z0-9+/=]+)$/);
  if (!match) return null;
  return {
    mime: match[1].toLowerCase(),
    base64: match[2]
  };
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  let inBacktick = false;
  let escaped = false;

  for (let i = 0; i < sql.length; i += 1) {
    const ch = sql[i];

    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }

    if (ch === '\\') {
      current += ch;
      escaped = true;
      continue;
    }

    if (!inDouble && !inBacktick && ch === '\'') {
      inSingle = !inSingle;
      current += ch;
      continue;
    }

    if (!inSingle && !inBacktick && ch === '"') {
      inDouble = !inDouble;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && ch === '`') {
      inBacktick = !inBacktick;
      current += ch;
      continue;
    }

    if (!inSingle && !inDouble && !inBacktick && ch === ';') {
      const statement = current.trim();
      if (statement) {
        statements.push(statement);
      }
      current = '';
      continue;
    }

    current += ch;
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function normalizeCreateStatement(statement) {
  let stmt = statement
    .replace(/\r/g, '')
    .replace(/\s+collate\s+\w+/gi, '')
    .replace(/\bunsigned\b/gi, '')
    .replace(/\)\s*ENGINE=.*$/i, ')');

  stmt = stmt
    .replace(/,\s*KEY\s+`[^`]+`\s*\([^)]+\)\s*/gi, '\n')
    .replace(/,\s*UNIQUE KEY\s+`[^`]+`\s*\([^)]+\)\s*/gi, '\n')
    .replace(/,\s*FULLTEXT KEY\s+`[^`]+`\s*\([^)]+\)\s*/gi, '\n');

  if (/`id`\s+int\(\d+\)\s+NOT NULL\s+auto_increment/i.test(stmt)) {
    stmt = stmt.replace(/`id`\s+int\(\d+\)\s+NOT NULL\s+auto_increment/i, '`id` INTEGER PRIMARY KEY AUTOINCREMENT');
    stmt = stmt.replace(/,\s*PRIMARY KEY\s*\(`id`\)\s*/i, '\n');
  } else {
    stmt = stmt.replace(/\bauto_increment\b/gi, '');
  }

  return stmt;
}

function importDumpFile(filePath) {
  if (!fs.existsSync(filePath)) {
    console.warn(`SQL dump not found: ${filePath}`);
    return;
  }

  let sql = fs.readFileSync(filePath, 'utf8');
  sql = sql
    .split(/\r?\n/)
    .filter((line) => !line.trim().startsWith('--') && !line.trim().startsWith('/*!'))
    .join('\n');

  const statements = splitSqlStatements(sql);

  db.exec('BEGIN');
  try {
    for (const raw of statements) {
      const statement = raw.trim();
      if (!statement) continue;
      if (/^(LOCK TABLES|UNLOCK TABLES|SET\s+)/i.test(statement)) continue;

      if (/^CREATE TABLE/i.test(statement)) {
        db.exec(normalizeCreateStatement(statement));
      } else {
        db.exec(statement);
      }
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Import failed for ${filePath}: ${error.message}`);
  }
}

function initializeDatabase() {
  try {
    db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA foreign_keys = OFF');
  } catch (error) {
    logSqliteError('failed to apply startup PRAGMA settings', error);
    throw error;
  }

  const tableExistsStmt = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name=?"
  );

  const coreTables = [
    'ippon_galery',
    'ippon_images',
    'ippon_results',
    'ippon_sorevnovanija',
    'ippon_sportists'
  ];

  const needsImport = coreTables.some((table) => !tableExistsStmt.get(table));
  if (false && needsImport)  {
    const existingDumpFiles = DUMP_FILES.filter((filePath) => fs.existsSync(filePath));
    if (existingDumpFiles.length === 0) {
      throw new Error(
        `Core SQLite tables are missing in ${DB_PATH}. Copy the database to /data/ippon.db or place import dumps in ${LEGACY_IMPORT_DIR}.`
      );
    }

    for (const filePath of DUMP_FILES) {
      importDumpFile(filePath);
    }
  }

  ensureJaunumiTable();
  ensureJaunumiMediaColumns();
  ensureTreneriTable();
  ensureKlubaNoteikumiTable();
  ensureHallsTables();
  ensureNodarbibasSarakstsTable();
  ensureNodarbibasIzlasesGrupasTable();
  ensureNodarbibasIndividualasNodarbibasTable();
  ensureSadarbibaSportaZalesIreTable();
  ensureSadarbibaSponsoruAtbalstsTable();
  ensureSadarbibaMusuPartneriTable();
  ensureVideoGalerijaTable();
  ensureRakstiPreseTable();
  ensureSportistiSasniegumiTable();
  ensureSportistiMediaColumns();
  ensureRezultatiSchema();
  ensureRezultatiManualTables();
  ensureKalendarsTables();
  ensureIpponImagesAutoincrementId();
}

function ensureIpponImagesAutoincrementId() {
  const table = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='table' AND name='ippon_images'").get();
  if (!table) return;

  const cols = db.prepare('PRAGMA table_info(ippon_images)').all();
  const idCol = cols.find((c) => c.name === 'id');
  if (!idCol) return;

  // SQLite autoincrement-friendly PK must be exactly INTEGER PRIMARY KEY.
  const idType = String(idCol.type || '').trim().toUpperCase();
  const alreadyOk = idCol.pk === 1 && idType === 'INTEGER';
  if (alreadyOk) return;

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS ippon_images_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        area_id int(11) NOT NULL,
        item_id int(11) NOT NULL,
        filename varchar(255) DEFAULT NULL,
        path TEXT,
        o_name varchar(255) DEFAULT NULL,
        ordering int(11) NOT NULL,
        c_time int(11) NOT NULL,
        comment_ru TEXT,
        comment_lv TEXT,
        comment_en TEXT
      )
    `);

    db.exec(`
      INSERT INTO ippon_images_new (
        id, area_id, item_id, filename, path, o_name, ordering, c_time, comment_ru, comment_lv, comment_en
      )
      SELECT
        id, area_id, item_id, filename, path, o_name, ordering, c_time, comment_ru, comment_lv, comment_en
      FROM ippon_images
      ORDER BY id ASC
    `);

    db.exec('DROP TABLE ippon_images');
    db.exec('ALTER TABLE ippon_images_new RENAME TO ippon_images');
    db.exec('COMMIT');
    console.log('[DB] ippon_images.id migrated to INTEGER PRIMARY KEY AUTOINCREMENT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw new Error(`Failed to migrate ippon_images.id: ${error.message}`);
  }
}

function hasIpponImagesAutoPrimaryKey() {
  const cols = db.prepare('PRAGMA table_info(ippon_images)').all();
  const idCol = cols.find((c) => c.name === 'id');
  if (!idCol) return false;
  const idType = String(idCol.type || '').trim().toUpperCase();
  return idCol.pk === 1 && idType === 'INTEGER';
}

function getTableColumns(table) {
  return db.prepare(`PRAGMA table_info(${table})`).all();
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 10 * 1024 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

function extractTableFromPath(pathname) {
  const match = pathname.match(/^\/api\/table\/([a-zA-Z0-9_]+)(?:\/([0-9]+))?$/);
  if (!match) return null;
  const table = match[1];
  const id = match[2] ? Number(match[2]) : null;
  return { table, id };
}

function toBool(value) {
  return value === '1' || value === 'true' || value === 'yes';
}

function toIntFlag(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return fallback ? 1 : 0;
  if (typeof value === 'number') return value === 1 ? 1 : 0;
  if (typeof value === 'boolean') return value ? 1 : 0;
  const normalized = String(value).trim().toLowerCase();
  if (normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on') return 1;
  if (normalized === '0' || normalized === 'false' || normalized === 'no' || normalized === 'off') return 0;
  return fallback ? 1 : 0;
}

function toIntValue(value, fallback = 0) {
  if (value === null || value === undefined || value === '') return Number(fallback) || 0;
  const n = Number(value);
  return Number.isFinite(n) ? Math.trunc(n) : (Number(fallback) || 0);
}

function pickSportistRow(row) {
  return withResolvedMedia({
    id: row.id,
    galery_id: row.galery_id,
    date: row.date,
    foto_attels: normalizeStoredMediaUrl(row.foto_attels) || null,
    galerija: parseGallery(row.galerija),
    name_lv: row.name_lv,
    name_ru: row.name_ru,
    name_en: row.name_en,
    o_sebe_lv: row.o_sebe_lv,
    o_sebe_ru: row.o_sebe_ru,
    o_sebe_en: row.o_sebe_en,
    dostizhenija_lv: row.dostizhenija_lv,
    dostizhenija_ru: row.dostizhenija_ru,
    dostizhenija_en: row.dostizhenija_en,
    image: row.image,
    public: row.public,
    special: row.special,
    ordering: row.ordering,
    remove_date: row.remove_date
  }, {
    category: 'athletes',
    id: row.id,
    fallbackMain: row.foto_attels
  });
}

function mapNodarbibasRow(tableName, row) {
  if (!row) return null;
  return withResolvedMedia({
    ...row,
    attels: normalizeStoredMediaUrl(row.attels) || null,
    galerija: parseGallery(row.galerija)
  }, {
    category: 'nodarbibas',
    id: row.id,
    fallbackMain: row.attels
  });
}

function handleContentApi(req, res, reqUrl) {
  const { pathname, searchParams } = reqUrl;

  if (pathname === '/api/content/sportists' && req.method === 'GET') {
    const includeRemoved = toBool(searchParams.get('includeRemoved') || '0');
    const where = includeRemoved ? '' : 'WHERE s.remove_date = 0';
    const rows = db.prepare(`
      SELECT
        s.*,
        g.name_lv AS galery_name_lv,
        g.name_ru AS galery_name_ru,
        g.name_en AS galery_name_en
      FROM ippon_sportists s
      LEFT JOIN ippon_galery g ON g.id = s.galery_id
      ${where}
      ORDER BY COALESCE(s.position, 0) DESC, s.id DESC
    `).all();

    const items = rows.map((row) => ({
      ...pickSportistRow(row),
      galery: row.galery_id
        ? {
            id: row.galery_id,
            name_lv: row.galery_name_lv,
            name_ru: row.galery_name_ru,
            name_en: row.galery_name_en
          }
        : null
    }));

    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  if (pathname === '/api/content/competitions' && req.method === 'GET') {
    const includeRemovedSportists = toBool(searchParams.get('includeRemovedSportists') || '0');
    const onlyPublic = toBool(searchParams.get('onlyPublic') || '0');
    const competitionsWhere = onlyPublic ? 'WHERE ev.public = 1' : '';
    const sportistWhereExtra = includeRemovedSportists ? '' : 'AND sp.remove_date = 0';

    const competitions = db.prepare(`
      SELECT
        ev.*,
        g.name_lv AS galery_name_lv,
        g.name_ru AS galery_name_ru,
        g.name_en AS galery_name_en
      FROM ippon_sorevnovanija ev
      LEFT JOIN ippon_galery g ON g.id = ev.galery_id
      ${competitionsWhere}
      ORDER BY ev.date DESC, ev.id DESC
    `).all();

    const results = db.prepare(`
      SELECT
        r.id,
        r.event_id,
        r.sportist_id,
        r.trener_id,
        r.result,
        r.info_lv,
        r.info_ru,
        r.info_en,
        r.ordering,
        sp.name_lv AS sportist_name_lv,
        sp.name_ru AS sportist_name_ru,
        sp.name_en AS sportist_name_en,
        sp.remove_date AS sportist_remove_date
      FROM ippon_results r
      LEFT JOIN ippon_sportists sp ON sp.id = r.sportist_id
      WHERE 1=1 ${sportistWhereExtra}
      ORDER BY r.ordering DESC, r.id DESC
    `).all();

    const byEvent = new Map();
    for (const row of results) {
      if (!byEvent.has(row.event_id)) {
        byEvent.set(row.event_id, []);
      }
      byEvent.get(row.event_id).push({
        id: row.id,
        event_id: row.event_id,
        sportist_id: row.sportist_id,
        trener_id: row.trener_id,
        result: row.result,
        info_lv: row.info_lv,
        info_ru: row.info_ru,
        info_en: row.info_en,
        ordering: row.ordering,
        sportist: row.sportist_id
          ? {
              id: row.sportist_id,
              name_lv: row.sportist_name_lv,
              name_ru: row.sportist_name_ru,
              name_en: row.sportist_name_en,
              remove_date: row.sportist_remove_date
            }
          : null
      });
    }

    const items = competitions.map((ev) => {
      const item = {
        id: ev.id,
        area_id: ev.area_id,
        date: ev.date,
        name_lv: ev.name_lv,
        name_ru: ev.name_ru,
        name_en: ev.name_en,
        location_lv: ev.location_lv,
        location_ru: ev.location_ru,
        location_en: ev.location_en,
        info_lv: ev.info_lv,
        info_ru: ev.info_ru,
        info_en: ev.info_en,
        status_id: ev.status_id,
        galery_id: ev.galery_id,
        image: ev.image,
        public: ev.public,
        ordering: ev.ordering,
        results_url: ev.results_url,
        galery: ev.galery_id
          ? {
              id: ev.galery_id,
              name_lv: ev.galery_name_lv,
              name_ru: ev.galery_name_ru,
              name_en: ev.galery_name_en
            }
          : null,
        results: byEvent.get(ev.id) || []
      };
      return withResolvedMedia(item, {
        category: 'events',
        id: ev.id,
        fallbackMain: ev.foto_attels
      });
    });

    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  if (pathname === '/api/content/gallery' && req.method === 'GET') {
    const includeImages = toBool(searchParams.get('includeImages') || '1');
    const onlyPublic = toBool(searchParams.get('onlyPublic') || '0');
    const where = onlyPublic ? 'WHERE g.public = 1' : '';

    const albums = db.prepare(`
      SELECT
        g.id,
        g.area_id,
        g.date,
        g.name_lv,
        g.name_ru,
        g.name_en,
        g.content_lv,
        g.content_ru,
        g.content_en,
        g.image,
        g.public,
        g.ordering
      FROM ippon_galery g
      ${where}
      ORDER BY g.date DESC, g.id DESC
    `).all();

    let imagesByAlbum = new Map();
    if (includeImages) {
      const images = db.prepare(`
        SELECT
          id, item_id, filename, path, o_name, ordering,
          comment_lv, comment_ru, comment_en
        FROM ippon_images
        ORDER BY ordering DESC, id DESC
      `).all();

      imagesByAlbum = images.reduce((map, img) => {
        if (!map.has(img.item_id)) map.set(img.item_id, []);
        map.get(img.item_id).push(img);
        return map;
      }, new Map());
    }

    const items = albums.map((album) => ({
      ...album,
      images: includeImages ? (imagesByAlbum.get(album.id) || []) : undefined
    }));

    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  return false;
}

function handleApi(req, res, reqUrl) {
  const { pathname, searchParams } = reqUrl;

  if (pathname.startsWith('/api/content/')) {
    return handleContentApi(req, res, reqUrl);
  }

  if (pathname === '/api/upload-image' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const parsed = parseDataUrlImage(body.dataUrl);
        if (!parsed) {
          sendJson(res, 400, { error: 'Invalid image format. Use png/jpg/webp/gif.' });
          return;
        }

        const target = resolveUploadTarget({
          category: body.category,
          entityId: body.entityId,
          subPath: body.subPath,
          fileName: body.filename || 'image',
          ext: parsed.ext,
          fallbackStem: 'image'
        });

        const buffer = Buffer.from(parsed.base64, 'base64');
        if (buffer.length > 8 * 1024 * 1024) {
          sendJson(res, 400, { error: 'Image is too large. Max 8MB.' });
          return;
        }

        ensureDir(path.dirname(target.localPath));
        fs.writeFileSync(target.localPath, buffer);
        sendJson(res, 201, {
          url: target.publicUrl,
          relativeUrl: target.publicUrl,
          fileName: target.fileName,
          path: target.storageKey,
          category: target.category,
          entityId: target.entityId
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (pathname === '/api/upload-file' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const parsed = parseDataUrlFile(body.dataUrl);
        if (!parsed) {
          sendJson(res, 400, { error: 'Invalid file format' });
          return;
        }

        const originalName = String(body.filename || 'file').trim();
        const extFromName = normalizeFileExtension(path.extname(originalName)) || 'bin';
        const target = resolveUploadTarget({
          category: body.category,
          entityId: body.entityId,
          subPath: body.subPath,
          fileName: originalName || 'file',
          ext: extFromName,
          fallbackStem: 'file'
        });

        const buffer = Buffer.from(parsed.base64, 'base64');
        if (buffer.length > 25 * 1024 * 1024) {
          sendJson(res, 400, { error: 'File is too large. Max 25MB.' });
          return;
        }

        ensureDir(path.dirname(target.localPath));
        fs.writeFileSync(target.localPath, buffer);
        sendJson(res, 201, {
          url: target.publicUrl,
          relativeUrl: target.publicUrl,
          mime: parsed.mime,
          fileName: target.fileName,
          path: target.storageKey,
          category: target.category,
          entityId: target.entityId
        });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (pathname === '/api/sadarbiba/sporta-zales-ire' && req.method === 'GET') {
    const row = db.prepare(`
      SELECT id, nosaukums, saturs, foto_attels, galerija, created_at, updated_at
      FROM sadarbiba_sporta_zales_ire
      ORDER BY id DESC
      LIMIT 1
    `).get();

    let normalizedRow = row || null;
    if (normalizedRow) {
      const resolved = resolveSadarbibaSportaZalesIreMedia(normalizedRow);
      const currentFoto = String(normalizedRow.foto_attels || '').trim();
      const currentGallery = parseGallery(normalizedRow.galerija);
      const changedGallery = JSON.stringify(currentGallery) !== JSON.stringify(resolved.galerija);
      if ((!currentFoto && resolved.foto_attels) || changedGallery) {
        db.prepare(`
          UPDATE sadarbiba_sporta_zales_ire
          SET foto_attels = ?, galerija = ?, updated_at = ?
          WHERE id = ?
        `).run(
          resolved.foto_attels,
          resolved.galerija.length ? JSON.stringify(resolved.galerija) : null,
          nowTs(),
          normalizedRow.id
        );
        normalizedRow = db.prepare(`
          SELECT id, nosaukums, saturs, foto_attels, galerija, created_at, updated_at
          FROM sadarbiba_sporta_zales_ire
          WHERE id = ?
          LIMIT 1
        `).get(normalizedRow.id);
      }
    }

    sendJson(res, 200, {
      item: normalizedRow ? mapSadarbibaRow(normalizedRow) : null
    });
    return true;
  }

  if (pathname === '/api/sadarbiba/sponsoru-atbalsts' && req.method === 'GET') {
    const row = db.prepare(`
      SELECT id, nosaukums, saturs, foto_attels, galerija, created_at, updated_at
      FROM sadarbiba_sponsoru_atbalsts
      ORDER BY id DESC
      LIMIT 1
    `).get();

    sendJson(res, 200, { item: mapSadarbibaRow(row) });
    return true;
  }

  if (pathname === '/api/sadarbiba/musu-partneri' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT id, nosaukums, links, foto_attels, informacija, created_at, updated_at
      FROM sadarbiba_musu_partneri
      ORDER BY id DESC
    `).all();

    const items = rows.map((row) => withResolvedMedia({
      id: row.id,
      nosaukums: String(row.nosaukums || '').trim(),
      links: String(row.links || '').trim() || null,
      foto_attels: normalizeStoredMediaUrl(row.foto_attels) || null,
      informacija: String(row.informacija || ''),
      created_at: row.created_at,
      updated_at: row.updated_at
    }, { category: 'sadarbiba', id: row.id, fallbackMain: row.foto_attels }));

    sendJson(res, 200, { items });
    return true;
  }

  if (pathname === '/api/video-galerija' && req.method === 'GET') {
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 500), 1), 500);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const rows = db.prepare(`
      SELECT id, nosaukums, video_saite, date, created_at, updated_at
      FROM video_galerija
      ORDER BY date DESC, id DESC
    `).all();
    const allItems = rows
      .map((row) => {
        const videoUrl = normalizeExternalUrl(row.video_saite);
        return {
          id: row.id,
          nosaukums: String(row.nosaukums || '').trim(),
          video_saite: videoUrl,
          video_embed_url: toYoutubeEmbedUrl(videoUrl),
          datums: String(row.date || '').trim(),
          created_at: row.created_at,
          updated_at: row.updated_at
        };
      })
      .filter((item) => {
        if (!q) return true;
        const hay = normalizeKeywordText([item.id, item.nosaukums, item.datums, item.video_saite].join(' '));
        return hay.includes(q);
      });
    const total = allItems.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    sendJson(res, 200, {
      total,
      page: safePage,
      totalPages,
      limit,
      items: allItems.slice(offset, offset + limit)
    });
    return true;
  }

  const rakstiPreseByKey = pathname.match(/^\/api\/raksti-prese\/([a-z0-9-]+)$/i);
  if (rakstiPreseByKey && req.method === 'GET') {
    const key = String(rakstiPreseByKey[1] || '').trim().toLowerCase();
    const row = /^\d+$/.test(key)
      ? db.prepare(`
          SELECT id, datums, nosaukums, attels, ievads, zina, saite, created_at, updated_at
          FROM raksti_prese
          WHERE id = ?
          LIMIT 1
        `).get(Number(key))
      : db.prepare(`
          SELECT id, datums, nosaukums, attels, ievads, zina, saite, created_at, updated_at
          FROM raksti_prese
          WHERE lower(replace(replace(nosaukums, ' ', '-'), '--', '-')) = ?
          LIMIT 1
        `).get(key);
    if (!row) {
      sendJson(res, 404, { error: 'Raksts nav atrasts' });
      return true;
    }
    sendJson(res, 200, {
      item: {
        id: Number(row.id || 0),
        datums: String(row.datums || '').trim(),
        nosaukums: String(row.nosaukums || '').trim(),
        attels: normalizeStoredMediaUrl(row.attels) || null,
        ievads: String(row.ievads || ''),
        zina: String(row.zina || ''),
        saite: normalizeExternalUrl(row.saite),
        created_at: Number(row.created_at || 0),
        updated_at: Number(row.updated_at || 0)
      }
    });
    return true;
  }

  if (pathname === '/api/raksti-prese' && req.method === 'GET') {
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 500), 1), 500);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const rows = db.prepare(`
      SELECT id, datums, nosaukums, attels, ievads, zina, saite, created_at, updated_at
      FROM raksti_prese
      ORDER BY datums DESC, id DESC
    `).all();
    const allItems = rows
      .map((row) => ({
        id: Number(row.id || 0),
        datums: String(row.datums || '').trim(),
        nosaukums: String(row.nosaukums || '').trim(),
        attels: normalizeStoredMediaUrl(row.attels) || null,
        ievads: String(row.ievads || ''),
        zina: String(row.zina || ''),
        saite: normalizeExternalUrl(row.saite),
        created_at: Number(row.created_at || 0),
        updated_at: Number(row.updated_at || 0)
      }))
      .filter((item) => {
        if (!q) return true;
        const hay = normalizeKeywordText([item.id, item.datums, item.nosaukums, item.ievads, item.zina, item.saite].join(' '));
        return hay.includes(q);
      });
    const total = allItems.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    sendJson(res, 200, {
      total,
      page: safePage,
      totalPages,
      limit,
      items: allItems.slice(offset, offset + limit)
    });
    return true;
  }

  if (pathname === '/api/foto-galerija/admin/list' && req.method === 'GET') {
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const rows = db.prepare(`
      SELECT id, area_id, date, name_lv, name_ru, name_en, content_lv, content_ru, content_en, image, public, ordering
      FROM ippon_galery
      WHERE area_id = 25
      ORDER BY date DESC, id DESC
    `).all();
    const ids = rows.map((r) => r.id);
    const imagesByAlbum = getGalleryImageRowsByAlbumIds(ids);
    const items = rows
      .map((row) => mapFotoGalerijaAlbum(row, imagesByAlbum, true))
      .filter((item) => {
        if (!q) return true;
        const hay = normalizeKeywordText([
          item.nosaukums,
          item.apraksts,
          item.datums,
          item.datums_display
        ].filter(Boolean).join(' '));
        return hay.includes(q);
      });
    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  const fotoGalerijaAdminById = pathname.match(/^\/api\/foto-galerija\/admin\/(\d+)$/i);
  if (fotoGalerijaAdminById && req.method === 'GET') {
    const id = Number(fotoGalerijaAdminById[1]);
    const row = db.prepare(`
      SELECT id, area_id, date, name_lv, name_ru, name_en, content_lv, content_ru, content_en, image, public, ordering
      FROM ippon_galery
      WHERE id = ? AND area_id = 25
      LIMIT 1
    `).get(id);
    if (!row) {
      sendJson(res, 404, { error: 'Foto galerija nav atrasta' });
      return true;
    }
    const imagesByAlbum = getGalleryImageRowsByAlbumIds([id]);
    sendJson(res, 200, { item: mapFotoGalerijaAlbum(row, imagesByAlbum, true) });
    return true;
  }

  const fotoGalerijaAdminUpload = pathname.match(/^\/api\/foto-galerija\/admin\/(\d+)\/photos$/i);
  if (fotoGalerijaAdminUpload && req.method === 'POST') {
    const albumId = Number(fotoGalerijaAdminUpload[1]);
    const album = db.prepare('SELECT id FROM ippon_galery WHERE id = ? AND area_id = 25 LIMIT 1').get(albumId);
    if (!album) {
      sendJson(res, 404, { error: 'Galerija nav atrasta' });
      return true;
    }
    parseBody(req)
      .then((body) => {
        const files = Array.isArray(body.files) ? body.files : [];
        if (!files.length) {
          sendJson(res, 400, { error: 'Nav augšupielādējamu failu' });
          return;
        }
        const ts = nowTs();
        const inserted = [];
        let currentOrder = Number(
          db.prepare('SELECT COALESCE(MAX(ordering), 0) AS m FROM ippon_images WHERE item_id = ?').get(albumId)?.m || 0
        );
        const useManualImageId = !hasIpponImagesAutoPrimaryKey();
        let nextImageId = useManualImageId
          ? Number(db.prepare('SELECT COALESCE(MAX(id), 0) + 1 AS next_id FROM ippon_images').get()?.next_id || 1)
          : 0;
        for (const file of files) {
          const parsed = parseDataUrlImage(file?.dataUrl);
          if (!parsed) continue;
          const target = resolveUploadTarget({
            category: 'gallery',
            entityId: albumId,
            fileName: file?.filename || 'gallery-image',
            ext: parsed.ext,
            fallbackStem: 'gallery-image'
          });
          ensureDir(path.dirname(target.localPath));
          fs.writeFileSync(target.localPath, Buffer.from(parsed.base64, 'base64'));
          currentOrder += 1;
          let createdId = 0;
          if (useManualImageId) {
            createdId = nextImageId++;
            db.prepare(`
              INSERT INTO ippon_images (
                id, area_id, item_id, filename, path, o_name, ordering, c_time,
                comment_ru, comment_lv, comment_en
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(
              createdId,
              25,
              albumId,
              target.fileName,
              target.storageKey,
              String(file?.filename || target.fileName),
              currentOrder,
              ts,
              '',
              '',
              ''
            );
          } else {
            const info = db.prepare(`
              INSERT INTO ippon_images (
                area_id, item_id, filename, path, o_name, ordering, c_time,
                comment_ru, comment_lv, comment_en
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(25, albumId, target.fileName, target.storageKey, String(file?.filename || target.fileName), currentOrder, ts, '', '', '');
            createdId = Number(info.lastInsertRowid || 0);
          }
          const created = db.prepare('SELECT * FROM ippon_images WHERE id = ? LIMIT 1').get(createdId);
          inserted.push(mapGalleryImageRow(created));
        }
        if (inserted.length) {
          const cover = db.prepare('SELECT id FROM ippon_images WHERE item_id = ? ORDER BY ordering DESC, id DESC LIMIT 1').get(albumId);
          db.prepare('UPDATE ippon_galery SET image = ?, m_time = ? WHERE id = ?').run(Number(cover?.id || 0), ts, albumId);
        }
        sendJson(res, 201, { items: inserted });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  const fotoGalerijaAdminPhotoDelete = pathname.match(/^\/api\/foto-galerija\/admin\/(\d+)\/photos\/(\d+)$/i);
  if (fotoGalerijaAdminPhotoDelete && req.method === 'DELETE') {
    const albumId = Number(fotoGalerijaAdminPhotoDelete[1]);
    const photoId = Number(fotoGalerijaAdminPhotoDelete[2]);
    const row = db.prepare('SELECT id, item_id FROM ippon_images WHERE id = ? LIMIT 1').get(photoId);
    if (!row || Number(row.item_id) !== albumId) {
      sendJson(res, 404, { error: 'Foto nav atrasts' });
      return true;
    }
    db.prepare('DELETE FROM ippon_images WHERE id = ?').run(photoId);
    const top = db.prepare('SELECT id FROM ippon_images WHERE item_id = ? ORDER BY ordering DESC, id DESC LIMIT 1').get(albumId);
    db.prepare('UPDATE ippon_galery SET image = ?, m_time = ? WHERE id = ?').run(top ? Number(top.id) : 0, nowTs(), albumId);
    sendJson(res, 200, { success: true });
    return true;
  }

  const fotoGalerijaMatch = pathname.match(/^\/api\/foto-galerija(?:\/([a-z0-9-]+))?$/i);
  if (fotoGalerijaMatch && req.method === 'GET') {
    const key = fotoGalerijaMatch[1];
    if (key) {
      const id = parseFotoGalerijaSlug(key);
      if (!id) {
        sendJson(res, 404, { error: 'Galerija nav atrasta' });
        return true;
      }
      const row = db.prepare(`
        SELECT id, area_id, date, name_lv, name_ru, name_en, content_lv, content_ru, content_en, image, public, ordering
        FROM ippon_galery
        WHERE id = ? AND area_id = 25
        LIMIT 1
      `).get(id);
      if (!row) {
        sendJson(res, 404, { error: 'Galerija nav atrasta' });
        return true;
      }
      const imagesByAlbum = getGalleryImageRowsByAlbumIds([id]);
      const item = mapFotoGalerijaAlbum(row, imagesByAlbum, true);
      if (isImportedGalleryPlaceholderTitle(item.nosaukums)) {
        sendJson(res, 404, { error: 'Galerija nav atrasta' });
        return true;
      }
      sendJson(res, 200, { item });
      return true;
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 120), 1), 500);
    const page = Math.max(Number(searchParams.get('page') || 1), 1);
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const rows = db.prepare(`
      SELECT id, area_id, date, name_lv, name_ru, name_en, content_lv, content_ru, content_en, image, public, ordering
      FROM ippon_galery
      WHERE area_id = 25 AND public = 1
      ORDER BY date DESC, id DESC
    `).all();
    const ids = rows.map((r) => r.id);
    const imagesByAlbum = getGalleryImageRowsByAlbumIds(ids);
    const allItems = rows
      .map((row) => mapFotoGalerijaAlbum(row, imagesByAlbum, true))
      .filter((item) => !isImportedGalleryPlaceholderTitle(item.nosaukums))
      .filter((item) => {
        if (!q) return true;
        const hay = normalizeKeywordText([item.nosaukums, item.apraksts, item.datums_display].filter(Boolean).join(' '));
        return hay.includes(q);
      });
    const total = allItems.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const safePage = Math.min(page, totalPages);
    const offset = (safePage - 1) * limit;
    sendJson(res, 200, {
      total,
      page: safePage,
      totalPages,
      limit,
      items: allItems.slice(offset, offset + limit)
    });
    return true;
  }

  if (pathname === '/api/kalendars/admin/sources' && req.method === 'GET') {
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const { source, manual } = queryAllKalendarsItems();
    const filter = (row) => {
      if (!q) return true;
      const hay = normalizeKeywordText([
        row.title,
        row.date,
        row.slug,
        stripHtml(row.custom_html || '')
      ].filter(Boolean).join(' '));
      return hay.includes(q);
    };
    sendJson(res, 200, {
      source: source.filter(filter),
      manual: manual.filter(filter)
    });
    return true;
  }

  if (pathname === '/api/kalendars/admin/source-override' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const sourceId = Number(body.source_id || 0);
        const existing = db.prepare('SELECT * FROM ippon_kalendars_source_overrides WHERE source_id = ? LIMIT 1').get(sourceId);
        const prepared = buildKalendarsSourceOverridePayload(body, existing || null);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        const ts = nowTs();
        if (existing) {
          db.prepare(`
            UPDATE ippon_kalendars_source_overrides
            SET title_override = ?, date_override = ?, image_override = ?, content_override = ?, slug_override = ?, updated_at = ?
            WHERE id = ?
          `).run(v.title_override, v.date_override, v.image_override, v.content_override, v.slug_override, ts, existing.id);
        } else {
          db.prepare(`
            INSERT INTO ippon_kalendars_source_overrides
              (source_id, title_override, date_override, image_override, content_override, slug_override, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(v.source_id, v.title_override, v.date_override, v.image_override, v.content_override, v.slug_override, ts, ts);
        }
        const row = db.prepare('SELECT * FROM ippon_kalendars_source_overrides WHERE source_id = ? LIMIT 1').get(v.source_id);
        sendJson(res, 200, { row });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (pathname === '/api/kalendars/manual' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const prepared = buildKalendarsManualPayload(body, null);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        const ts = nowTs();
        const info = db.prepare(`
          INSERT INTO ippon_kalendars_records
            (title, date, image, slug, content_html, is_published, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(v.title, v.date, v.image, v.slug, v.content_html, v.is_published, ts, ts);
        const row = db.prepare('SELECT * FROM ippon_kalendars_records WHERE id = ? LIMIT 1').get(info.lastInsertRowid);
        sendJson(res, 201, { row: mapKalendarsManualRow(row) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  const kalendarsManualMatch = pathname.match(/^\/api\/kalendars\/manual\/(\d+)$/i);
  if (kalendarsManualMatch && req.method === 'PUT') {
    const id = Number(kalendarsManualMatch[1]);
    const existing = db.prepare('SELECT * FROM ippon_kalendars_records WHERE id = ? LIMIT 1').get(id);
    if (!existing) {
      sendJson(res, 404, { error: 'Kalendars manual record not found' });
      return true;
    }
    parseBody(req)
      .then((body) => {
        const prepared = buildKalendarsManualPayload(body, existing);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        db.prepare(`
          UPDATE ippon_kalendars_records
          SET title = ?, date = ?, image = ?, slug = ?, content_html = ?, is_published = ?, updated_at = ?
          WHERE id = ?
        `).run(v.title, v.date, v.image, v.slug, v.content_html, v.is_published, nowTs(), id);
        const row = db.prepare('SELECT * FROM ippon_kalendars_records WHERE id = ? LIMIT 1').get(id);
        sendJson(res, 200, { row: mapKalendarsManualRow(row) });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (kalendarsManualMatch && req.method === 'DELETE') {
    const id = Number(kalendarsManualMatch[1]);
    const info = db.prepare('DELETE FROM ippon_kalendars_records WHERE id = ?').run(id);
    if (!info.changes) {
      sendJson(res, 404, { error: 'Kalendars manual record not found' });
      return true;
    }
    sendJson(res, 200, { success: true });
    return true;
  }

  const kalendarsMatch = pathname.match(/^\/api\/kalendars(?:\/([a-z0-9-]+))?$/i);
  if (kalendarsMatch && req.method === 'GET') {
    const key = kalendarsMatch[1];
    if (key && key !== 'admin' && key !== 'manual') {
      const parsed = parseKalendarsSourceSlug(key);
      if (!parsed) {
        sendJson(res, 404, { error: 'Kalendars record not found' });
        return true;
      }
      if (parsed.source) {
        const rows = db.prepare(`
          SELECT id, area_id, name, content, lang, image, c_time, m_time
          FROM ippon_text
          WHERE area_id = ?
          ORDER BY c_time DESC, id DESC
        `).all(parsed.id);
        const picked = pickTextSourceRow(rows.filter(detectKalendarsTextRecord));
        if (!picked) {
          sendJson(res, 404, { error: 'Kalendars source record not found' });
          return true;
        }
        const override = db.prepare('SELECT * FROM ippon_kalendars_source_overrides WHERE source_id = ? LIMIT 1').get(parsed.id);
        sendJson(res, 200, { item: mapKalendarsTextSource(picked, override || null) });
        return true;
      }
      const row = db.prepare('SELECT * FROM ippon_kalendars_records WHERE id = ? LIMIT 1').get(parsed.id);
      if (!row) {
        sendJson(res, 404, { error: 'Kalendars manual record not found' });
        return true;
      }
      sendJson(res, 200, { item: mapKalendarsManualRow(row) });
      return true;
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 200), 1), 500);
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const allItems = queryAllKalendarsItems().items.filter((item) => {
      if (!q) return true;
      const hay = normalizeKeywordText([
        item.title,
        item.date,
        item.slug,
        stripHtml(item.custom_html || '')
      ].filter(Boolean).join(' '));
      return hay.includes(q);
    });
    sendJson(res, 200, {
      total: allItems.length,
      items: allItems.slice(0, limit)
    });
    return true;
  }

  if (pathname === '/api/rezultati/validate' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const recordType = normalizeRezultatiRecordType(body.record_type);
        const layoutType = normalizeRezultatiLayoutType(body.layout_type, recordType);
        const structured = parseStructuredDataObject(body.structured_data);
        const validation = validateStructuredDataForLayout(layoutType, structured);
        if (!validation.valid) {
          sendJson(res, 400, {
            valid: false,
            record_type: recordType,
            layout_type: layoutType,
            error: validation.error
          });
          return;
        }
        sendJson(res, 200, {
          valid: true,
          record_type: recordType,
          layout_type: layoutType,
          warning: validation.warning || null
        });
      })
      .catch((error) => sendJson(res, 400, { valid: false, error: error.message }));
    return true;
  }

  if (pathname === '/api/rezultati/sacensibas' && req.method === 'GET') {
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 300), 1), 1000);
    const overrideMap = getSourceOverrideMap();
    const items = queryRezultatiSourceSacensibas(overrideMap).slice(0, limit);
    const countStmt = db.prepare('SELECT COUNT(*) AS c FROM ippon_results WHERE event_id = ?');
    items.forEach((item) => {
      item.vietu_skaits = Number(countStmt.get(item.source_id)?.c || 0);
    });
    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  if (pathname === '/api/rezultati/admin/sources' && req.method === 'GET') {
    const q = normalizeKeywordText(searchParams.get('q') || '');
    const { sacensibas, eksamens, reitingi, manual } = queryAllRezultatiItems();
    const manualSacensibas = manual.filter((row) => row.record_type === 'sacensibas');
    const manualEksamens = manual.filter((row) => row.record_type === 'eksamens');
    const manualReitingi = manual.filter((row) => row.record_type === 'reitings');
    const manualOther = manual.filter((row) => row.record_type !== 'sacensibas' && row.record_type !== 'reitings' && row.record_type !== 'eksamens');
    const sacensibasAll = [...sacensibas, ...manualSacensibas].sort((a, b) => {
      const da = dateSortValue(a.date || a.datums);
      const dbv = dateSortValue(b.date || b.datums);
      if (da !== dbv) return dbv - da;
      return Number(b.source_id || 0) - Number(a.source_id || 0);
    });
    const eksamensAll = [...eksamens, ...manualEksamens].sort((a, b) => {
      const da = dateSortValue(a.date || a.datums);
      const dbv = dateSortValue(b.date || b.datums);
      if (da !== dbv) return dbv - da;
      return Number(b.source_id || 0) - Number(a.source_id || 0);
    });
    const reitingiAll = [...reitingi, ...manualReitingi].sort((a, b) => {
      const da = dateSortValue(a.date || a.datums);
      const dbv = dateSortValue(b.date || b.datums);
      if (da !== dbv) return dbv - da;
      return Number(b.source_id || 0) - Number(a.source_id || 0);
    });
    const filter = (row) => {
      if (!q) return true;
      const hay = normalizeKeywordText([
        row.title,
        row.date,
        row.slug,
        row.record_type,
        row.layout_type,
        row.location,
        row.description,
        stripHtml(row.custom_html || ''),
        structuredToSearchText(row.structured_data)
      ].filter(Boolean).join(' '));
      return hay.includes(q);
    };
    sendJson(res, 200, {
      sacensibas: sacensibasAll.filter(filter),
      eksamens: eksamensAll.filter(filter),
      reitingi: reitingiAll.filter(filter),
      manual: manualOther.filter(filter)
    });
    return true;
  }

  if (pathname === '/api/rezultati/admin/source-override' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const existing = db.prepare(`
          SELECT *
          FROM ippon_rezultati_source_overrides
          WHERE source_table = ? AND source_id = ?
          LIMIT 1
        `).get(String(body.source_table || ''), Number(body.source_id || 0));
        const prepared = buildRezultatiSourceOverridePayload(body, existing || null);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        const ts = nowTs();
        if (existing) {
          db.prepare(`
            UPDATE ippon_rezultati_source_overrides
            SET record_type = ?, layout_type = ?, slug_override = ?, structured_data = ?, custom_html = ?, image_override = ?, updated_at = ?
            WHERE id = ?
          `).run(v.record_type, v.layout_type, v.slug_override, v.structured_data, v.custom_html, v.image_override, ts, existing.id);
        } else {
          db.prepare(`
            INSERT INTO ippon_rezultati_source_overrides (
              source_table, source_id, record_type, layout_type, slug_override, structured_data, custom_html, image_override, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(v.source_table, v.source_id, v.record_type, v.layout_type, v.slug_override, v.structured_data, v.custom_html, v.image_override, ts, ts);
        }
        const row = db.prepare(`
          SELECT *
          FROM ippon_rezultati_source_overrides
          WHERE source_table = ? AND source_id = ?
          LIMIT 1
        `).get(v.source_table, v.source_id);
        sendJson(res, 200, { row, warning: prepared.warning || null });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (pathname === '/api/rezultati/admin/source-delete' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const sourceTable = safeText(body.source_table);
        const sourceId = Number(body.source_id || 0);
        const recordType = normalizeRezultatiRecordType(body.record_type);
        if (!sourceTable || !sourceId) {
          sendJson(res, 400, { error: 'Invalid source delete payload' });
          return;
        }
        if (sourceTable === 'ippon_text') {
          const rows = db.prepare('SELECT id, area_id, name, content, lang FROM ippon_text WHERE area_id = ?').all(sourceId);
          if (!rows.length) {
            sendJson(res, 404, { error: 'Source record not found' });
            return;
          }
          const typedRows = rows.filter((row) => detectTextRecordType(row) === recordType);
          const toDelete = typedRows.length ? typedRows : rows;
          let deleted = 0;
          for (const row of toDelete) {
            const info = db.prepare('DELETE FROM ippon_text WHERE id = ?').run(row.id);
            deleted += Number(info.changes || 0);
          }
          sendJson(res, 200, { success: true, deleted });
          return;
        }
        sendJson(res, 400, { error: 'Source delete not supported for this table' });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (pathname === '/api/rezultati/manual' && req.method === 'POST') {
    parseBody(req)
      .then((body) => {
        const prepared = buildManualRezultatiPayload(body, null);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        const ts = nowTs();
        const info = db.prepare(`
          INSERT INTO ippon_rezultati_records (
            title, date, image, slug, record_type, layout_type, structured_data, custom_html, is_published, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          v.title, v.date, v.image, v.slug, v.record_type, v.layout_type, v.structured_data, v.custom_html, v.is_published, ts, ts
        );
        const row = db.prepare('SELECT * FROM ippon_rezultati_records WHERE id = ? LIMIT 1').get(info.lastInsertRowid);
        sendJson(res, 201, { row: mapRezultatiManualRow(row), warning: prepared.warning || null });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  const manualMatch = pathname.match(/^\/api\/rezultati\/manual\/(\d+)$/i);
  if (manualMatch && req.method === 'PUT') {
    const id = Number(manualMatch[1]);
    const existing = db.prepare('SELECT * FROM ippon_rezultati_records WHERE id = ? LIMIT 1').get(id);
    if (!existing) {
      sendJson(res, 404, { error: 'Manual rezultati record not found' });
      return true;
    }
    parseBody(req)
      .then((body) => {
        const prepared = buildManualRezultatiPayload(body, existing);
        if (prepared.error) {
          sendJson(res, 400, { error: prepared.error });
          return;
        }
        const v = prepared.values;
        const ts = nowTs();
        db.prepare(`
          UPDATE ippon_rezultati_records
          SET title = ?, date = ?, image = ?, slug = ?, record_type = ?, layout_type = ?, structured_data = ?, custom_html = ?, is_published = ?, updated_at = ?
          WHERE id = ?
        `).run(v.title, v.date, v.image, v.slug, v.record_type, v.layout_type, v.structured_data, v.custom_html, v.is_published, ts, id);
        const row = db.prepare('SELECT * FROM ippon_rezultati_records WHERE id = ? LIMIT 1').get(id);
        sendJson(res, 200, { row: mapRezultatiManualRow(row), warning: prepared.warning || null });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (manualMatch && req.method === 'DELETE') {
    const id = Number(manualMatch[1]);
    const info = db.prepare('DELETE FROM ippon_rezultati_records WHERE id = ?').run(id);
    if (!info.changes) {
      sendJson(res, 404, { error: 'Manual rezultati record not found' });
      return true;
    }
    sendJson(res, 200, { success: true });
    return true;
  }

  const rezultatiMatch = pathname.match(/^\/api\/rezultati(?:\/([a-z0-9-]+))?$/i);
  if (rezultatiMatch && req.method === 'GET') {
    const key = rezultatiMatch[1];
    if (key && key !== 'manual' && key !== 'admin') {
      const parsedManual = parseManualSourceSlug(key);
      if (parsedManual) {
        const manualRow = db.prepare('SELECT * FROM ippon_rezultati_records WHERE id = ? LIMIT 1').get(parsedManual.id);
        if (!manualRow) {
          sendJson(res, 404, { error: 'Manual rezultati record not found' });
          return true;
        }
        const item = mapRezultatiManualRow(manualRow);
        if (item.record_type !== parsedManual.record_type) {
          sendJson(res, 404, { error: 'Manual rezultati record type mismatch' });
          return true;
        }
        sendJson(res, 200, { item });
        return true;
      }

      if (/^\d+$/.test(key)) {
        const row = db.prepare('SELECT * FROM ippon_sorevnovanija WHERE id = ? LIMIT 1').get(Number(key));
        if (!row) {
          sendJson(res, 404, { error: 'Rezultati record not found' });
          return true;
        }
        const mapped = mapRezultatiSacensibasSource(row, getSourceOverrideMap().get(`ippon_sorevnovanija:${row.id}`));
        const resultRows = db.prepare(`
          SELECT
            r.id,
            r.result,
            r.info_lv,
            r.info_ru,
            r.info_en,
            sp.id AS sportist_id,
            sp.name_lv AS sportist_name_lv,
            sp.name_ru AS sportist_name_ru,
            sp.name_en AS sportist_name_en
          FROM ippon_results r
          LEFT JOIN ippon_sportists sp ON sp.id = r.sportist_id
          WHERE r.event_id = ?
          ORDER BY r.ordering DESC, r.id DESC
        `).all(row.id).map((r) => ({
          id: r.id,
          sportists: pickLang(r, 'sportist_name_lv', 'sportist_name_ru', 'sportist_name_en') || `#${r.sportist_id || ''}`,
          vieta: safeText(r.result),
          informacija: pickLang(r, 'info_lv', 'info_ru', 'info_en') || ''
        }));
        mapped.results_rows = resultRows;
        mapped.vietu_skaits = resultRows.length;
        sendJson(res, 200, { item: mapped });
        return true;
      }

      const parsed = parseSourceSlug(key);
      if (!parsed) {
        sendJson(res, 404, { error: 'Rezultati record not found' });
        return true;
      }
      const overrideMap = getSourceOverrideMap();
      if (parsed.record_type === 'sacensibas') {
        const row = db.prepare('SELECT * FROM ippon_sorevnovanija WHERE id = ? LIMIT 1').get(parsed.id);
        if (!row) {
          sendJson(res, 404, { error: 'Sacensibas source record not found' });
          return true;
        }
        const item = mapRezultatiSacensibasSource(row, overrideMap.get(`ippon_sorevnovanija:${row.id}`));
        const resultRows = db.prepare(`
          SELECT
            r.id,
            r.result,
            r.info_lv,
            r.info_ru,
            r.info_en,
            sp.id AS sportist_id,
            sp.name_lv AS sportist_name_lv,
            sp.name_ru AS sportist_name_ru,
            sp.name_en AS sportist_name_en
          FROM ippon_results r
          LEFT JOIN ippon_sportists sp ON sp.id = r.sportist_id
          WHERE r.event_id = ?
          ORDER BY r.ordering DESC, r.id DESC
        `).all(row.id).map((r) => ({
          id: r.id,
          sportists: pickLang(r, 'sportist_name_lv', 'sportist_name_ru', 'sportist_name_en') || `#${r.sportist_id || ''}`,
          vieta: safeText(r.result),
          informacija: pickLang(r, 'info_lv', 'info_ru', 'info_en') || ''
        }));
        item.results_rows = resultRows;
        item.vietu_skaits = resultRows.length;
        sendJson(res, 200, { item });
        return true;
      }

      if (parsed.record_type === 'eksamens') {
        const rows = db.prepare(`
          SELECT id, area_id, name, content, lang, image, c_time, m_time
          FROM ippon_text
          WHERE area_id = ?
          ORDER BY c_time DESC, id DESC
        `).all(parsed.id);
        const row = pickTextSourceRow(rows);
        if (!row) {
          sendJson(res, 404, { error: 'Eksāmens source record not found' });
          return true;
        }
        const item = mapRezultatiTextSource(row, overrideMap.get(`ippon_text:${parsed.id}`), 'eksamens');
        sendJson(res, 200, { item });
        return true;
      }

      if (parsed.record_type === 'reitings') {
        const rows = db.prepare(`
          SELECT id, area_id, name, content, lang, image, c_time, m_time
          FROM ippon_text
          WHERE area_id = ?
          ORDER BY c_time DESC, id DESC
        `).all(parsed.id);
        const row = pickTextSourceRow(rows);
        if (!row) {
          sendJson(res, 404, { error: 'Reitings source record not found' });
          return true;
        }
        const item = mapRezultatiTextSource(row, overrideMap.get(`ippon_text:${parsed.id}`), 'reitings');
        sendJson(res, 200, { item });
        return true;
      }

      const row = db.prepare('SELECT * FROM ippon_rezultati_records WHERE id = ? LIMIT 1').get(parsed.id);
      if (!row) {
        sendJson(res, 404, { error: 'Manual rezultati record not found' });
        return true;
      }
      sendJson(res, 200, { item: mapRezultatiManualRow(row) });
      return true;
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 120), 1), 500);
    const requestedPage = Math.max(Number(searchParams.get('page') || 1), 1);
    const recordTypeFilter = normalizeRezultatiRecordType(String(searchParams.get('record_type') || '').trim());
    const q = normalizeKeywordText(searchParams.get('q') || '');

    const allItems = queryAllRezultatiItems().items.filter((item) => {
      if (searchParams.get('record_type') && item.record_type !== recordTypeFilter) return false;
      if (!q) return true;
      const hay = normalizeKeywordText([
        item.title,
        item.date,
        item.slug,
        item.record_type,
        item.layout_type
      ].filter(Boolean).join(' '));
      return hay.includes(q);
    });

    const total = allItems.length;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * limit;
    sendJson(res, 200, {
      total,
      page,
      limit,
      totalPages,
      items: allItems.slice(offset, offset + limit)
    });
    return true;
  }

  const newsMatch = pathname.match(/^\/api\/jaunumi(?:\/([a-z0-9-]+))?$/i);
  if (newsMatch && req.method === 'GET') {
    const slug = newsMatch[1];
    if (slug) {
      const row = db.prepare('SELECT * FROM jaunumi WHERE slug = ? LIMIT 1').get(slug);
      if (!row) {
        sendJson(res, 404, { error: 'News not found' });
        return true;
      }
      sendJson(res, 200, { item: mapNewsRow(row) });
      return true;
    }

    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 10), 1), 100);
    const requestedPage = Math.max(Number(searchParams.get('page') || 1), 1);
    const total = db.prepare('SELECT COUNT(*) AS count FROM jaunumi').get().count;
    const totalPages = Math.max(Math.ceil(total / limit), 1);
    const page = Math.min(requestedPage, totalPages);
    const offset = (page - 1) * limit;
    const rows = db.prepare(`
      SELECT * FROM jaunumi
      ORDER BY COALESCE(position, 0) DESC, id DESC
      LIMIT ?
      OFFSET ?
    `).all(limit, offset);
    sendJson(res, 200, {
      total,
      page,
      limit,
      totalPages,
      items: rows.map(mapNewsRow)
    });
    return true;
  }

  const hallMatch = pathname.match(/^\/api\/zales\/(imanta|zolitude|sloka)$/i);
  if (hallMatch && req.method === 'GET') {
    const slug = hallMatch[1].toLowerCase();
    const cfg = HALL_TABLES[slug];
    const row = db.prepare(`
      SELECT * FROM ${cfg.table}
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    if (!row) {
      sendJson(res, 404, { error: 'Hall not found' });
      return true;
    }
    sendJson(res, 200, { item: mapHallRow(slug, row) });
    return true;
  }

  if (pathname === '/api/nodarbibas/saraksts' && req.method === 'GET') {
    const row = db.prepare(`
      SELECT * FROM nodarbibas_saraksts
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    if (!row) {
      sendJson(res, 404, { error: 'Saraksts not found' });
      return true;
    }
    sendJson(res, 200, { item: mapNodarbibasRow('nodarbibas_saraksts', row) });
    return true;
  }

  if (pathname === '/api/nodarbibas/izlases-grupas' && req.method === 'GET') {
    const row = db.prepare(`
      SELECT * FROM nodarbibas_izlases_grupas
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    if (!row) {
      sendJson(res, 404, { error: 'Izlases grupas not found' });
      return true;
    }
    sendJson(res, 200, { item: mapNodarbibasRow('nodarbibas_izlases_grupas', row) });
    return true;
  }

  if (pathname === '/api/nodarbibas/individualas-nodarbibas' && req.method === 'GET') {
    const row = db.prepare(`
      SELECT * FROM nodarbibas_individualas_nodarbibas
      ORDER BY updated_at DESC, id DESC
      LIMIT 1
    `).get();
    if (!row) {
      sendJson(res, 404, { error: 'Individualas nodarbibas not found' });
      return true;
    }
    sendJson(res, 200, { item: mapNodarbibasRow('nodarbibas_individualas_nodarbibas', row) });
    return true;
  }

  if (pathname === '/api/sportisti' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT s.*
      FROM ippon_sportists s
      WHERE s.remove_date = 0
        AND COALESCE(s.is_hidden, 0) = 0
      ORDER BY COALESCE(s.position, 0) DESC, s.id DESC
    `).all();

    const items = rows.map((row, idx) => {
      const fullName = pickLang(row, 'name_lv', 'name_ru', 'name_en');
      const image = mapLegacyImageById(row.image);
      const fotoAttels = normalizeStoredMediaUrl(row.foto_attels);
      return withResolvedMedia({
        id: row.id,
        slug: makeSportistSlug(fullName, row.id),
        index: idx + 1,
        vards_uzvards: fullName,
        dzimsanas_datums: row.date || '',
        foto: fotoAttels || image?.url || null,
        galerija: parseGallery(row.galerija),
        image,
        raw: {
          name_lv: row.name_lv,
          name_ru: row.name_ru,
          name_en: row.name_en
        }
      }, { category: 'athletes', id: row.id, fallbackMain: fotoAttels || image?.url || null });
    });

    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  const treneriMatch = pathname.match(/^\/api\/treneri(?:\/([a-z0-9-]+))?$/i);
  if (treneriMatch && req.method === 'GET') {
    const slug = treneriMatch[1];
    if (slug) {
      const row = db.prepare('SELECT * FROM treneri WHERE slug = ? LIMIT 1').get(slug);
      if (!row) {
        sendJson(res, 404, { error: 'Treneris nav atrasts' });
        return true;
      }
      sendJson(res, 200, { item: mapTrainerRow(row) });
      return true;
    }

    const limitRaw = Number(searchParams.get('limit') || 0);
    const useLimit = Number.isFinite(limitRaw) && limitRaw > 0;
    const rows = useLimit
      ? db.prepare(`
          SELECT * FROM treneri
          ORDER BY updated_at DESC, id DESC
          LIMIT ?
        `).all(Math.min(Math.floor(limitRaw), 200))
      : db.prepare(`
          SELECT * FROM treneri
          ORDER BY updated_at DESC, id DESC
        `).all();

    const items = rows.map(mapTrainerRow);
    sendJson(res, 200, { total: items.length, items });
    return true;
  }

  const sportistAchievementsMatch = pathname.match(/^\/api\/sportisti\/([0-9]+)\/sasniegumi$/i);
  if (sportistAchievementsMatch && req.method === 'GET') {
    const sportistId = Number(sportistAchievementsMatch[1]);
    if (!sportistId) {
      sendJson(res, 400, { error: 'Invalid sportist id' });
      return true;
    }
    const itemsCustom = db.prepare(`
      SELECT id, sportist_id, datums, nosaukums, rezultats, vieta, statuss, informacija, created_at, updated_at
      FROM sportisti_sasniegumi
      WHERE sportist_id = ?
      ORDER BY updated_at DESC, id DESC
    `).all(sportistId).map((item) => ({
      id: item.id,
      datums: item.datums || '',
      nosaukums: item.nosaukums || '',
      rezultats: item.rezultats || '',
      vieta: item.vieta || '',
      statuss: item.statuss || '',
      informacija: item.informacija || ''
    }));

    const itemsLegacy = db.prepare(`
      SELECT
        r.id,
        r.result,
        r.info_lv,
        r.info_ru,
        r.info_en,
        ev.date AS event_date,
        ev.name_lv AS event_name_lv,
        ev.name_ru AS event_name_ru,
        ev.name_en AS event_name_en,
        ev.location_lv AS event_location_lv,
        ev.location_ru AS event_location_ru,
        ev.location_en AS event_location_en,
        ev.status_id AS event_status_id
      FROM ippon_results r
      LEFT JOIN ippon_sorevnovanija ev ON ev.id = r.event_id
      WHERE r.sportist_id = ?
      ORDER BY ev.date DESC, r.ordering DESC, r.id DESC
    `).all(sportistId).map((item) => ({
      id: item.id,
      datums: item.event_date || '',
      nosaukums: pickLang(item, 'event_name_lv', 'event_name_ru', 'event_name_en'),
      rezultats: item.result || '',
      vieta: pickLang(item, 'event_location_lv', 'event_location_ru', 'event_location_en'),
      statuss: item.event_status_id != null ? String(item.event_status_id) : '',
      informacija: pickLang(item, 'info_lv', 'info_ru', 'info_en')
    }));

    const items = itemsCustom.length > 0
      ? mergeAchievementsLists(itemsCustom)
      : mergeAchievementsLists(itemsCustom, itemsLegacy);
    sendJson(res, 200, { sportist_id: sportistId, items });
    return true;
  }

  if (sportistAchievementsMatch && req.method === 'PUT') {
    const sportistId = Number(sportistAchievementsMatch[1]);
    if (!sportistId) {
      sendJson(res, 400, { error: 'Invalid sportist id' });
      return true;
    }

    parseBody(req)
      .then((body) => {
        const items = Array.isArray(body.items) ? body.items : null;
        if (!items) {
          sendJson(res, 400, { error: 'items must be an array' });
          return;
        }

        const existingSportist = db.prepare(`
          SELECT id FROM ippon_sportists WHERE id = ? LIMIT 1
        `).get(sportistId);
        if (!existingSportist) {
          sendJson(res, 404, { error: 'Sportists not found' });
          return;
        }

        const ts = nowTs();
        const insertStmt = db.prepare(`
          INSERT INTO sportisti_sasniegumi (
            sportist_id, datums, nosaukums, rezultats, vieta, statuss, informacija, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        db.exec('BEGIN');
        try {
          db.prepare('DELETE FROM sportisti_sasniegumi WHERE sportist_id = ?').run(sportistId);
          for (const raw of items) {
            const row = raw || {};
            insertStmt.run(
              sportistId,
              row.datums != null ? String(row.datums).trim() : null,
              row.nosaukums != null ? String(row.nosaukums).trim() : null,
              row.rezultats != null ? String(row.rezultats).trim() : null,
              row.vieta != null ? String(row.vieta).trim() : null,
              row.statuss != null ? String(row.statuss).trim() : null,
              row.informacija != null ? String(row.informacija).trim() : null,
              ts,
              ts
            );
          }
          db.exec('COMMIT');
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }

        const savedItemsCustom = db.prepare(`
          SELECT id, sportist_id, datums, nosaukums, rezultats, vieta, statuss, informacija, created_at, updated_at
          FROM sportisti_sasniegumi
          WHERE sportist_id = ?
          ORDER BY updated_at DESC, id DESC
        `).all(sportistId).map((item) => ({
          id: item.id,
          datums: item.datums || '',
          nosaukums: item.nosaukums || '',
          rezultats: item.rezultats || '',
          vieta: item.vieta || '',
          statuss: item.statuss || '',
          informacija: item.informacija || ''
        }));

        const savedItemsLegacy = db.prepare(`
          SELECT
            r.id,
            r.result,
            r.info_lv,
            r.info_ru,
            r.info_en,
            ev.date AS event_date,
            ev.name_lv AS event_name_lv,
            ev.name_ru AS event_name_ru,
            ev.name_en AS event_name_en,
            ev.location_lv AS event_location_lv,
            ev.location_ru AS event_location_ru,
            ev.location_en AS event_location_en,
            ev.status_id AS event_status_id
          FROM ippon_results r
          LEFT JOIN ippon_sorevnovanija ev ON ev.id = r.event_id
          WHERE r.sportist_id = ?
          ORDER BY ev.date DESC, r.ordering DESC, r.id DESC
        `).all(sportistId).map((item) => ({
          id: item.id,
          datums: item.event_date || '',
          nosaukums: pickLang(item, 'event_name_lv', 'event_name_ru', 'event_name_en'),
          rezultats: item.result || '',
          vieta: pickLang(item, 'event_location_lv', 'event_location_ru', 'event_location_en'),
          statuss: item.event_status_id != null ? String(item.event_status_id) : '',
          informacija: pickLang(item, 'info_lv', 'info_ru', 'info_en')
        }));

        const mergedItems = savedItemsCustom.length > 0
          ? mergeAchievementsLists(savedItemsCustom)
          : mergeAchievementsLists(savedItemsCustom, savedItemsLegacy);

        sendJson(res, 200, { sportist_id: sportistId, items: mergedItems });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  const sportistMatch = pathname.match(/^\/api\/sportisti\/([a-z0-9-]+)$/i);
  if (sportistMatch && req.method === 'GET') {
    const id = parseSportistSlug(sportistMatch[1]);
    if (!id) {
      sendJson(res, 404, { error: 'Sportists not found' });
      return true;
    }

    const row = db.prepare(`
      SELECT *
      FROM ippon_sportists
      WHERE id = ?
        AND remove_date = 0
        AND COALESCE(is_hidden, 0) = 0
      LIMIT 1
    `).get(id);

    if (!row) {
      sendJson(res, 404, { error: 'Sportists not found' });
      return true;
    }

    const name = pickLang(row, 'name_lv', 'name_ru', 'name_en');
    const achievementsCustom = db.prepare(`
      SELECT id, datums, nosaukums, rezultats, vieta, statuss, informacija
      FROM sportisti_sasniegumi
      WHERE sportist_id = ?
      ORDER BY updated_at DESC, id DESC
    `).all(id).map((item) => ({
      id: item.id,
      datums: item.datums || '',
      nosaukums: item.nosaukums || '',
      rezultats: item.rezultats || '',
      vieta: item.vieta || '',
      statuss: item.statuss || '',
      informacija: item.informacija || ''
    }));

    const achievementsLegacy = db.prepare(`
      SELECT
        r.id,
        r.event_id,
        r.result,
        r.info_lv,
        r.info_ru,
        r.info_en,
        r.ordering,
        ev.date AS event_date,
        ev.name_lv AS event_name_lv,
        ev.name_ru AS event_name_ru,
        ev.name_en AS event_name_en,
        ev.location_lv AS event_location_lv,
        ev.location_ru AS event_location_ru,
        ev.location_en AS event_location_en,
        ev.status_id AS event_status_id
      FROM ippon_results r
      LEFT JOIN ippon_sorevnovanija ev ON ev.id = r.event_id
      WHERE r.sportist_id = ?
      ORDER BY ev.date DESC, r.ordering DESC, r.id DESC
    `).all(id).map((item) => ({
      id: item.id,
      datums: item.event_date || '',
      nosaukums: pickLang(item, 'event_name_lv', 'event_name_ru', 'event_name_en'),
      rezultats: item.result || '',
      vieta: pickLang(item, 'event_location_lv', 'event_location_ru', 'event_location_en'),
      statuss: item.event_status_id != null ? String(item.event_status_id) : '',
      informacija: pickLang(item, 'info_lv', 'info_ru', 'info_en')
    }));
    const achievements = achievementsCustom.length > 0
      ? mergeAchievementsLists(achievementsCustom)
      : mergeAchievementsLists(
          achievementsCustom,
          parseSportistAchievementsJson(row.dostizhenija_lv),
          achievementsLegacy
        );

    sendJson(res, 200, {
      item: withResolvedMedia({
        id: row.id,
        slug: makeSportistSlug(name, row.id),
        vards_uzvards: name,
        dzimsanas_datums: row.date || '',
        foto: normalizeStoredMediaUrl(row.foto_attels) || mapLegacyImageById(row.image)?.url || null,
        galerija: parseGallery(row.galerija),
        par_sevi_html: row.o_sebe_lv || row.o_sebe_ru || row.o_sebe_en || '',
        par_sevi_text: stripHtml(row.o_sebe_lv || row.o_sebe_ru || row.o_sebe_en || ''),
        sasniegumi_html: row.dostizhenija_lv || row.dostizhenija_ru || row.dostizhenija_en || '',
        sasniegumi_text: stripHtml(row.dostizhenija_lv || row.dostizhenija_ru || row.dostizhenija_en || ''),
        achievements
      }, { category: 'athletes', id: row.id, fallbackMain: row.foto_attels || mapLegacyImageById(row.image)?.url || null })
    });
    return true;
  }

  if (pathname === '/api/kluba-noteikumi' && req.method === 'GET') {
    const rows = db.prepare(`
      SELECT * FROM kluba_noteikumi
      ORDER BY created_at DESC, id DESC
    `).all();
    sendJson(res, 200, {
      total: rows.length,
      items: rows.map((row) => ({
        id: row.id,
        faili: row.faili,
        teksts: row.teksts,
        created_at: row.created_at,
        updated_at: row.updated_at
      }))
    });
    return true;
  }

  if (pathname === '/api/tables' && req.method === 'GET') {
    const tables = [...ALLOWED_TABLES]
      .filter((name) => name !== 'sportisti_sasniegumi')
      .map((name) => {
      const columns = getTableColumns(name);
      const pk = columns.find((c) => c.pk === 1)?.name || 'id';
      return { name, columns, pk };
    });
    sendJson(res, 200, { tables });
    return true;
  }

  const parsed = extractTableFromPath(pathname);
  if (!parsed) return false;

  const { table, id } = parsed;
  if (!ALLOWED_TABLES.has(table)) {
    sendJson(res, 404, { error: 'Unknown table' });
    return true;
  }

  const columns = getTableColumns(table);
  const pk = columns.find((c) => c.pk === 1)?.name || 'id';

  if (req.method === 'GET' && id === null) {
    const limit = Math.min(Math.max(Number(searchParams.get('limit') || 100), 1), 500);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);
    const includeRemoved = toBool(searchParams.get('includeRemoved') || '0');
    const search = String(searchParams.get('search') || '').trim();
    const whereParts = [];
    const whereArgs = [];
    if (table === 'ippon_sportists' && !includeRemoved) {
      whereParts.push('remove_date = 0');
    }
    if (table === 'ippon_sportists' && search) {
      const like = `%${search}%`;
      whereParts.push('(name_lv LIKE ? OR date LIKE ? OR o_sebe_lv LIKE ? OR CAST(id AS TEXT) LIKE ?)');
      whereArgs.push(like, like, like, like);
    }
    const whereClause = whereParts.length > 0 ? `WHERE ${whereParts.join(' AND ')}` : '';
    const orderBy = table === 'ippon_galery'
      ? 'date DESC, id DESC'
      : table === 'video_galerija'
        ? 'date DESC, id DESC'
      : table === 'raksti_prese'
        ? 'datums DESC, id DESC'
      : table === 'jaunumi'
        ? 'COALESCE(position, 0) DESC, id DESC'
      : table === 'ippon_sportists'
        ? 'COALESCE(position, 0) DESC, id DESC'
      : (table === 'treneri' || table === 'kluba_noteikumi' || table === 'ippon_sorevnovanija' || table.startsWith('zales_') || table.startsWith('nodarbibas_'))
        ? 'created_at DESC, id DESC'
        : `${pk} DESC`;
    const rows = db.prepare(`SELECT * FROM ${table} ${whereClause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).all(...whereArgs, limit, offset);
    const total = db.prepare(`SELECT COUNT(*) AS count FROM ${table} ${whereClause}`).get(...whereArgs).count;
    sendJson(res, 200, { table, pk, columns, rows, total, limit, offset });
    return true;
  }

  if (req.method === 'POST' && id === null) {
    parseBody(req)
      .then((body) => {
        if (table === 'ippon_sportists') {
          const ts = nowTs();
          const nameLv = String(body.name_lv || '').trim();
          const dateValue = String(body.date || '').trim();
          const aboutLv = body.o_sebe_lv != null ? String(body.o_sebe_lv).trim() : '';
          const achievementsLv = body.dostizhenija_lv != null ? String(body.dostizhenija_lv).trim() : '';

          if (!nameLv) {
            sendJson(res, 400, { error: 'Field name_lv is required' });
            return;
          }

          db.prepare(`
            INSERT INTO ippon_sportists (
              area_id, galery_id, name_ru, name_lv, name_en, date,
              o_sebe_ru, o_sebe_lv, o_sebe_en,
              dostizhenija_ru, dostizhenija_lv, dostizhenija_en,
              image, foto_attels, galerija, is_hidden, position, public, special, ordering, c_time, m_time, remove_date, remove_user
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            15,
            0,
            '',
            nameLv,
            '',
            dateValue || '0000-00-00',
            '',
            aboutLv,
            '',
            '',
            achievementsLv,
            '',
            0,
            body.foto_attels ? String(body.foto_attels).trim() : null,
            JSON.stringify(parseGallery(body.galerija)),
            toIntFlag(body.is_hidden, 0),
            toIntValue(body.position, 0),
            1,
            0,
            0,
            ts,
            ts,
            0,
            0
          );

          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = last_insert_rowid()`).get();
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'jaunumi') {
          const title = String(body.nosaukums || '').trim();
          const datums = String(body.datums || '').trim();
          const zina = String(body.zina || '').trim();
          const slugInput = String(body.slug || title).trim();
          if (!title || !datums || !zina) {
            sendJson(res, 400, { error: 'Fields datums, nosaukums, zina are required' });
            return;
          }

          const ts = nowTs();
          const slug = uniqueNewsSlug(slugInput);
          const info = db.prepare(`
            INSERT INTO jaunumi (datums, nosaukums, foto_attels, galerija, ievads, zina, slug, position, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            datums,
            title,
            body.foto_attels ? String(body.foto_attels).trim() : null,
            JSON.stringify(parseGallery(body.galerija)),
            body.ievads ? String(body.ievads).trim() : null,
            zina,
            slug,
            toIntValue(body.position, 0),
            ts,
            ts
          );
          const row = db.prepare('SELECT * FROM jaunumi WHERE id = ?').get(info.lastInsertRowid);
          sendJson(res, 201, { row: mapNewsRow(row) });
          return;
        }

        if (table === 'raksti_prese') {
          const nosaukums = String(body.nosaukums || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Field nosaukums is required' });
            return;
          }

          const ts = nowTs();
          const info = db.prepare(`
            INSERT INTO raksti_prese (datums, nosaukums, attels, ievads, zina, saite, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            String(body.datums || '').trim(),
            nosaukums,
            body.attels ? String(body.attels).trim() : null,
            body.ievads != null ? String(body.ievads) : '',
            body.zina != null ? String(body.zina) : '',
            body.saite ? String(body.saite).trim() : '',
            ts,
            ts
          );
          const row = db.prepare('SELECT * FROM raksti_prese WHERE id = ?').get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'treneri') {
          const fullName = String(body.vards_uzvards || '').trim();
          if (!fullName) {
            sendJson(res, 400, { error: 'Field vards_uzvards is required' });
            return;
          }

          const birthDate = body.dzimsanas_datums != null ? String(body.dzimsanas_datums).trim() : '';
          if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
            sendJson(res, 400, { error: 'Field dzimsanas_datums must be in YYYY-MM-DD format' });
            return;
          }

          const ts = nowTs();
          const slug = uniqueTrainerSlug(String(body.slug || fullName).trim());
          const info = db.prepare(`
            INSERT INTO treneri (
              vards_uzvards, dzimsanas_datums, foto_attels, galerija,
              izglitiba, josta, saka_studet, koucinga_pieredze,
              par_mani, sasniegumi, slug, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            fullName,
            birthDate || null,
            body.foto_attels ? String(body.foto_attels).trim() : null,
            JSON.stringify(parseGallery(body.galerija)),
            body.izglitiba != null ? String(body.izglitiba).trim() : null,
            body.josta != null ? String(body.josta).trim() : null,
            body.saka_studet != null ? String(body.saka_studet).trim() : null,
            body.koucinga_pieredze != null ? String(body.koucinga_pieredze).trim() : null,
            body.par_mani != null ? String(body.par_mani).trim() : null,
            body.sasniegumi != null ? String(body.sasniegumi).trim() : null,
            slug,
            ts,
            ts
          );
          const row = db.prepare('SELECT * FROM treneri WHERE id = ?').get(info.lastInsertRowid);
          sendJson(res, 201, { row: mapTrainerRow(row) });
          return;
        }

        if (table === 'kluba_noteikumi') {
          const teksts = String(body.teksts || '').trim();
          if (!teksts) {
            sendJson(res, 400, { error: 'Field teksts is required' });
            return;
          }
          const ts = nowTs();
          const info = db.prepare(`
            INSERT INTO kluba_noteikumi (faili, teksts, created_at, updated_at)
            VALUES (?, ?, ?, ?)
          `).run(
            body.faili ? String(body.faili).trim() : null,
            teksts,
            ts,
            ts
          );
          const row = db.prepare('SELECT * FROM kluba_noteikumi WHERE id = ?').get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (isHallTable(table)) {
          const title = String(body.nosaukums || '').trim();
          if (!title) {
            sendJson(res, 400, { error: 'Field nosaukums is required' });
            return;
          }

          const ts = nowTs();
          const info = db.prepare(`
            INSERT INTO ${table} (nosaukums, ievads, attels, galerija, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            title,
            body.ievads ? String(body.ievads).trim() : null,
            body.attels ? String(body.attels).trim() : null,
            JSON.stringify(parseGallery(body.galerija)),
            ts,
            ts
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (isNodarbibasTable(table)) {
          const ts = nowTs();
          const info = table === 'nodarbibas_izlases_grupas'
            ? db.prepare(`
                INSERT INTO ${table} (ievads, attels, created_at, updated_at)
                VALUES (?, ?, ?, ?)
              `).run(
                body.ievads ? String(body.ievads).trim() : null,
                body.attels ? String(body.attels).trim() : null,
                ts,
                ts
              )
            : table === 'nodarbibas_individualas_nodarbibas'
            ? db.prepare(`
                INSERT INTO ${table} (ievads, created_at, updated_at)
                VALUES (?, ?, ?)
              `).run(
                body.ievads ? String(body.ievads).trim() : null,
                ts,
                ts
              )
            : db.prepare(`
                INSERT INTO ${table} (attels, created_at, updated_at)
                VALUES (?, ?, ?)
              `).run(
                body.attels ? String(body.attels).trim() : null,
                ts,
                ts
              );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'ippon_galery') {
          const titleLv = String(body.name_lv || body.nosaukums || '').trim();
          if (!titleLv) {
            sendJson(res, 400, { error: 'Lauks Nosaukums ir obligāts.' });
            return;
          }
          const ts = nowTs();
          const unixDate = toUnixTsFromValue(body.date || body.datums);
          const info = db.prepare(`
            INSERT INTO ippon_galery (
              area_id, date, name_en, name_ru, name_lv,
              content_en, content_ru, content_lv,
              image, public, ordering, c_time, m_time, d_time
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            25,
            unixDate,
            '',
            String(body.name_ru || titleLv).trim(),
            titleLv,
            '',
            '',
            String(body.content_lv || body.apraksts || '').trim(),
            Number(body.image || 0),
            1,
            Number(body.ordering || 0),
            ts,
            ts,
            0
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'ippon_sorevnovanija') {
          const prepared = buildRezultatiPayload(body, null);
          if (prepared.error) {
            sendJson(res, 400, { error: prepared.error });
            return;
          }
          const ts = nowTs();
          const v = prepared.values;
          const info = db.prepare(`
            INSERT INTO ippon_sorevnovanija (
              area_id, status_id, galery_id, date,
              name_lv, name_ru, name_en,
              location_lv, location_ru, location_en,
              info_lv, info_ru, info_en,
              results_url, image, public, ordering,
              c_time, m_time,
              record_type, layout_type, slug, foto_attels, galerija, structured_data, custom_html, created_at, updated_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `).run(
            v.area_id,
            v.status_id,
            v.galery_id,
            v.date,
            v.name_lv,
            v.name_ru,
            v.name_en,
            v.location_lv,
            v.location_ru,
            v.location_en,
            v.info_lv,
            v.info_ru,
            v.info_en,
            v.results_url,
            v.image,
            v.public,
            v.ordering,
            ts,
            ts,
            v.record_type,
            v.layout_type,
            v.slug,
            v.foto_attels,
            v.galerija,
            v.structured_data,
            v.custom_html,
            ts,
            ts
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row, warning: prepared.warning || null });
          return;
        }

        if (isSadarbibaCmsTable(table)) {
          const ts = nowTs();
          const defaultTitle = table === 'sadarbiba_sponsoru_atbalsts'
            ? 'Sponsoru atbalsts'
            : 'Sporta zāles īre';
          const nosaukums = String(body.nosaukums || '').trim() || defaultTitle;
          const saturs = body.saturs != null ? String(body.saturs) : '';
          const fotoAttels = body.foto_attels ? String(body.foto_attels).trim() : null;
          const galerija = JSON.stringify(parseGallery(body.galerija));
          const info = db.prepare(`
            INSERT INTO ${table}
              (nosaukums, saturs, foto_attels, galerija, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            nosaukums,
            saturs,
            fotoAttels,
            galerija,
            ts,
            ts
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'sadarbiba_musu_partneri') {
          const ts = nowTs();
          const nosaukums = String(body.nosaukums || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Lauks nosaukums ir obligāts.' });
            return;
          }
          const links = body.links != null ? String(body.links).trim() : '';
          const fotoAttels = body.foto_attels ? String(body.foto_attels).trim() : null;
          const informacija = body.informacija != null ? String(body.informacija) : '';

          const info = db.prepare(`
            INSERT INTO sadarbiba_musu_partneri
              (nosaukums, links, foto_attels, informacija, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
          `).run(
            nosaukums,
            links || null,
            fotoAttels,
            informacija,
            ts,
            ts
          );

          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        if (table === 'video_galerija') {
          const nosaukums = String(body.nosaukums || '').trim();
          const videoSaite = String(body.video_saite || '').trim();
          const dateValue = String(body.date || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Lauks nosaukums ir obligāts.' });
            return;
          }
          if (!videoSaite) {
            sendJson(res, 400, { error: 'Lauks video_saite ir obligāts.' });
            return;
          }
          const ts = nowTs();
          const info = db.prepare(`
            INSERT INTO video_galerija (nosaukums, video_saite, date, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
          `).run(
            nosaukums,
            videoSaite,
            dateValue || null,
            ts,
            ts
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
          sendJson(res, 201, { row });
          return;
        }

        const allowedColumns = columns.map((c) => c.name).filter((name) => name !== pk);
        const keys = allowedColumns.filter((name) => Object.prototype.hasOwnProperty.call(body, name));
        if (keys.length === 0) {
          sendJson(res, 400, { error: 'No data to insert' });
          return;
        }

        const placeholders = keys.map(() => '?').join(', ');
        const values = keys.map((k) => body[k]);
        const sql = `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders})`;
        const info = db.prepare(sql).run(...values);
        const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(info.lastInsertRowid);
        sendJson(res, 201, { row });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (req.method === 'PUT' && id !== null) {
    parseBody(req)
      .then((body) => {
        if (table === 'ippon_sportists') {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const nameLv = body.name_lv != null ? String(body.name_lv).trim() : String(existing.name_lv || '').trim();
          if (!nameLv) {
            sendJson(res, 400, { error: 'Field name_lv is required' });
            return;
          }

          db.prepare(`
            UPDATE ippon_sportists
            SET
              name_lv = ?,
              date = ?,
              o_sebe_lv = ?,
              dostizhenija_lv = ?,
              foto_attels = ?,
              galerija = ?,
              is_hidden = ?,
              position = ?,
              m_time = ?
            WHERE id = ?
          `).run(
            nameLv,
            body.date != null ? String(body.date).trim() : String(existing.date || ''),
            body.o_sebe_lv != null ? String(body.o_sebe_lv).trim() : String(existing.o_sebe_lv || ''),
            body.dostizhenija_lv != null ? String(body.dostizhenija_lv).trim() : String(existing.dostizhenija_lv || ''),
            body.foto_attels != null ? String(body.foto_attels).trim() : existing.foto_attels,
            JSON.stringify(parseGallery(body.galerija != null ? body.galerija : existing.galerija)),
            body.is_hidden != null ? toIntFlag(body.is_hidden, Number(existing.is_hidden || 0)) : Number(existing.is_hidden || 0),
            body.position != null ? toIntValue(body.position, Number(existing.position || 0)) : Number(existing.position || 0),
            nowTs(),
            id
          );

          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'jaunumi') {
          const existing = db.prepare('SELECT * FROM jaunumi WHERE id = ? LIMIT 1').get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const title = body.nosaukums != null ? String(body.nosaukums).trim() : existing.nosaukums;
          const datums = body.datums != null ? String(body.datums).trim() : existing.datums;
          const zina = body.zina != null ? String(body.zina).trim() : existing.zina;
          if (!title || !datums || !zina) {
            sendJson(res, 400, { error: 'Fields datums, nosaukums, zina are required' });
            return;
          }

          const slugBase = body.slug != null
            ? String(body.slug).trim()
            : (title !== existing.nosaukums ? title : existing.slug);
          const slug = uniqueNewsSlug(slugBase, id);

          db.prepare(`
            UPDATE jaunumi
            SET datums = ?, nosaukums = ?, foto_attels = ?, galerija = ?, ievads = ?, zina = ?, slug = ?, position = ?, updated_at = ?
            WHERE id = ?
          `).run(
            datums,
            title,
            body.foto_attels != null ? String(body.foto_attels).trim() : existing.foto_attels,
            JSON.stringify(parseGallery(body.galerija != null ? body.galerija : existing.galerija)),
            body.ievads != null ? String(body.ievads).trim() : existing.ievads,
            zina,
            slug,
            body.position != null ? toIntValue(body.position, Number(existing.position || 0)) : Number(existing.position || 0),
            nowTs(),
            id
          );
          const row = db.prepare('SELECT * FROM jaunumi WHERE id = ?').get(id);
          sendJson(res, 200, { row: mapNewsRow(row) });
          return;
        }

        if (table === 'raksti_prese') {
          const existing = db.prepare('SELECT * FROM raksti_prese WHERE id = ? LIMIT 1').get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const nosaukums = body.nosaukums != null
            ? String(body.nosaukums).trim()
            : String(existing.nosaukums || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Field nosaukums is required' });
            return;
          }

          db.prepare(`
            UPDATE raksti_prese
            SET datums = ?, nosaukums = ?, attels = ?, ievads = ?, zina = ?, saite = ?, updated_at = ?
            WHERE id = ?
          `).run(
            body.datums != null ? String(body.datums).trim() : String(existing.datums || ''),
            nosaukums,
            body.attels != null ? String(body.attels).trim() : existing.attels,
            body.ievads != null ? String(body.ievads) : String(existing.ievads || ''),
            body.zina != null ? String(body.zina) : String(existing.zina || ''),
            body.saite != null ? String(body.saite).trim() : String(existing.saite || ''),
            nowTs(),
            id
          );
          const row = db.prepare('SELECT * FROM raksti_prese WHERE id = ?').get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'treneri') {
          const existing = db.prepare('SELECT * FROM treneri WHERE id = ? LIMIT 1').get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const fullName = body.vards_uzvards != null
            ? String(body.vards_uzvards).trim()
            : String(existing.vards_uzvards || '').trim();
          if (!fullName) {
            sendJson(res, 400, { error: 'Field vards_uzvards is required' });
            return;
          }

          const birthDate = body.dzimsanas_datums != null
            ? String(body.dzimsanas_datums).trim()
            : String(existing.dzimsanas_datums || '').trim();
          if (birthDate && !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) {
            sendJson(res, 400, { error: 'Field dzimsanas_datums must be in YYYY-MM-DD format' });
            return;
          }

          const slugBase = body.slug != null
            ? String(body.slug).trim()
            : (fullName !== existing.vards_uzvards ? fullName : existing.slug);
          const slug = uniqueTrainerSlug(slugBase, id);

          db.prepare(`
            UPDATE treneri
            SET
              vards_uzvards = ?,
              dzimsanas_datums = ?,
              foto_attels = ?,
              galerija = ?,
              izglitiba = ?,
              josta = ?,
              saka_studet = ?,
              koucinga_pieredze = ?,
              par_mani = ?,
              sasniegumi = ?,
              slug = ?,
              updated_at = ?
            WHERE id = ?
          `).run(
            fullName,
            birthDate || null,
            body.foto_attels != null ? String(body.foto_attels).trim() : existing.foto_attels,
            JSON.stringify(parseGallery(body.galerija != null ? body.galerija : existing.galerija)),
            body.izglitiba != null ? String(body.izglitiba).trim() : existing.izglitiba,
            body.josta != null ? String(body.josta).trim() : existing.josta,
            body.saka_studet != null ? String(body.saka_studet).trim() : existing.saka_studet,
            body.koucinga_pieredze != null ? String(body.koucinga_pieredze).trim() : existing.koucinga_pieredze,
            body.par_mani != null ? String(body.par_mani).trim() : existing.par_mani,
            body.sasniegumi != null ? String(body.sasniegumi).trim() : existing.sasniegumi,
            slug,
            nowTs(),
            id
          );
          const row = db.prepare('SELECT * FROM treneri WHERE id = ?').get(id);
          sendJson(res, 200, { row: mapTrainerRow(row) });
          return;
        }

        if (isSadarbibaCmsTable(table)) {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const nosaukums = body.nosaukums != null
            ? String(body.nosaukums).trim()
            : String(existing.nosaukums || '').trim();
          const saturs = body.saturs != null ? String(body.saturs) : String(existing.saturs || '');
          const fotoAttels = body.foto_attels != null
            ? String(body.foto_attels).trim()
            : existing.foto_attels;
          const galerija = JSON.stringify(parseGallery(body.galerija != null ? body.galerija : existing.galerija));

          db.prepare(`
            UPDATE ${table}
            SET nosaukums = ?, saturs = ?, foto_attels = ?, galerija = ?, updated_at = ?
            WHERE ${pk} = ?
          `).run(
            nosaukums || (table === 'sadarbiba_sponsoru_atbalsts' ? 'Sponsoru atbalsts' : 'Sporta zāles īre'),
            saturs,
            fotoAttels,
            galerija,
            nowTs(),
            id
          );

          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'sadarbiba_musu_partneri') {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const nosaukums = body.nosaukums != null
            ? String(body.nosaukums).trim()
            : String(existing.nosaukums || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Lauks nosaukums ir obligāts.' });
            return;
          }

          const links = body.links != null ? String(body.links).trim() : String(existing.links || '').trim();
          const fotoAttels = body.foto_attels != null
            ? String(body.foto_attels).trim()
            : String(existing.foto_attels || '').trim();
          const informacija = body.informacija != null ? String(body.informacija) : String(existing.informacija || '');

          db.prepare(`
            UPDATE ${table}
            SET nosaukums = ?, links = ?, foto_attels = ?, informacija = ?, updated_at = ?
            WHERE ${pk} = ?
          `).run(
            nosaukums,
            links || null,
            fotoAttels || null,
            informacija,
            nowTs(),
            id
          );

          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'video_galerija') {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }
          const nosaukums = body.nosaukums != null
            ? String(body.nosaukums).trim()
            : String(existing.nosaukums || '').trim();
          const videoSaite = body.video_saite != null
            ? String(body.video_saite).trim()
            : String(existing.video_saite || '').trim();
          const dateValue = body.date != null
            ? String(body.date).trim()
            : String(existing.date || '').trim();
          if (!nosaukums) {
            sendJson(res, 400, { error: 'Lauks nosaukums ir obligāts.' });
            return;
          }
          if (!videoSaite) {
            sendJson(res, 400, { error: 'Lauks video_saite ir obligāts.' });
            return;
          }
          db.prepare(`
            UPDATE video_galerija
            SET nosaukums = ?, video_saite = ?, date = ?, updated_at = ?
            WHERE ${pk} = ?
          `).run(
            nosaukums,
            videoSaite,
            dateValue || null,
            nowTs(),
            id
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'kluba_noteikumi') {
          const existing = db.prepare('SELECT * FROM kluba_noteikumi WHERE id = ? LIMIT 1').get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }
          const teksts = body.teksts != null ? String(body.teksts).trim() : existing.teksts;
          if (!teksts) {
            sendJson(res, 400, { error: 'Field teksts is required' });
            return;
          }
          db.prepare(`
            UPDATE kluba_noteikumi
            SET faili = ?, teksts = ?, updated_at = ?
            WHERE id = ?
          `).run(
            body.faili != null ? String(body.faili).trim() : existing.faili,
            teksts,
            nowTs(),
            id
          );
          const row = db.prepare('SELECT * FROM kluba_noteikumi WHERE id = ?').get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (isHallTable(table)) {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const title = body.nosaukums != null
            ? String(body.nosaukums).trim()
            : String(existing.nosaukums || '').trim();
          if (!title) {
            sendJson(res, 400, { error: 'Field nosaukums is required' });
            return;
          }

          const galleryValue = body.galerija != null ? body.galerija : existing.galerija;
          db.prepare(`
            UPDATE ${table}
            SET nosaukums = ?, ievads = ?, attels = ?, galerija = ?, updated_at = ?
            WHERE ${pk} = ?
          `).run(
            title,
            body.ievads != null ? String(body.ievads).trim() : existing.ievads,
            body.attels != null ? String(body.attels).trim() : existing.attels,
            JSON.stringify(parseGallery(galleryValue)),
            nowTs(),
            id
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (isNodarbibasTable(table)) {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          if (table === 'nodarbibas_izlases_grupas') {
            db.prepare(`
              UPDATE ${table}
              SET ievads = ?, attels = ?, updated_at = ?
              WHERE ${pk} = ?
            `).run(
              body.ievads != null ? String(body.ievads).trim() : existing.ievads,
              body.attels != null ? String(body.attels).trim() : existing.attels,
              nowTs(),
              id
            );
          } else if (table === 'nodarbibas_individualas_nodarbibas') {
            db.prepare(`
              UPDATE ${table}
              SET ievads = ?, updated_at = ?
              WHERE ${pk} = ?
            `).run(
              body.ievads != null ? String(body.ievads).trim() : existing.ievads,
              nowTs(),
              id
            );
          } else {
            db.prepare(`
              UPDATE ${table}
              SET attels = ?, updated_at = ?
              WHERE ${pk} = ?
            `).run(
              body.attels != null ? String(body.attels).trim() : existing.attels,
              nowTs(),
              id
            );
          }
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'ippon_galery') {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }

          const titleLv = body.name_lv != null
            ? String(body.name_lv || '').trim()
            : String(existing.name_lv || '').trim();
          if (!titleLv) {
            sendJson(res, 400, { error: 'Lauks Nosaukums ir obligāts.' });
            return;
          }

          const unixDate = body.date != null || body.datums != null
            ? toUnixTsFromValue(body.date != null ? body.date : body.datums)
            : Number(existing.date || 0);

          db.prepare(`
            UPDATE ippon_galery
            SET
              date = ?,
              name_lv = ?,
              name_ru = ?,
              name_en = ?,
              content_lv = ?,
              content_ru = ?,
              content_en = ?,
              image = ?,
              ordering = ?,
              public = ?,
              m_time = ?
            WHERE id = ?
          `).run(
            unixDate,
            titleLv,
            body.name_ru != null ? String(body.name_ru || '').trim() : String(existing.name_ru || titleLv),
            body.name_en != null ? String(body.name_en || '').trim() : String(existing.name_en || ''),
            body.content_lv != null ? String(body.content_lv) : String(existing.content_lv || ''),
            body.content_ru != null ? String(body.content_ru) : String(existing.content_ru || ''),
            body.content_en != null ? String(body.content_en) : String(existing.content_en || ''),
            body.image != null ? Number(body.image || 0) : Number(existing.image || 0),
            body.ordering != null ? Number(body.ordering || 0) : Number(existing.ordering || 0),
            body.public != null ? Number(body.public || 0) : Number(existing.public || 1),
            nowTs(),
            id
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row });
          return;
        }

        if (table === 'ippon_sorevnovanija') {
          const existing = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ? LIMIT 1`).get(id);
          if (!existing) {
            sendJson(res, 404, { error: 'Row not found' });
            return;
          }
          const prepared = buildRezultatiPayload(body, existing);
          if (prepared.error) {
            sendJson(res, 400, { error: prepared.error });
            return;
          }
          const v = prepared.values;
          const ts = nowTs();
          db.prepare(`
            UPDATE ippon_sorevnovanija
            SET
              status_id = ?, date = ?,
              name_lv = ?, name_ru = ?, name_en = ?,
              location_lv = ?, location_ru = ?, location_en = ?,
              info_lv = ?, info_ru = ?, info_en = ?,
              m_time = ?,
              record_type = ?, layout_type = ?, slug = ?, foto_attels = ?, galerija = ?, structured_data = ?, custom_html = ?, updated_at = ?
            WHERE id = ?
          `).run(
            v.status_id,
            v.date,
            v.name_lv,
            v.name_ru,
            v.name_en,
            v.location_lv,
            v.location_ru,
            v.location_en,
            v.info_lv,
            v.info_ru,
            v.info_en,
            ts,
            v.record_type,
            v.layout_type,
            v.slug,
            v.foto_attels,
            v.galerija,
            v.structured_data,
            v.custom_html,
            ts,
            id
          );
          const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
          sendJson(res, 200, { row, warning: prepared.warning || null });
          return;
        }
        const allowedColumns = columns.map((c) => c.name).filter((name) => name !== pk);
        const keys = allowedColumns.filter((name) => Object.prototype.hasOwnProperty.call(body, name));
        if (keys.length === 0) {
          sendJson(res, 400, { error: 'No data to update' });
          return;
        }
        const setClause = keys.map((k) => `${k} = ?`).join(', ');
        const values = keys.map((k) => body[k]);
        const sql = `UPDATE ${table} SET ${setClause} WHERE ${pk} = ?`;
        const info = db.prepare(sql).run(...values, id);
        if (info.changes === 0) {
          sendJson(res, 404, { error: 'Row not found' });
          return;
        }
        const row = db.prepare(`SELECT * FROM ${table} WHERE ${pk} = ?`).get(id);
        sendJson(res, 200, { row });
      })
      .catch((error) => sendJson(res, 400, { error: error.message }));
    return true;
  }

  if (req.method === 'DELETE' && id !== null) {
    if (table === 'ippon_galery') {
      const existing = db.prepare(`SELECT id FROM ippon_galery WHERE ${pk} = ? LIMIT 1`).get(id);
      if (!existing) {
        sendJson(res, 404, { error: 'Row not found' });
        return true;
      }
      db.exec('BEGIN');
      try {
        db.prepare('DELETE FROM ippon_images WHERE area_id = 25 AND item_id = ?').run(id);
        db.prepare(`DELETE FROM ippon_galery WHERE ${pk} = ?`).run(id);
        db.exec('COMMIT');
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      }
      const albumDir = path.join(GALLERY_UPLOADS_DIR, String(id));
      try {
        if (fs.existsSync(albumDir)) fs.rmSync(albumDir, { recursive: true, force: true });
      } catch {
        // ignore fs cleanup errors; DB deletion already done
      }
      sendJson(res, 200, { success: true });
      return true;
    }

    const info = db.prepare(`DELETE FROM ${table} WHERE ${pk} = ?`).run(id);
    if (info.changes === 0) {
      sendJson(res, 404, { error: 'Row not found' });
      return true;
    }
    sendJson(res, 200, { success: true });
    return true;
  }

  sendJson(res, 405, { error: 'Method not allowed' });
  return true;
}

try {
  //initializeDatabase();
} catch (error) {
  logSqliteError('database initialization failed', error);
  process.exit(1);
}

const server = http.createServer((req, res) => {
  const reqUrl = new URL(req.url, `http://${req.headers.host || `localhost:${PORT}`}`);
  const pathname = decodeURIComponent(reqUrl.pathname);
  if (pathname.startsWith('/uploads/')) {
    const filePath = path.join(ROOT, pathname);

    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();

      const mimeTypes = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.webp': 'image/webp',
        '.gif': 'image/gif',
        '.svg': 'image/svg+xml'
      };

      const contentType = mimeTypes[ext] || 'application/octet-stream';

      res.writeHead(200, { 'Content-Type': contentType });
      res.end(data);
    });

    return;
  }

  if (pathname.startsWith('/assets/')) {
    const filePath = path.join(ROOT, pathname);

    if (fs.existsSync(filePath)) {
      return serveStatic(filePath, res);
    }
  }

  if (pathname.includes('_files')) {
    // достаём всё после "_files"
    const match = pathname.match(/_files\/(.+)/);

    if (match && match[1]) {
      const safePath = match[1];

      const filePath = path.join(
        ROOT,
        'IPPON.LV – 道場_files',
        safePath
      );

      if (fs.existsSync(filePath)) {
        return serveStatic(filePath, res);
      } else {
        console.log('MISS _files:', filePath);
      }
    }
  }

  if (pathname.startsWith('/api/')) {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      res.end();
      return;
    }

    const handled = handleApi(req, res, reqUrl);
    if (!handled) {
      sendJson(res, 404, { error: 'API route not found' });
    }
    return;
  }

  if (/\/admin\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'admin', 'index.html'));
    return;
  }

  if (/^\/jaunumi\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'jaunumi-single.html'));
    return;
  }

  if (/^\/sportisti\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'sportisti-single.html'));
    return;
  }
  if (/^\/treneri\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'treneris-single.html'));
    return;
  }
  if (/^\/rezultati\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'rezultati-single.html'));
    return;
  }
  if (/^\/foto-galerija\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'foto-galerija-single.html'));
    return;
  }
  if (/^\/raksti-prese\/[a-z0-9-]+\/?$/i.test(pathname)) {
    sendFile(res, path.join(ROOT, 'raksti-prese-single.html'));
    return;
  }

  if (pathname === '/jaunumi') {
    sendFile(res, path.join(ROOT, 'jaunumi.html'));
    return;
  }

  if (pathname === '/sportisti' || pathname === '/sportisti.html') {
    sendFile(res, path.join(ROOT, 'sportisti.html'));
    return;
  }
  if (pathname === '/treneri' || pathname === '/treneri.html') {
    sendFile(res, path.join(ROOT, 'treneri.html'));
    return;
  }
  if (pathname === '/rezultati' || pathname === '/rezultati.html') {
    sendFile(res, path.join(ROOT, 'rezultati.html'));
    return;
  }
  if (pathname === '/kalendars' || pathname === '/kalendars.html') {
    sendFile(res, path.join(ROOT, 'kalendars.html'));
    return;
  }
  if (pathname === '/foto-galerija' || pathname === '/foto-galerija.html') {
    sendFile(res, path.join(ROOT, 'foto-galerija.html'));
    return;
  }
  if (pathname === '/video-galerija' || pathname === '/video-galerija.html') {
    sendFile(res, path.join(ROOT, 'video-galerija.html'));
    return;
  }
  if (pathname === '/raksti-prese' || pathname === '/raksti-prese.html') {
    sendFile(res, path.join(ROOT, 'raksti-prese.html'));
    return;
  }
  if (pathname === '/sporta-zales-ire' || pathname === '/sporta-zales-ire.html') {
    sendFile(res, path.join(ROOT, 'sporta-zales-ire.html'));
    return;
  }
  if (pathname === '/sponsoru-atbalsts' || pathname === '/sponsoru-atbalsts.html') {
    sendFile(res, path.join(ROOT, 'sponsoru-atbalsts.html'));
    return;
  }
  if (pathname === '/musu-partneri' || pathname === '/musu-partneri.html') {
    sendFile(res, path.join(ROOT, 'musu-partneri.html'));
    return;
  }
  if (pathname === '/rezultati-single' || pathname === '/rezultati-single.html') {
    sendFile(res, path.join(ROOT, 'rezultati-single.html'));
    return;
  }

  if (pathname === '/saraksts') {
    sendFile(res, path.join(ROOT, 'saraksts.html'));
    return;
  }

  if (pathname === '/izlases-grupas') {
    sendFile(res, path.join(ROOT, 'izlases-grupas.html'));
    return;
  }

  if (pathname === '/individualas-nodarbibas') {
    sendFile(res, path.join(ROOT, 'individualas-nodarbibas.html'));
    return;
  }

  if (pathname === '/' || pathname === '/index.html') {
    sendFile(res, path.join(ROOT, 'index.html'));
    return;
  }

  const candidate = safeResolve(ROOT, `.${pathname}`);
  if (!candidate) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  sendFile(res, candidate);
});

server.on('error', (error) => {
  console.error(`[server] startup failed: ${error.message}`);
});

process.on('uncaughtException', (error) => {
  logSqliteError('uncaught exception', error);
});

process.on('unhandledRejection', (error) => {
  logSqliteError('unhandled rejection', error);
});

server.listen(PORT, HOST, () => {
  console.log(`[startup] Server is listening on ${HOST}:${PORT}`);
  console.log(`[startup] Database: ${DB_PATH}`);
  console.log(`[startup] Uploads: ${UPLOADS_DIR}`);
  console.log(`[startup] Home:  http://localhost:${PORT}/index.html`);
  console.log(`[startup] Admin: http://localhost:${PORT}/admin`);
});
