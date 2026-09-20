# Finora — Alur Aplikasi

Dokumen ini menjelaskan alur (flow) pemakaian aplikasi Finora secara menyeluruh, bukan spesifikasi API. Untuk detail request API silakan lihat `docs.md` dan sub-folder `Auth`, `Accounts`, `Transactions`, `Transfers`, `Categories`, `Payment-Methods`.

Finora berdiri di atas empat pilar kegunaan yang bisa dipakai bersamaan:

```
1. Keuangan Pribadi  — catat uang masuk/keluar, kelola rekening, pindah dana.
2. Patungan          — pengeluaran bersama dalam grup, utang, dan pelunasan.
3. Membantu Teman    — tabungan bersama, teman ikut nyetor ke target tabunganmu.
4. Berteman          — cari user, ajak berteman, setujui/tolak permintaan.
```

Alurnya disusun dari awal user memakai aplikasi sampai semua fitur saling terhubung.

---

## 0. Memulai — Akun

Semua alur berangkat dari satu hal: user punya akun.

1. User **daftar** memakai nama, email, dan kata sandi.
2. User **masuk** (login). Aplikasi menerima dua hal sekaligus:
   - `access_token` — kunci sementara (sekitar 15 menit) untuk semua aktivitas.
   - cookie `refreshToken` (httpOnly) — dipakai otomatis untuk memperbarui token tanpa login ulang.
3. Saat token habis, aplikasi diam-diam **memperbarui** (refresh) memakai cookie. Kalau refresh gagal (sesi habis), user login ulang.
4. User **keluar** (logout) — cookie dihapus, sesi berakhir.

Jadi dari sisi user: cukup login sekali, aplikasi menjaga sesi tetap hidup selama masih aktif.

---

## 1. Pengelolaan Keuangan Pribadi

Ini alur inti sehari-hari (personal finance). Tidak perlu ada teman atau grup untuk memakai bagian ini.

### 1.1 Siapkan Rekening (Akun Bank/E-Wallet)

Sebelum mencatat uang, user membuat "rekening" yang melambangkan tempat uang berada.

1. User membuat rekening: tabungan bank, rekening BCA, GoPay, ShopeePay, uang tunai, kartu kredit, atau lainnya.
2. Tiap rekening punya saldo awal, mata uang, dan status aktif.
3. Rekening bisa dinonaktifkan (arsip) supaya tidak ikut dihitung total saldo, tanpa dihapus.
4. Saldo rekening berubah otomatis setiap ada transaksi masuk/keluar atau pindah dana.

Total saldo di halaman utama = jumlah dari semua rekening yang aktif (yang ikut dihitung).

### 1.2 Tentikan Kategori

Transaksi dikelompokkan ke kategori agar mudah dianalisis.

1. User memakai kategori bawaan sistem (makanan, transportasi, belanja, dsb.) atau membuat sendiri.
2. Kategori punya tipe: `income` (uang masuk) atau `expense` (pengeluaran).
3. Kategori boleh punya sub-kategori (induk dan anak, misalnya "Makan di luar" di bawah "Makanan").
4. Kategori sistem tidak bisa dihapus; kategori buatan user bisa dihapus selama belum dipakai transaksi.

### 1.3 Mencatat Transaksi

Alur paling sering dipakai:

1. User memilih **rekening** asal dan **kategori**.
2. User memilih **tipe**: `income` (gaji, recehan, refund) atau `expense` (jajan, bayar listrik).
3. User mengisi nominal, tanggal, dan boleh menambahkan deskripsi, nama merchant, atau nomor referensi.
4. Status transaksi: `pending` (belum selesai), `completed` (selesai), `cancelled` (batal). Transaksi baru umumnya selesai seketika.
5. Saldo rekening bertambah (income) atau berkurang (expense) mengikuti hal ini.
6. Transaksi bisa dicari berdasarkan kata kunci, tipe, status, kategori, rekening, rentang tanggal, dan besaran nominal.

Satu hal yang perlu diingat: transaksi yang lahir dari aktivitas patungan (dibayar untuk grup) atau setoran tabungan juga tercatat sebagai transaksi di rekening — jadi saldo selalu konsisten dengan kenyataan.

### 1.4 Pindah Dana Antar Rekening

Saat uang dipindah antar rekening milik sendiri (misalnya tarik dari BCA ke tunai):

1. User memilih rekening asal dan tujuan.
2. User mengisi nominal, tanggal, dan catatan.
3. Saldo asal berkurang dan saldo tujuan bertambah — nilainya sama persis, jadi total saldo tidak berubah.

### 1.5 Metode Pembayaran

Metode pembayaran adalah "cara bayar" yang dapat dipakai ulang (tunai, transfer bank, e-wallet, kartu, lainnya).

