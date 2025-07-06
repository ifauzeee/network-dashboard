```markdown
# Network Dashboard (NetMon)

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python Version](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/downloads/)
[![Flask](https://img.shields.io/badge/Flask-3.0%2B-green.svg)](https://flask.palletsprojects.com/)

**NetMon** adalah dashboard pemantauan jaringan premium yang dibangun dengan Flask dan Chart.js. Aplikasi ini memungkinkan pengguna untuk memantau kecepatan jaringan secara real-time, melakukan tes kecepatan internet, melihat informasi geolokasi IP, dan melacak data historis dengan fitur filter berdasarkan tipe.

![NetMon Logo](static/images/logo.png)

## Fitur Utama
- **Dashboard**: Pantau kecepatan unduh dan unggah secara real-time dengan grafik garis dan batang untuk data historis dan rata-rata.
- **Speed Test**: Lakukan tes kecepatan internet dengan hasil ping, unduh, dan unggah yang divisualisasikan menggunakan speedometer.
- **Cek IP Saya**: Tampilkan alamat IP publik dan informasi geolokasi pada peta interaktif.
- **History**: Lihat dan filter riwayat kecepatan jaringan berdasarkan tipe (Live Monitoring atau Speed Test) dengan opsi ekspor ke CSV.
- **Settings**: Sesuaikan tema (mode terang/gelap) dan kelola data historis.

## Teknologi yang Digunakan
- **Backend**: Flask (Python)
- **Frontend**: HTML, CSS, JavaScript, Chart.js untuk visualisasi data, Leaflet.js untuk peta
- **Database**: SQLite dengan SQLAlchemy ORM
- **Dependensi**: `psutil`, `pandas`, `speedtest-cli`, `requests`

## Instalasi
Ikuti langkah-langkah berikut untuk menyiapkan dan menjalankan proyek secara lokal.

### Prasyarat
- Python 3.8 atau lebih tinggi
- Git (opsional, untuk mengkloning repository)
- Virtual Environment (disarankan untuk isolasi dependensi)

### Langkah Instalasi
1. **Kloning Repository** (jika belum diunduh):
   ```bash
   git clone https://github.com/ifauzeee/network-dashboard.git
   cd network-dashboard
   ```

2. **Buat Virtual Environment** (disarankan):
   - Pada Windows:
     ```bash
     python -m venv venv
     venv\Scripts\activate
     ```
   - Pada macOS/Linux:
     ```bash
     python3 -m venv venv
     source venv/bin/activate
     ```

3. **Instal Dependensi**:
   ```bash
   pip install -r requirements.txt
   ```
   Jika file `requirements.txt` tidak lengkap atau tidak ada, instal paket yang diperlukan secara manual:
   ```bash
   pip install Flask SQLAlchemy psutil pandas speedtest-cli requests
   ```

4. **Jalankan Aplikasi**:
   ```bash
   flask run
   ```
   Aplikasi akan tersedia di `http://127.0.0.1:5000`.

### Pemecahan Masalah
- **Kesalahan Database**: Jika Anda menemui pesan kesalahan seperti `no such column: speeds.type`, hapus file `network_data.db` di direktori proyek untuk membuat ulang database dengan skema terbaru. Catatan: Ini akan menghapus data historis.
- **Masalah Dependensi**: Pastikan semua paket diinstal di dalam virtual environment. Jika masih ada masalah, periksa versi Python dan instal ulang dependensi.

## Penggunaan
Setelah aplikasi berjalan, buka browser Anda dan kunjungi `http://127.0.0.1:5000`. Berikut adalah panduan singkat untuk setiap fitur:
- **Dashboard**: Melihat kecepatan jaringan real-time dan data historis. Pilih rentang waktu untuk melihat rata-rata kecepatan.
- **Speed Test**: Klik tombol "Start Test" untuk mengukur kecepatan internet Anda. Hasil akan ditampilkan dalam bentuk speedometer dan metrik.
- **Cek IP Saya**: Melihat alamat IP publik Anda dan lokasi perkiraan pada peta interaktif.
- **History**: Melihat riwayat kecepatan jaringan. Gunakan filter untuk memilih tipe data ("All Types", "Live Monitoring", "Speed Test") dan ekspor data sebagai CSV.
- **Settings**: Beralih antara tema terang dan gelap atau hapus riwayat data.

## Struktur Proyek
Berikut adalah struktur direktori utama proyek:
```
network-dashboard/
│
├── static/              # File statis (CSS, JS, gambar)
│   ├── app.js           # Logika frontend JavaScript
│   ├── style.css        # Gaya CSS
│   └── images/          # Gambar seperti logo
│
├── templates/           # Template HTML untuk Flask
│   ├── layout.html      # Template dasar
│   ├── dashboard.html   # Halaman dashboard
│   ├── history.html     # Halaman riwayat dengan filter tipe
│   ├── myip.html        # Halaman informasi IP
│   ├── speedtest.html   # Halaman tes kecepatan
│   └── settings.html    # Halaman pengaturan
│
├── app.py               # File utama aplikasi Flask
├── requirements.txt     # Daftar dependensi
├── network_data.db      # File database SQLite (dibuat saat aplikasi dijalankan)
└── README.md            # Dokumentasi proyek
```

## Screenshots
*(Tambahkan screenshot dari halaman dashboard, speed test, history, dll., jika diinginkan. Anda dapat mengunggah gambar ke direktori `screenshots/` dan menautkannya di sini, misalnya:)*
```markdown
![Dashboard](screenshots/dashboard.png)
![Speed Test](screenshots/speedtest.png)
![History](screenshots/history.png)
```

## Kontribusi
Kontribusi sangat diharapkan! Jika Anda ingin berkontribusi, ikuti langkah-langkah berikut:
1. Fork repository ini.
2. Buat branch baru untuk fitur atau perbaikan bug Anda (`git checkout -b feature/nama-fitur`).
3. Commit perubahan Anda (`git commit -m "Menambahkan fitur X"`).
4. Push ke branch Anda (`git push origin feature/nama-fitur`).
5. Buat Pull Request di GitHub.

Silakan buka Issue untuk melaporkan bug, meminta fitur baru, atau memberikan saran.

## Lisensi
Proyek ini dilisensikan di bawah [MIT License](LICENSE). Lihat file lisensi untuk detail lebih lanjut.

## Kontak
- **Author**: Muhammad Ibnu Fauzi
- **GitHub**: [ifauzeee](https://github.com/ifauzeee)
- **Portfolio**: [ifauzeee.github.io/portofolio](https://ifauzeee.github.io/portofolio/)