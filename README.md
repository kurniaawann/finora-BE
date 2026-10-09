# Finora API

Backend REST API untuk aplikasi mobile **Finora** — keuangan pribadi, patungan grup, dan tabungan bersama dengan teman.

Koleksi Bruno untuk mencoba API (berisi body, contoh respons, dan aturan bisnis per endpoint) tersimpan terpisah di folder `bruno/Finora`.

## Tech Stack

- Node.js ≥ 20.19, TypeScript (ESM)
- Express 5 — error dari handler async otomatis diteruskan ke error handler terpusat
- Prisma 7 + MySQL/MariaDB (driver adapter `@prisma/adapter-mariadb`)
- Zod 4 (validasi body & env), JWT (access + refresh token dengan rotasi)
- Multer + Sharp (upload foto, kompres ke WebP, buang metadata EXIF/GPS)
- Firebase Admin (push notification FCM) & Nodemailer (email OTP via SMTP)

## Menjalankan Secara Lokal

```bash
cp .env.example .env        # lalu isi DATABASE_URL & JWT secret
npm install                 # otomatis menjalankan `prisma generate`
npm run db:deploy           # terapkan migration
npm run db:seed             # kategori bawaan sistem (idempotent)
npm run dev                 # http://localhost:5000/api
```

Cek kesehatan: `GET /api/health`.

## Environment

Semua variabel divalidasi saat start (`src/config/env.ts`); server menolak jalan bila ada yang salah.

| Variabel | Wajib | Keterangan |
|---|---|---|
| `NODE_ENV` | – | `development` \| `test` \| `production` |
| `PORT` | – | Default `5000` |
| `APP_URL` | ya (produksi) | URL publik server, untuk membentuk URL foto absolut |
| `DATABASE_URL` | ya | `mysql://user:pass@host:3306/db` |
| `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET` | ya | Min. 32 karakter acak, berbeda satu sama lain |
| `JWT_ACCESS_EXPIRES_IN`, `JWT_REFRESH_EXPIRES_IN` | – | Default `15m` / `30d` |
| `UPLOAD_DIR` | – | Folder foto, default `uploads`. Produksi: volume persisten |
| `CORS_ORIGINS` | – | Origin web yang diizinkan (dipisah koma). Kosongkan untuk mobile saja |
| `TRUST_PROXY` | – | Jumlah reverse proxy di depan server (untuk IP rate limit) |
| `LOG_LEVEL` | – | Default `info` |
| `FIREBASE_PROJECT_ID`, `FIREBASE_CLIENT_EMAIL`, `FIREBASE_PRIVATE_KEY` | – | Kredensial **service account** Firebase untuk push. Kosong = push nonaktif |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM` | – | Pengiriman email OTP. `SMTP_HOST` kosong = isi email dicetak ke log (development) |

Yang **tidak** ditaruh di env (aturan bisnis, tetap di kode): batas ukuran foto, dimensi kompresi, pagination, rate limit, masa berlaku undangan & kode OTP, ambang notifikasi anggaran.

### Push notification (Firebase)

1. Firebase Console → Project settings → **Service accounts** → *Generate new private key*.
2. Salin `project_id`, `client_email`, dan `private_key` dari file JSON ke env (private key satu baris dengan `\n`, diapit tanda kutip ganda). Jangan commit file JSON-nya.
3. Aplikasi mobile mendaftarkan token FCM lewat `POST /api/devices` setiap login/buka aplikasi, dan menghapusnya lewat `DELETE /api/devices` sebelum logout.

Config Firebase **web** (`apiKey`, `appId`, `measurementId`, …) dipakai di aplikasi klien, bukan di backend.

### Email

Kode OTP (verifikasi email & reset password) dikirim lewat SMTP apa pun: Gmail (`smtp.gmail.com:587` + App Password) untuk uji coba, atau Brevo/Resend/Mailgun untuk produksi. Firebase tidak menyediakan pengiriman email untuk backend dengan sistem login sendiri.

## Scripts

| Script | Fungsi |
|---|---|
| `npm run dev` | Server dengan hot reload |
| `npm run build` / `npm start` | Build ke `dist/` lalu jalankan |
| `npm run typecheck` | Cek tipe tanpa build |
| `npm run db:migrate` | Buat & terapkan migration baru (development) |
| `npm run db:deploy` | Terapkan migration (staging/produksi) |
| `npm run db:seed` | Isi kategori sistem |
| `npm run db:status` | Status migration |

## Struktur Folder

```
src/
  config/        env (tervalidasi), database, logger, upload, firebase, mailer
  routes/        definisi endpoint per modul
  controllers/   tipis: ambil input → panggil service → kirim respons
  services/      aturan bisnis (lempar AppError dengan kode stabil)
  repositories/  query Prisma
  dtos/          bentuk respons ke aplikasi (common.dto.ts = serializer bersama)
  validators/    skema Zod body request
  middlewares/   auth, validasi, upload foto, rate limit, error handler
  jobs/          job berkala (transaksi berulang, pembersihan token/notifikasi/OTP)
  generated/     Prisma Client (hasil generate, tidak di-commit)
prisma/
  schema.prisma, migrations/, seed.ts
uploads/         foto user (tidak di-commit)
```

## Konvensi Respons

```jsonc
// sukses
{ "success": true, "status_code": 200, "message": "…", "data": { }, "pagination": { } }
// gagal
{ "success": false, "status_code": 422, "code": "VALIDATION_ERROR", "message": "…", "errors": { "field": ["…"] } }
```

- Uang: string 2 desimal (`"150000.00"`) · Tanggal: `YYYY-MM-DD` · Waktu: ISO 8601 UTC · Foto: URL absolut.
- `code` stabil dan aman dipakai aplikasi untuk percabangan logika; `message` untuk ditampilkan.

## Deployment

- Jalankan `npm ci && npm run build && npm run db:deploy && npm start`.
- Set `APP_URL` ke domain publik HTTPS dan `TRUST_PROXY=1` bila di belakang reverse proxy.
- `UPLOAD_DIR` harus di volume persisten (atau pindahkan ke object storage bila server lebih dari satu instance).
- Job berkala berjalan di dalam proses API; bila menjalankan lebih dari satu instance, pindahkan ke worker tunggal.
