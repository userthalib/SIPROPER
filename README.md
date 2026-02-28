# SIPROPER PUSAKA — Realtime (Multi-User) Local App

Ini adalah versi **lebih “proper”** dari demo HTML: ada **login**, **role**, **penyimpanan di server (file JSON)**, dan **sinkron update ke user lain** (Socket.IO) saat data diubah.

> Catatan: Untuk demo cepat & mudah dipindah-pindah, backend menyimpan data ke `server/data/db.json` (bukan database). Ini cukup untuk MVP 1 hari. Kalau nanti mau “naik kelas”, format data ini bisa dipindah ke MySQL/PostgreSQL.

## Fitur (MVP)

- ✅ Login (JWT)
- ✅ Role:
  - `admin`: import Excel, tambah user, edit data
  - `editor`: edit data
  - `viewer`: lihat saja
- ✅ Import Excel `.xlsx` (template register) → tersimpan di server
- ✅ Dashboard (rekap baris, rekap KK unik, visited/unvisited)
- ✅ Filter: search, JK, status K0–K6, jenis masalah
- ✅ Edit record + simpan
- ✅ Real-time update: jika 1 user edit, user lain auto menerima update
- ✅ Export CSV

## Cara menjalankan (LOCAL)

### 1) Prasyarat

- **Node.js 18+** (disarankan 18/20/22)
- Jalankan terminal **CMD / PowerShell** (Windows)

### 2) Install (Windows)

Masuk folder project (setelah unzip), lalu jalankan:

```bat
npm install
npm run setup:win
```

Jika Anda pakai Linux/Mac:

```bash
npm install
npm run setup:nix
```

> Kenapa tidak pakai `postinstall` otomatis?  
> Di beberapa mesin Windows, menjalankan `npm install` dari dalam script `postinstall` bisa memicu error PATH (`'npm' is not recognized...`). Maka setup dibuat manual agar lebih stabil.

### 3) Jalankan mode development

```bash
npm run dev
```

- Server API: `http://localhost:4000`
- Web UI (Vite): `http://localhost:5173`

### 4) Akun default

- Admin:
  - username: `admin`
  - password: `admin123`

> **Wajib ganti password** setelah demo, terutama jika dipakai di jaringan puskesmas.

## Jika `npm install` gagal di Windows (EPERM / file locked)

Biasanya karena ada proses `node.exe` masih jalan atau antivirus mengunci folder.

Coba urutan ini:

1. Tutup VS Code yang sedang membuka folder project.
2. Tutup semua terminal yang sedang menjalankan server/client.
3. (Opsional) kill node:

```bat
taskkill /F /IM node.exe
```

4. Hapus `node_modules`:

```bat
rmdir /s /q server\node_modules
rmdir /s /q client\node_modules
```

5. Install ulang:

```bat
npm run setup:win
```

## Deploy sederhana di jaringan lokal (LAN)

Kalau komputer server ada di LAN:

1. Jalankan di server PC.
2. Pastikan firewall membuka port `4000` (API) dan `5173` (UI) **atau** build UI lalu server yang serve statik.

### Build UI dan serve dari server

```bash
npm run build
npm run start
```

Lalu akses via:

- `http://localhost:4000` (server akan serve halaman web dari build)

## Struktur folder

- `server/` : Express API + Socket.IO + penyimpanan JSON
- `client/` : React (Vite)

## Catatan penting keamanan (untuk produksi)

Ini MVP. Jika dipakai “beneran”:

- Tambahkan HTTPS,
- Perkuat kebijakan password,
- Tambahkan audit log,
- Pertimbangkan DB (PostgreSQL/MySQL) + backup.