1. User mendaftarkan metode bayar lengkap dengan penyedia (misalnya "GoPay" dengan provider "Gojek").
2. Satu metode bisa ditandai sebagai bawaan (default) dan bisa dinonaktifkan.
3. Metode ini kemudian nanti dipakai saat membayar pengeluaran grup, pelunasan utang, dan setoran tabungan.

### 1.6 Anggaran (Budget)

1. User membuat anggaran dengan nama dan nominal, untuk satu rentang tanggal.
2. Anggaran bisa dirinci per kategori (misalnya "makanan maksimal 1 juta per bulan").
3. Pengeluaran pada rentang itu dibandingkan dengan anggaran, dan aplikasi memberi pengingat (notifikasi) bila nyaris atau melewati batas.

---

## 2. Patungan

Bagian ini adalah inti kolaborasi: sekumpulan orang membagi pengeluaran bersama (bakti sosial, perjalanan, hajatan, tagihan rumah, proyek) dan saling melunasi.

### 2.1 Membuat Grup

1. User membuat **grup** dan otomatis jadi pemiliknya (owner).
2. Jenis grup dipilih sesuai kebutuhan: perjalanan (`trip`), rumah tangga (`household`), klub (`club`), proyek (`project`), acara (`event`), pribadi (`personal`), atau lainnya (`other`).
3. Grup punya nama, deskripsi, mata uang, dan sebuah **kode undangan** (`invite_code`) — kode inilah yang dipakai orang lain untuk masuk.

### 2.2 Anggota Masuk ke Grup

Ada dua jalan masuk anggota:

- **Diundang** — pemilik/admin mengirim undangan ke email atau langsung ke akun user. Status undangan: `pending` (tunggu), `accepted` (diterima), `rejected` (ditolak), `expired` (kadaluarsa), `cancelled` (dibatalkan).
- **Mengetik kode undangan** — siapa saja yang punya kode grup dapat masuk tanpa undangan.

Alur undangan singkatnya:

```
Pemilik buat grup
  → pemilik undang teman (email / akun)
  → undangan berstatus "menunggu"
  → teman terima   → masuk sebagai anggota
  → teman tolak    → tidak masuk
```

Satu user bisa berada di banyak grup sekaligus. Dalam satu grup, peran ditentukan:

- `owner` — pemilik; memegang kendali penuh.
- `admin` — membantu mengelola grup.
- `member` — anggota biasa; ikut pengeluaran dan pelunasan.

### 2.3 Mencatat Pengeluaran Grup

Ini inti patungan. Saat ada uang keluar untuk kepentingan bersama:

1. Siapa pun anggota (biasanya yang bayar duluan) membuat **pengeluaran** pada grup.
2. Memilih judul, kategori (makanan, transportasi, dsb.), total nominal, dan tanggal.
3. Menentukan **cara bagi** dan siapa saja yang ikut menanggung (`expense_members`).
4. Pengeluaran bisa dibuat sebagai `draft` dulu, lalu diaktifkan. Mumpung masih draft, boleh diedit bebas sebelum mengunci pembagian.
5. Status pengeluaran: `draft`, `active` (sedang berjalan), `settled` (sudah tuntas dibayar semua), `cancelled` (batal).

Bila pengeluarannya panjang (belanjaan pasar, list kuliner), bisa digunakan **item** (rincian barang) — masing-masing item memiliki nama, jumlah, harga satuan, dan bisa dibebankan ke anggota tertentu atau tamu.

### 2.4 Cara Bagi Tagihan (Split)

Saat membuat pengeluaran, cara membaginya dipilih salah satu:

- `equal` — semua anggota yang ditandai kebagian sama rata.
- `exact` — masing-masing dibebani nominal tertentu yang pas.
- `percentage` — masing-masing kebagian persentase tertentu dari total.
- `shares` — dibagi menurut jumlah jatah (share), misalnya anggota dengan 3 jatah membayar 3x lipat.
- `item` — pembagian mengikuti rincian item (masing-masing bayar sesuai barang yang dia ambil).

Anggota juga boleh berupa **tamu** tanpa akun (misalnya adik teman yang tidak pakai Finora) — namanya "guest" dan tetap bisa kebagian tagihan.

### 2.5 Pembayaran & Bukti

Setelah pembagian jalan, orang yang membayar mencatat **pembayaran**:

1. Menunjukkan siapa yang bayar, kapan, nominalnya, dan dari rekening/metode bayar mana.
2. Status pembayaran: `pending` (dicatat), `submitted` (dikirim), `confirmed` (dikonfirmasi), `rejected` (ditolak), `cancelled` (batal).
3. Untuk pengeluaran nontunai (misalnya transfer ke pemilik warung), user mengunggah **bukti bayar** (foto/video) ke pembayaran.
4. Anggota lain atau admin mengonfirmasi pembayaran, kelak memicu pencatatan transaksi di rekening masing-masing agar saldo konsisten.

