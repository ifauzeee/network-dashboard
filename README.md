````markdown
# NetMon - Dashboard Pemantauan Jaringan 📊

[![Lisensi: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Python](https://img.shields.io/badge/Python-3.8%2B-blue.svg)](https://www.python.org/)
[![Flask](https://img.shields.io/badge/Flask-2.x%2B-green.svg)](https://flask.palletsprojects.com/)

**NetMon** adalah aplikasi web dashboard yang elegan dan responsif, dirancang untuk memberikan wawasan lengkap mengenai kondisi jaringan Anda. Aplikasi ini memungkinkan pengguna untuk memantau lalu lintas jaringan secara *real-time*, melakukan tes kecepatan internet yang akurat, melihat informasi geolokasi IP, dan melacak riwayat data jaringan dengan antarmuka yang modern dan intuitif.

---

## Screenshot Aplikasi

![Tampilan utama dashboard NetMon](https://i.imgur.com/nJ3g7g1.png)
*Tampilan utama dashboard NetMon dengan mode gelap.*

---

## Fitur Utama ✨

-   **Dashboard Real-time:** Pantau kecepatan unduh dan unggah jaringan Anda saat ini. Dilengkapi dengan grafik riwayat kecepatan dan rata-rata kecepatan berdasarkan rentang waktu yang dipilih.
-   **Tes Kecepatan Akurat:** Lakukan tes kecepatan internet dengan pemilihan server otomatis untuk mendapatkan hasil Ping, Download, dan Upload yang paling akurat. Dilengkapi dengan animasi progres yang informatif.
-   **Info Geolokasi IP:** Tampilkan alamat IP publik Anda beserta informasi detail seperti ISP, organisasi, dan lokasi yang divisualisasikan pada peta interaktif menggunakan Leaflet.js.
-   **Riwayat & Filter Data:** Semua hasil tes kecepatan dan data pemantauan disimpan ke dalam database. Halaman riwayat memungkinkan Anda untuk melihat, memfilter data berdasarkan tipe, dan mengekspor seluruh riwayat ke dalam format file `.csv`.
-   **Pengaturan Fleksibel:**
    -   **Mode Terang & Gelap:** Ganti tema aplikasi sesuai preferensi untuk kenyamanan visual.
    -   **Manajemen Data:** Hapus seluruh riwayat data dengan satu klik.

---

## Tumpukan Teknologi 🛠️

Proyek ini dibangun menggunakan teknologi modern di sisi backend dan frontend.

#### **Backend**

-   **Python 3.8+**
-   **Flask:** Kerangka kerja web mikro untuk menangani *routing* dan logika aplikasi.
-   **SQLAlchemy:** ORM (Object-Relational Mapper) untuk interaksi yang aman dan mudah dengan database SQLite.
-   **psutil:** Untuk mendapatkan data penggunaan jaringan dari sistem operasi secara *real-time*.
-   **speedtest-cli:** *Library* Python untuk menjalankan tes kecepatan internet.
-   **pandas:** Digunakan untuk memproses dan mengekspor data ke format CSV.
-   **gunicorn:** WSGI server untuk deployment di lingkungan produksi.

#### **Frontend**

-   HTML5 & CSS3 (dengan Variabel CSS untuk tema).
-   **JavaScript (ES6+):** Untuk menangani interaktivitas, AJAX (Fetch API), dan logika antarmuka.
-   **Chart.js:** Untuk membuat grafik garis dan batang yang indah dan interaktif.
-   **Leaflet.js:** Untuk menampilkan peta geolokasi IP yang interaktif.

---

## Instalasi & Konfigurasi 🚀

Ikuti langkah-langkah berikut untuk menjalankan proyek ini di mesin lokal Anda.

### **1. Prasyarat**

-   Pastikan Anda telah menginstal **Python 3.8** atau versi yang lebih baru.
-   **Git** untuk mengkloning *repository*.

### **2. Kloning Repository**

```bash
git clone [https://github.com/ifauzeee/network-dashboard.git](https://github.com/ifauzeee/network-dashboard.git)
cd network-dashboard
````

### **3. Buat dan Aktifkan Virtual Environment**

Sangat disarankan untuk menggunakan *virtual environment* untuk mengisolasi dependensi proyek.

  - **Pada Windows:**
    ```bash
    python -m venv venv
    venv\Scripts\activate
    ```
  - **Pada macOS/Linux:**
    ```bash
    python3 -m venv venv
    source venv/bin/activate
    ```

### **4. Instal Dependensi**

Semua *library* yang dibutuhkan tercantum dalam `requirements.txt`. Instal semuanya dengan satu perintah:

```bash
pip install -r requirements.txt
```

### **5. Jalankan Aplikasi**

Setelah semua dependensi terinstal, jalankan aplikasi Flask:

```bash
python app.py
```

### **6. Akses Aplikasi**

Buka browser Anda dan kunjungi alamat `http://127.0.0.1:5000`. Aplikasi NetMon siap digunakan\!

-----

## Struktur Proyek 📁

Berikut adalah gambaran umum struktur file dan direktori penting dalam proyek ini.

```
network-dashboard/
│
├── static/              # File statis (CSS, JS, gambar)
│   ├── app.js           # Logika utama frontend
│   ├── style.css        # Semua gaya CSS
│   └── images/          # Aset gambar
│
├── templates/           # Template HTML Jinja2
│   ├── layout.html      # Template dasar (induk)
│   ├── dashboard.html   # Halaman dashboard
│   ├── history.html     # Halaman riwayat
│   ├── myip.html        # Halaman info IP
│   ├── speedtest.html   # Halaman tes kecepatan
│   └── settings.html    # Halaman pengaturan
│
├── .gitignore           # File untuk mengabaikan file/folder yang tidak perlu
├── app.py               # File utama aplikasi Flask (backend)
├── check_network.py     # Script bantuan untuk diagnostik
├── Procfile             # Konfigurasi untuk deployment (misal: Heroku)
├── README.md            # Dokumentasi proyek (file ini)
└── requirements.txt     # Daftar dependensi Python
```

*(File seperti `venv`, `__pycache__`, dan `network_data.db` sengaja diabaikan oleh `.gitignore`)*

-----

## Pemecahan Masalah (Troubleshooting) 🤔

  - **Error terkait database (`no such table`, dll.):**
    Jika Anda mengalami error yang berkaitan dengan struktur database setelah melakukan perubahan pada model SQLAlchemy, solusi termudah adalah dengan menghapus file `network_data.db`. File ini akan dibuat ulang secara otomatis dengan skema terbaru saat aplikasi dijalankan kembali. (Catatan: Ini akan menghapus semua riwayat data yang tersimpan).

  - **Modul tidak ditemukan (`ModuleNotFoundError`):**
    Pastikan Anda sudah mengaktifkan *virtual environment* (`venv`) sebelum menjalankan `pip install` dan `python app.py`.

-----

## Berkontribusi 🤝

Kontribusi untuk mengembangkan NetMon sangat diterima\! Jika Anda ingin berkontribusi, silakan ikuti langkah-langkah berikut:

1.  **Fork** *repository* ini.
2.  Buat *branch* baru untuk fitur Anda (`git checkout -b feature/NamaFitur`).
3.  *Commit* perubahan Anda (`git commit -m 'Menambahkan fitur X'`).
4.  *Push* ke *branch* Anda (`git push origin feature/NamaFitur`).
5.  Buat **Pull Request** baru.

Jangan ragu untuk membuka **Issue** jika Anda menemukan bug atau memiliki saran fitur.

-----

## Lisensi 📝

Proyek ini dilisensikan di bawah [Lisensi MIT](https://opensource.org/licenses/MIT).

-----

## Kontak 🧑‍💻

Dibuat oleh **Muhammad Ibnu Fauzi**.

  - **GitHub:** [@ifauzeee](https://github.com/ifauzeee)
  - **Portfolio:** [ifauzeee.vercel.app](https://ifauzeee.vercel.app/)