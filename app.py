# File: app.py (Diperbaiki)

from flask import Flask, render_template, jsonify, request, send_file
import psutil
import time
from datetime import datetime, timedelta
import pandas as pd
import os
import speedtest
import requests
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, String
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.exc import SQLAlchemyError
import threading
from threading import Lock

# --- Inisialisasi Aplikasi Flask dan Konfigurasi ---
app = Flask(__name__)

# --- PERUBAHAN: Konfigurasi Database untuk Deployment ---
# Gunakan DATABASE_URL dari environment variable jika ada, jika tidak, gunakan SQLite lokal.
# Render akan secara otomatis menyediakan DATABASE_URL.
DATABASE_URL = os.environ.get('DATABASE_URL')
if DATABASE_URL and DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1) # Ubah nama protokol untuk SQLAlchemy

DB_URI = DATABASE_URL or f'sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), "network_data.db")}'

# Inisialisasi SQLAlchemy
Base = declarative_base()

class SpeedRecord(Base):
    __tablename__ = 'speeds'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.now)
    download = Column(Float, nullable=False)
    upload = Column(Float, nullable=False)
    type = Column(String, nullable=False, default="Live Monitoring")

# Hapus connect_args untuk PostgreSQL karena tidak diperlukan lagi
engine = create_engine(DB_URI, echo=False) 
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

# --- PERBAIKAN: Variabel Global untuk Background Task ---
# Variabel untuk menyimpan hasil live monitoring
current_network_speed = {"upload": 0.0, "download": 0.0}
speed_lock = Lock()

# Variabel untuk menyimpan status dan hasil speed test
speedtest_state = {'status': 'idle', 'data': None, 'error': None} # idle, running, complete, error
speedtest_lock = Lock()

# --- Fungsi Helper yang Diperbaiki ---

def get_instant_network_speed():
    """Mengukur kecepatan jaringan saat ini (versi blocking internal)."""
    try:
        net_io_start = psutil.net_io_counters()
        time.sleep(1)
        net_io_end = psutil.net_io_counters()
        bytes_sent = net_io_end.bytes_sent - net_io_start.bytes_sent
        bytes_recv = net_io_end.bytes_recv - net_io_start.bytes_recv
        
        upload_speed = (bytes_sent * 8) / (1024 * 1024)
        download_speed = (bytes_recv * 8) / (1024 * 1024)
        
        return {"upload": round(upload_speed, 2), "download": round(download_speed, 2)}
    except Exception:
        return {"upload": 0.0, "download": 0.0}

def save_speed_to_db(download, upload, record_type="Live Monitoring"):
    """Menyimpan data kecepatan ke database dengan tipe."""
    session = Session()
    try:
        new_record = SpeedRecord(
            timestamp=datetime.now(),
            download=download,
            upload=upload,
            type=record_type
        )
        session.add(new_record)
        session.commit()
    except SQLAlchemyError as e:
        session.rollback()
        print(f"Error saat menyimpan ke database: {e}")
    finally:
        session.close()
        
# --- PERBAIKAN: Fungsi untuk Background Thread ---

def background_monitor_speed():
    """Fungsi yang berjalan di background untuk memonitor kecepatan jaringan."""
    while True:
        speeds = get_instant_network_speed()
        with speed_lock:
            global current_network_speed
            current_network_speed = speeds
        # Simpan ke DB setiap 5 detik, cocok dengan interval frontend
        save_speed_to_db(speeds['download'], speeds['upload'], "Live Monitoring")
        time.sleep(4) # Total sleep menjadi 5 detik (1 dari get_instant_network_speed + 4 dari sini)

def background_run_speedtest():
    """ (MODIFIED) Fungsi speed test menggunakan library ookla-speedtest yang baru. """
    global speedtest_state

    with speedtest_lock:
        speedtest_state = {
            'status': 'running',
            'data': {'ping': None, 'download': None, 'upload': None, 'server_name': None},
            'error': None,
            'progress': 'ping'
        }

    try:
        # Inisialisasi library baru
        st = speedtest.Speedtest()
        st.get_best_server()

        # --- PING STAGE ---
        st.get_ping()
        ping_ms = round(st.results.ping)
        server_name = st.results.server['name']
        with speedtest_lock:
            speedtest_state['data']['ping'] = ping_ms
            speedtest_state['data']['server_name'] = server_name
            speedtest_state['progress'] = 'download'

        # --- DOWNLOAD STAGE ---
        st.download()
        download_mbps = round(st.results.download / 1_000_000, 2)
        with speedtest_lock:
            speedtest_state['data']['download'] = download_mbps
            speedtest_state['progress'] = 'upload'

        # --- UPLOAD STAGE ---
        st.upload()
        upload_mbps = round(st.results.upload / 1_000_000, 2)
        with speedtest_lock:
            speedtest_state['data']['upload'] = upload_mbps
            speedtest_state['progress'] = 'done'

        # --- FINALIZATION ---
        save_speed_to_db(download_mbps, upload_mbps, "Speed Test")
        with speedtest_lock:
            speedtest_state['status'] = 'complete'

    except Exception as e:
        print(f"Error Speedtest: {e}")
        with speedtest_lock:
            speedtest_state['status'] = 'error'
            speedtest_state['error'] = 'Gagal menjalankan speed test. Periksa koneksi Anda.'