### 2.6 Pelunasan Utang (Settlement)

Setelah pembagian, biasanya tersisa "si A sudah bayar full, si B dan C belum". Maka:

```
A membayar pengeluaran grup (mis. 300 ribu)
  → B utang 100 ribu ke A
  → C utang 100 ribu ke A
  → pengeluaran berstatus "aktif" (belum tuntas)
```

Alur pelunasan:

1. Aplikasi memetakan siapa berutang ke siapa (dari selisih pembayaran vs beban masing-masing).
2. Si berutang (B) membuat **pelunasan (settlement)**: ke siapa, nominal, dari rekening/metode bayar mana, dan boleh menyertakan bukti (foto bukti transfer).
3. Status pelunasan: `pending` → dihitung, menunggu; `confirmed` → penerima/anggota konfirmasi terima; `rejected` → ditolak; `cancelled` → batal.
4. Saat semua pelunasan terkonfirmasi, **pengeluaran menjadi `settled`** — cerita soal ini tuntas.

Notifikasi muncul mengikuti setiap tahap: ada pembayaran baru, ada yang ngutang, ada pelunasan, sampai pengeluaran lunas.

### 2.7 Acara (Event) dalam Grup

Bila perlu, pengeluaran bisa dikaitkan ke **acara**: nama, deskripsi, lokasi, tanggal mulai-selesai, anggaran, dan status (`planning`, `active`, `completed`, `cancelled`).

Misalnya grup "Trip Bali" membuat acara "Trip Bali 2026" — semua tiket, hotel, makan selama trip dicatat di bawah acara ini. Anggota acara (`event_members`) adalah subset yang ikut perjalanan tersebut, sehingga tagihan trip hanya dibagi ke yang ikut, bukan seluruh anggota grup.

---

## 3. Membantu Teman — Tabungan Bersama

Pilar ini memungkinkan **teman ikut menabung ke target tabunganmu** (atau sebaliknya, kamu membantu menabung target tabungan teman). Ini fitur "bantu teman" yang kamu maksud.

1. User membuat **target tabungan**: nama (misal "Gadget Baru"), jumlah target, tanggal target opsional, ikon, dan warna.
2. Sistem menghasilkan **token berbagi** (`share_token`) yang unik untuk target itu — inilah "link/kode" untuk berbagi ke teman.
3. User membagikan token tersebut ke temannya (lewat chat/media sosial).
4. Teman yang menerima token dapat **ikut menyetor** ke target tersebut, sebagai `contributor`:
   - Menyetor nominal tertentu, tanggal, catatan.
   - Menyebutkan datang dari rekening/metode bayar mana.
   - Boleh mengunggah **bukti transfer**.
5. Setoran masuk dengan status `pending` → `submitted` → dikonfirmasi (`confirmed`) oleh pemilik target. Bila dianggap tidak sah: `rejected`; bila dibatalkan: `cancelled`.
6. Setoran yang terkonfirmasi menambah progres target dan tercatat sebagai transaksi di rekening penyetor — jadi saldo penyetor ikut berkurang secara wajar.

Alur sederhananya:

```
A buat target tabungan (dapat share_token)
  → A bagikan token ke B (teman)
  → B buka target via token
  → B setor nominal + bukti
  → A konfirmasi  → progres target bertambah
  → A tolak       → setoran tidak dihitung
```

Jadi "membantu teman" di sini bersifat dua arah: kamu bisa membantu tabungan orang lain, dan temanmu bisa membantu tabunganmu. Target tetap milik satu user (pemilik), teman lain hanya ikut menyetor.

---

## 4. Berteman

Pilar ini menghubungkan antar user. Ini alur yang baru saja kamu rancang: cari → ajak → setuju/tolak → berteman.

### 4.1 Mencari User

1. User membuka halaman "Teman" / "Cari Teman".
2. User mengetik **username** atau nama user lain di kotak pencarian.
3. Aplikasi mencari profil pengguna yang cocok (username bersifat unik, jadi hasilnya presisi).

### 4.2 Mengirim Permintaan Pertemanan

1. User (A) menemukan profil user lain (B) dan menekan **"Tambah teman"**.
2. Sistem membuat **permintaan pertemanan** dari A ke B, berstatus `pending` (menunggu).
3. B menerima notifikasi bahwa A ingin berteman.

Beberapa hal masyarakat yang berlaku:
- A hanya bisa mengirim sekali ke B; permintaan duplikat ditolak.
- Kalau mereka sudah berteman, tidak bisa mengirim lagi.
- A tidak bisa mengirim permintaan ke dirinya sendiri.

