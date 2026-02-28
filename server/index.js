const fs = require("fs");
const path = require("path");
const http = require("http");

const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const XLSX = require("xlsx");
const { v4: uuidv4 } = require("uuid");
const { Server } = require("socket.io");

/**
 * SIPROPER PUSAKA — Realtime MVP Server
 * Storage: JSON file (server/data/db.json)
 */

const PORT = parseInt(process.env.PORT || "4000", 10);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_ME__SIPROPER_PUSAKA_SECRET";
const NODE_ENV = process.env.NODE_ENV || "development";
const SERVE_STATIC = process.env.SERVE_STATIC !== "0";

const DB_PATH = path.join(__dirname, "data", "db.json");
const BACKUP_DIR = path.join(__dirname, "data", "backups");
const PUBLIC_DIR = path.join(__dirname, "public");

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
fs.mkdirSync(BACKUP_DIR, { recursive: true });

function nowISO() {
  return new Date().toISOString();
}

function safeReadJSON(filePath) {
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (e) {
    console.error("Failed to parse JSON:", filePath, e);
    return null;
  }
}

function atomicWriteJSON(filePath, obj) {
  const tmp = filePath + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(obj, null, 2), "utf8");
  fs.renameSync(tmp, filePath);
}

function backupDb(db) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const file = path.join(BACKUP_DIR, `db-backup-${stamp}.json`);
  try {
    atomicWriteJSON(file, db);
  } catch (e) {
    console.warn("Backup failed:", e);
  }
}

function loadDb() {
  const base = safeReadJSON(DB_PATH);
  if (base && typeof base === "object") return base;
  return {
    meta: {
      created_at: nowISO(),
      last_import_at: null
    },
    users: [],
    records: []
  };
}

function saveDb(db, { doBackup = false } = {}) {
  if (doBackup) backupDb(db);
  atomicWriteJSON(DB_PATH, db);
}

function ensureAdminUser(db) {
  if (Array.isArray(db.users) && db.users.length > 0) return;
  const admin = {
    id: uuidv4(),
    username: "admin",
    password_hash: bcrypt.hashSync("admin123", 10),
    role: "admin",
    created_at: nowISO()
  };
  db.users = [admin];
  saveDb(db, { doBackup: true });
  console.log("Created default admin user: admin / admin123");
}

function normalizeText(x) {
  return (x ?? "").toString().trim().toLowerCase();
}

function parseDateAny(s) {
  if (!s) return null;
  if (Object.prototype.toString.call(s) === "[object Date]" && !isNaN(s)) return s;
  const t = s.toString().trim();
  if (!t) return null;

  // dd/mm/yy or dd/mm/yyyy
  let m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let dd = parseInt(m[1], 10);
    let mm = parseInt(m[2], 10);
    let yy = parseInt(m[3], 10);
    if (yy < 100) yy += 2000;
    const dt = new Date(yy, mm - 1, dd);
    return isNaN(dt) ? null : dt;
  }

  // dd-mm-yyyy
  m = t.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (m) {
    const dt = new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
    return isNaN(dt) ? null : dt;
  }

  return null;
}

function formatDateDDMMYYYY(dt) {
  if (!dt) return "";
  const dd = String(dt.getDate()).padStart(2, "0");
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const yy = dt.getFullYear();
  return `${dd}-${mm}-${yy}`;
}

function computeDerived(r) {
  const dates = [
    { k: "K1", v: parseDateAny(r.k1_tgl) },
    { k: "K2", v: parseDateAny(r.k2_tgl) },
    { k: "K3", v: parseDateAny(r.k3_tgl) },
    { k: "K4", v: parseDateAny(r.k4_tgl) },
    { k: "K5", v: parseDateAny(r.k5_tgl) },
    { k: "K6", v: parseDateAny(r.k6_tgl) }
  ];
  let last = null;
  let status = "K0";
  let count = 0;
  for (const d of dates) {
    if (d.v) {
      count += 1;
      status = d.k;
      last = d.v;
    }
  }
  r.status_k = status;
  r.kunjungan_terakhir = formatDateDDMMYYYY(last);
  r.jumlah_kunjungan = count;
  return r;
}