# --- Routes Halaman ---
@app.route('/')
def index():
    # (MODIFIED) Pass a timestamp to the template for cache busting
    return render_template('layout.html', cache_version=int(time.time()))

@app.route('/page/dashboard')
def dashboard_page():
    return render_template('dashboard.html')

@app.route('/page/speedtest')
def speedtest_page():
    return render_template('speedtest.html')

@app.route('/page/myip')
def myip_page():
    return render_template('myip.html')

@app.route('/page/history')
def history_page():
    return render_template('history.html')

@app.route('/page/settings')
def settings_page():
    return render_template('settings.html')


# --- API Endpoints yang Diperbaiki ---

@app.route('/get_my_ip')
def get_my_ip():
    """API untuk mendapatkan informasi geolokasi dari IP publik (Tidak Berubah)."""
    try:
        geo_response = requests.get('http://ip-api.com/json/', timeout=10)
        geo_response.raise_for_status()
        geo_data = geo_response.json()
        
        if geo_data.get('status') == 'success':
            return jsonify({
                'success': True, 'ip_address': geo_data.get('query'), 'isp': geo_data.get('isp', 'N/A'),
                'organization': geo_data.get('org', 'N/A'), 'city': geo_data.get('city', 'N/A'),
                'region': geo_data.get('regionName', 'N/A'), 'country': geo_data.get('country', 'N/A'),
                'latitude': geo_data.get('lat'), 'longitude': geo_data.get('lon'),
                'timezone': geo_data.get('timezone', 'N/A')
            })
        else:
            return jsonify({'success': False, 'error': 'Gagal mengambil data geolokasi.'}), 500
    except requests.RequestException as e:
        return jsonify({'success': False, 'error': 'Koneksi ke API geolokasi gagal.'}), 500
    except Exception as e:
        return jsonify({'success': False, 'error': 'Terjadi kesalahan saat mengambil informasi IP.'}), 500

@app.route('/get_speed')
def get_speed():
    """API untuk mendapatkan kecepatan saat ini secara non-blocking."""
    with speed_lock:
        return jsonify(current_network_speed)

@app.route('/run_speedtest', methods=['POST'])
def run_speedtest():
    """API untuk memulai speed test di background."""
    with speedtest_lock:
        if speedtest_state['status'] == 'running':
            return jsonify({'success': False, 'message': 'Speed test sudah berjalan.'}), 409
    
    # Jalankan di thread baru
    thread = threading.Thread(target=background_run_speedtest)
    thread.daemon = True
    thread.start()
    
    return jsonify({'success': True, 'message': 'Speed test dimulai.'}), 202

@app.route('/speedtest_status')
def speedtest_status():
    """API untuk memeriksa status speed test."""
    with speedtest_lock:
        return jsonify(speedtest_state)

@app.route('/get_history')
def get_history():
    """API untuk mengambil riwayat kecepatan dari database."""
    session = Session()
    try:
        time_range = request.args.get('time_range', 'all')
        record_type = request.args.get('type', 'all')
        query = session.query(SpeedRecord).order_by(SpeedRecord.timestamp.desc())

        if time_range == '1hour':
            one_hour_ago = datetime.now() - timedelta(hours=1)
            query = query.filter(SpeedRecord.timestamp >= one_hour_ago)
        elif time_range != 'all_data':
            query = query.limit(10)

        if record_type != 'all':
            query = query.filter(SpeedRecord.type == record_type)

        records = query.all()
        history = [
            {
                "timestamp": record.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                "download": record.download, "upload": record.upload, "type": record.type
            }
            for record in records
        ]
        return jsonify(history)
    except Exception as e:
        print(f"Error saat mengambil riwayat: {e}")
        return jsonify({"error": "Gagal mengambil riwayat"}), 500
    finally:
        session.close()

@app.route('/clear_history', methods=['POST'])
def clear_history():
    """API untuk menghapus semua riwayat."""
    session = Session()
    try:
        session.query(SpeedRecord).delete()
        session.commit()
        return jsonify({"message": "Riwayat berhasil dihapus"})
    except SQLAlchemyError as e:
        session.rollback()
        print(f"Error saat menghapus riwayat: {e}")
        return jsonify({"message": "Gagal menghapus riwayat"}), 500
    finally:
        session.close()

@app.route('/export_csv')
def export_csv():
    """API untuk mengekspor riwayat ke file CSV."""
    session = Session()
    BASE_DIR = os.path.dirname(os.path.abspath(__file__))
    try:
        query = session.query(SpeedRecord).statement
        df = pd.read_sql(query, engine)
        df['timestamp'] = pd.to_datetime(df['timestamp']).dt.strftime('%Y-%m-%d %H:%M:%S')
        csv_path = os.path.join(BASE_DIR, 'network_history.csv')
        df.to_csv(csv_path, index=False)
        return send_file(csv_path, as_attachment=True, download_name='network_history.csv')
    except Exception as e:
        print(f"Error saat ekspor CSV: {e}")
        return jsonify({"message": "Gagal mengekspor riwayat"}), 500
    finally:
        session.close()

# --- Menjalankan Aplikasi ---
if __name__ == '__main__':
    # Mulai thread background untuk monitoring
    monitor_thread = threading.Thread(target=background_monitor_speed)
    monitor_thread.daemon = True
    monitor_thread.start()
    
    app.run(debug=True)