### 4.3 Setuju atau Tolak

Sekarang keputusan ada di B:

- **B menyetujui** → permintaan berstatus `accepted`, dan terbentuk **hubungan pertemanan** antara A dan B. A mendapat notifikasi "permintaan pertemanan disetujui".
- **B menolak** → permintaan berstatus `rejected`, tidak ada hubungan pertemanan. A mendapat notifikasi "permintaan pertemanan ditolak".
- B juga boleh sekadar **membatalkan/mengabaikan** permintaan (`cancelled`).

Alurnya:

```
A cari username B
  → A kirim permintaan  (pending)
  → B setujui  → A dan B berteman  + notifikasi "disetujui" ke A
  → B tolak    → tidak berteman     + notifikasi "ditolak" ke A
```

### 4.4 Daftar Teman & Skala

1. Setiap hubungan pertemanan disimpan sebagai satu pasangan (A-B), lengkap dengan waktu berteman.
2. Seorang user dapat memiliki teman sangat banyak — puluhan, ratusan, bahkan seribu lebih — karena setiap teman hanya butuh satu baris data. Tidak ada batasan teknis di dalam aplikasi selain kapasitas server.

### 4.5 Kaitan Berteman dengan Fitur Lain

Pertemanan menjadi dasar untuk alur kolaborasi yang lebih mulus:

- Dari **daftar teman**, A bisa langsung mengundang B masuk grup patungan.
- Dari profil teman, A bisa mengirim permintaan patungan atau berbagi target tabungan.
- Notifikasi antar teman (permintaan, penyetoran, undangan) semuanya tersampaikan lewat pusat notifikasi.

---

## 5. Notifikasi — Penghubung Semua Alur

Setiap kejadian penting yang melibatkan pengguna lain menghasilkan **notifikasi**. Jenisnya:

- `friend` — permintaan pertemanan masuk, disetujui, atau ditolak.
- `invitation` — diundang masuk grup.
- `expense` — ada pengeluaran baru / tagihan yang membebanimu.
- `payment` — ada pembayaran yang perlu dikonfirmasi.
- `settlement` — ada pelunasan atau yang perlu dikonfirmasi.
- `savings` — ada setoran ke target tabunganmu.
- `budget` — anggaran mendekati/melewati batas.
- `recurring` — transaksi berulang dijalankan.
- `system` — informasi umum dari sistem.

Notifikasi bisa dibuka/ditandai sudah dibaca, dan memuat tautan ke data terkait (permintaan teman, pengeluaran, dan sebagainya). Inilah jembatan yang membuat pengguna tetap sadar sedang terjadi apa, tanpa harus membuka tiap halaman.

---

## 6. Peta Alur Menyeluruh

Berikut gambaran bagaimana keempat pilar sambung-menyambung dalam pemakaian nyata:

**Skenario 1: Keuangan harian (self)**

```
Login → pastikan rekening ada → catat gaji (income) → catat jajan (expense)
      → mau bayar pakai e-wallet? daftar metode bayar → pindah dana antar rekening
      → cek anggaran bulanan → dapat pengingat bila melebihi
```

**Skenario 2: Patungan trip**

```
A buat grup "Trip Bali" (dapat invite_code)
  → A undang B dan C (email/akun) → mereka masuk & jadi member
  → A buat acara "Trip Bali 2026" → tandai B dan C sebagai peserta acara
  → A bayar hotel 3 juta, catat pengeluaran, cara bagi "equal", beban A/B/C
  → B dan C belum bayar → pengeluaran tetap "active"
  → B lunas 1 juta ke A (settlement + bukti) → A konfirmasi
  → C lunas 1 juta ke A → A konfirmasi
  → pengeluaran jadi "settled" — trip beres dan tidak ada yang nunggak
```

**Skenario 3: Bantu teman menabung**

```
A buat target "Biaya Nikah" → dapat share_token → bagikan ke B
  → B buka via token → setor 500 ribu + bukti → A konfirmasi
  → progres target A bertambah; saldo B berkurang; keduanya dapat notifikasi
```

**Skenario 4: Dari orang asing jadi teman, lalu patungan**

```
A cari username B → A kirim permintaan pertemanan
  → B setujui → A & B berteman (B menolak = tidak berteman + notifikasi)
  → A undang B ke grup patungan dari daftar teman → patungan berjalan seperti Skenario 2
```

---

Alur-alur di atas saling terhubung: keuangan pribadi menjadi fondasi saldo, patungan memakai rekening dan metode bayar, tabungan bersama melibatkan teman, dan pertemanan mempermudah semua kolaborasi. Satu sistem, satu sumber kebenaran untuk uang.