function isLikelyNumberingRow(r) {
  if (!r || r.length < 10) return false;
  const a = r[0], b = r[1], c = r[2], d = r[3];
  return a == 1 && b == 2 && c == 3 && d == 4;
}

function isHeaderStartRow(r) {
  if (!r) return false;
  return normalizeText(r[0]) === "no" && normalizeText(r[1]).includes("index keluarga");
}

function isGroupHeaderRow(r) {
  // Detect merged "section headers" that sometimes repeat in the middle of the sheet (page breaks),
  // e.g. "KEPALA KELUARGA (KK)", "DATA KELUARGA YANG BERMASALAH KESEHATAN", etc.
  if (!r) return false;
  const t = normalizeText((r || []).filter((x) => x !== null && x !== undefined && String(x).trim() !== "").join(" "));
  if (!t) return false;
  return (
    t.includes("kepala keluarga") ||
    t.includes("data keluarga") ||
    t.includes("masalah kesehatan") ||
    t.includes("waktu kunjungan")
  );
}

function parseTemplateRows(rows2d) {
  // This template often repeats headers every "page".
  // Strategy:
  // - Wait for the numbering row (1,2,3,4...) to start reading data.
  // - If we hit a header row again, stop reading, then wait for the next numbering row.
  const out = [];
  let reading = false;

  for (let i = 0; i < rows2d.length; i++) {
    const r = rows2d[i] || [];

    // Repeated headers / section titles: skip and reset reading mode
    if (isGroupHeaderRow(r) || isHeaderStartRow(r)) {
      reading = false;
      continue;
    }

    // Numbering row indicates the start of the actual data block
    if (isLikelyNumberingRow(r)) {
      reading = true;
      continue;
    }

    if (!reading) continue;

    const a = (idx) => (r[idx] ?? "");
    const rowObj = {
      id: uuidv4(),
      no: a(0),
      index_keluarga: a(1),
      nama_kk: a(2),
      umur_kk: a(3),
      alamat: a(4),
      no_anggota: a(5),
      nama_anggota: a(6),
      umur_anggota: a(7),
      jk: a(8),
      masalah: a(9),
      A: a(10),
      B: a(11),
      C: a(12),
      D: a(13),
      E: a(14),
      F: a(15),
      G: a(16),
      k1_tgl: a(17),
      k1_km: a(18),
      k2_tgl: a(19),
      k2_km: a(20),
      k3_tgl: a(21),
      k3_km: a(22),
      k4_tgl: a(23),
      k4_km: a(24),
      k5_tgl: a(25),
      k5_km: a(26),
      k6_tgl: a(27),
      k6_km: a(28),
      ket: a(29),
      version: 1,
      updated_at: nowISO(),
      updated_by: null
    };

    // Extra guard against accidentally parsed header rows
    const maybeHeader =
      normalizeText(rowObj.nama_kk) === "nama" ||
      normalizeText(rowObj.alamat) === "alamat" ||
      normalizeText(rowObj.index_keluarga).includes("index keluarga");
    if (maybeHeader) continue;

    const meaningful = [rowObj.nama_kk, rowObj.alamat, rowObj.nama_anggota, rowObj.masalah, rowObj.k1_tgl].some(
      (x) => normalizeText(x) !== ""
    );
    if (!meaningful) continue;

    out.push(computeDerived(rowObj));
  }

  return out;
}

function signToken(user) {
  return jwt.sign(
    { sub: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: "12h" }
  );
}

function authMiddleware(req, res, next) {
  const hdr = req.headers.authorization || "";
  const m = hdr.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ error: "Missing Authorization bearer token" });
  try {
    const payload = jwt.verify(m[1], JWT_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: "Invalid/expired token" });
  }
}

function requireRole(...roles) {
  return (req, res, next) => {
    const r = req.user?.role;
    if (!r || !roles.includes(r)) return res.status(403).json({ error: "Forbidden" });
    next();
  };
}

/** ===== App setup ===== **/
const app = express();
app.use(helmet());
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "3mb" }));

// Serve built UI (if exists). Useful after you run: npm run build
if (SERVE_STATIC && fs.existsSync(PUBLIC_DIR)) {
  app.use(express.static(PUBLIC_DIR));
}

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/** ===== In-memory DB ===== **/
let DB = loadDb();
ensureAdminUser(DB);

function publicUser(u) {
  return { id: u.id, username: u.username, role: u.role, created_at: u.created_at };
}

/** ===== Routes ===== **/

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, time: nowISO(), records: DB.records.length, users: DB.users.length });
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username & password required" });
  const u = DB.users.find((x) => x.username === username);
  if (!u) return res.status(401).json({ error: "Invalid credentials" });
  const ok = bcrypt.compareSync(password, u.password_hash);
  if (!ok) return res.status(401).json({ error: "Invalid credentials" });
  const token = signToken(u);
  res.json({ token, user: publicUser(u) });
});

app.get("/api/auth/me", authMiddleware, (req, res) => {
  const u = DB.users.find((x) => x.id === req.user.sub);
  if (!u) return res.status(401).json({ error: "Unknown user" });
  res.json({ user: publicUser(u) });
});

app.get("/api/users", authMiddleware, requireRole("admin"), (_req, res) => {
  res.json({ users: DB.users.map(publicUser) });
});

app.post("/api/users", authMiddleware, requireRole("admin"), (req, res) => {
  const { username, password, role } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: "username & password required" });
  if (!["admin", "editor", "viewer"].includes(role)) return res.status(400).json({ error: "Invalid role" });
  if (DB.users.some((x) => x.username === username)) return res.status(409).json({ error: "Username already exists" });
  const u = {
    id: uuidv4(),
    username,
    password_hash: bcrypt.hashSync(password, 10),
    role,
    created_at: nowISO()
  };
  DB.users.push(u);
  saveDb(DB, { doBackup: true });
  res.status(201).json({ user: publicUser(u) });
});

app.post(
  "/api/import/excel",
  authMiddleware,
  requireRole("admin"),
  upload.single("file"),
  (req, res) => {
    if (!req.file) return res.status(400).json({ error: "Missing file" });

    let wb;
    try {
      wb = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    } catch (e) {
      return res.status(400).json({ error: "Failed to read xlsx" });
    }

    const sheetName = wb.SheetNames.includes("Sheet1") ? "Sheet1" : wb.SheetNames[0];
    const ws = wb.Sheets[sheetName];
    const rows2d = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false, defval: "" });
    const parsed = parseTemplateRows(rows2d);

    // Set updated_by for imported rows
    const uid = req.user.sub;
    for (const r of parsed) r.updated_by = uid;

    DB.meta.last_import_at = nowISO();
    DB.records = parsed;
    saveDb(DB, { doBackup: true });

    // Realtime broadcast
    io.emit("dataset_reloaded", { at: DB.meta.last_import_at, count: DB.records.length });

    res.json({ ok: true, imported: parsed.length, sheet: sheetName });
  }
);

app.get("/api/records", authMiddleware, (req, res) => {
  const q = normalizeText(req.query.q || "");
  const status = (req.query.status || "").toString().trim();
  const jk = (req.query.jk || "").toString().trim().toUpperCase();
  const masalah = (req.query.masalah || "").toString().trim();

  let rows = DB.records;
  if (status) rows = rows.filter((r) => r.status_k === status);
  if (jk) rows = rows.filter((r) => (r.jk || "").toString().trim().toUpperCase() === jk);
  if (masalah) rows = rows.filter((r) => (r.masalah || "").toString().trim() === masalah);
  if (q) {
    rows = rows.filter((r) => {
      const hay = [r.nama_kk, r.alamat, r.nama_anggota, r.masalah, r.index_keluarga].map(normalizeText).join(" | ");
      return hay.includes(q);
    });
  }

  // Sort newest update first
  rows = [...rows].sort((a, b) => (b.updated_at || "").localeCompare(a.updated_at || ""));

  res.json({ records: rows, meta: DB.meta });
});

app.patch("/api/records/:id", authMiddleware, requireRole("admin", "editor"), (req, res) => {
  const id = req.params.id;
  const idx = DB.records.findIndex((r) => r.id === id);
  if (idx < 0) return res.status(404).json({ error: "Not found" });

  const current = DB.records[idx];
  const clientVersion = req.body?.version;
  if (typeof clientVersion === "number" && clientVersion !== current.version) {
    return res.status(409).json({
      error: "Version conflict",
      current
    });
  }

  const allowed = [
    "no",
    "index_keluarga",
    "nama_kk",
    "umur_kk",
    "alamat",
    "no_anggota",
    "nama_anggota",
    "umur_anggota",
    "jk",
    "masalah",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "k1_tgl",
    "k1_km",
    "k2_tgl",
    "k2_km",
    "k3_tgl",
    "k3_km",
    "k4_tgl",
    "k4_km",
    "k5_tgl",
    "k5_km",
    "k6_tgl",
    "k6_km",
    "ket"
  ];

  const patch = req.body?.patch || req.body || {};
  const next = { ...current };
  for (const k of allowed) {
    if (Object.prototype.hasOwnProperty.call(patch, k)) next[k] = patch[k];
  }

  next.version = (current.version || 1) + 1;
  next.updated_at = nowISO();
  next.updated_by = req.user.sub;
  computeDerived(next);

  DB.records[idx] = next;
  saveDb(DB);

  io.emit("record_updated", { record: next });
  res.json({ record: next });
});

app.get("/api/export/csv", authMiddleware, (req, res) => {
  // Same filters as /api/records
  const q = normalizeText(req.query.q || "");
  const status = (req.query.status || "").toString().trim();
  const jk = (req.query.jk || "").toString().trim().toUpperCase();
  const masalah = (req.query.masalah || "").toString().trim();

  let rows = DB.records;
  if (status) rows = rows.filter((r) => r.status_k === status);
  if (jk) rows = rows.filter((r) => (r.jk || "").toString().trim().toUpperCase() === jk);
  if (masalah) rows = rows.filter((r) => (r.masalah || "").toString().trim() === masalah);
  if (q) {
    rows = rows.filter((r) => {
      const hay = [r.nama_kk, r.alamat, r.nama_anggota, r.masalah, r.index_keluarga].map(normalizeText).join(" | ");
      return hay.includes(q);
    });
  }

  const cols = [
    "no",
    "index_keluarga",
    "nama_kk",
    "umur_kk",
    "alamat",
    "no_anggota",
    "nama_anggota",
    "umur_anggota",
    "jk",
    "masalah",
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "k1_tgl",
    "k1_km",
    "k2_tgl",
    "k2_km",
    "k3_tgl",
    "k3_km",
    "k4_tgl",
    "k4_km",
    "k5_tgl",
    "k5_km",
    "k6_tgl",
    "k6_km",
    "ket",
    "status_k",
    "kunjungan_terakhir",
    "jumlah_kunjungan"
  ];

  const escape = (v) => {
    const s = (v ?? "").toString();
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  const header = cols.join(",");
  const body = rows.map((r) => cols.map((c) => escape(r[c])).join(",")).join("\n");
  const csv = header + "\n" + body;

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=export_siproper_pusaka.csv");
  res.send(csv);
});

// SPA fallback (only if UI build exists). Do not hijack /api
if (SERVE_STATIC && fs.existsSync(PUBLIC_DIR)) {
  app.get(/^(?!\/api).*/, (_req, res) => {
    res.sendFile(path.join(PUBLIC_DIR, "index.html"));
  });
}

/** ===== Server + Socket.IO ===== **/
const httpServer = http.createServer(app);
const io = new Server(httpServer, {
  cors: { origin: true, credentials: true }
});

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error("Missing token"));
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    socket.user = payload;
    next();
  } catch {
    next(new Error("Invalid token"));
  }
});

io.on("connection", (socket) => {
  // Minimal info
  socket.emit("hello", { time: nowISO(), role: socket.user?.role, username: socket.user?.username });
});

httpServer.listen(PORT, () => {
  const staticInfo = fs.existsSync(PUBLIC_DIR) ? " (UI static enabled)" : "";
  console.log(`SIPROPER PUSAKA server listening on http://localhost:${PORT} (env=${NODE_ENV})${staticInfo}`);
});
