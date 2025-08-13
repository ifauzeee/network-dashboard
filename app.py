from flask import Flask, render_template, jsonify, request, send_file
import psutil
import time
from datetime import datetime, timedelta
import pandas as pd
import os
import speedtest as speedtest_cli
import requests
from sqlalchemy import create_engine, Column, Integer, Float, DateTime, String
from sqlalchemy.orm import sessionmaker, declarative_base
from sqlalchemy.exc import SQLAlchemyError
import threading
import logging

# --- Konfigurasi Logging ---
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

# --- Inisialisasi Aplikasi Flask ---
app = Flask(__name__)

# --- Konfigurasi Database ---
DB_URI = os.environ.get('DATABASE_URL', f'sqlite:///{os.path.join(os.path.dirname(os.path.abspath(__file__)), "network_data.db")}')
if DB_URI.startswith("postgres://"):
    DB_URI = DB_URI.replace("postgres://", "postgresql://", 1)

Base = declarative_base()

class SpeedRecord(Base):
    __tablename__ = 'speeds'
    id = Column(Integer, primary_key=True)
    timestamp = Column(DateTime, nullable=False, default=datetime.now)
    download = Column(Float, nullable=False)
    upload = Column(Float, nullable=False)
    type = Column(String, nullable=False, default="Live Monitoring")

engine = create_engine(DB_URI, echo=False)
Base.metadata.create_all(engine)
Session = sessionmaker(bind=engine)

# --- State Management ---
speedtest_state_lock = threading.Lock()
speedtest_state = {'status': 'idle'}

network_stats_lock = threading.Lock()
latest_network_stats = {"upload": 0.0, "download": 0.0}

# --- Fungsi Helper ---
def save_speed_to_db(download, upload, record_type="Live Monitoring"):
    """Menyimpan hasil speed test ke database."""
    if download > 0 or upload > 0:  # Only save non-zero values
        with Session() as session:
            try:
                new_record = SpeedRecord(timestamp=datetime.now(), download=download, upload=upload, type=record_type)
                session.add(new_record)
                session.commit()
                logging.debug(f"Saved to DB: download={download}, upload={upload}, type={record_type}")
            except SQLAlchemyError as e:
                session.rollback()
                logging.error(f"DB Save Error: {e}")

def background_network_monitor():
    """Memantau lalu lintas jaringan dari interface aktif (Wi-Fi)."""
    global latest_network_stats
    last_counters = psutil.net_io_counters(pernic=True)
    active_interface = "Wi-Fi"  # Prioritaskan interface Wi-Fi berdasarkan output check_network.py

    while True:
        time.sleep(2)
        current_counters = psutil.net_io_counters(pernic=True)

        # Gunakan hanya interface Wi-Fi
        download_mbps = 0.0
        upload_mbps = 0.0
        if active_interface in last_counters and active_interface in current_counters:
            start_io = last_counters[active_interface]
            end_io = current_counters[active_interface]
            bytes_recv = end_io.bytes_recv - start_io.bytes_recv
            bytes_sent = end_io.bytes_sent - start_io.bytes_sent

            # Perhitungan kecepatan dalam Mbps
            download_mbps = round((bytes_recv * 8) / (2 * 1024 * 1024), 2)
            upload_mbps = round((bytes_sent * 8) / (2 * 1024 * 1024), 2)

            logging.debug(f"Interface {active_interface}: download={download_mbps} Mbps, upload={upload_mbps} Mbps")

            # Save to database if non-zero
            if download_mbps > 0 or upload_mbps > 0:
                save_speed_to_db(download_mbps, upload_mbps, "Live Monitoring")

        with network_stats_lock:
            latest_network_stats = {"upload": upload_mbps, "download": download_mbps}

        last_counters = current_counters

def background_run_speedtest():
    """Menjalankan speed test dengan pemilihan server otomatis dan pelaporan bertahap."""
    global speedtest_state

    try:
        with speedtest_state_lock:
            speedtest_state = {
                'status': 'running',
                'progress': 'ping',
                'data': {'ping': 0, 'download': 0, 'upload': 0, 'server_name': ''}
            }

        st = speedtest_cli.Speedtest(secure=True, timeout=60)
        logging.info("Mencari server terbaik...")
        st.get_best_server()
        logging.info(f"Server terbaik ditemukan: {st.results.server.get('name')}")

        with speedtest_state_lock:
            speedtest_state['data']['ping'] = st.results.ping
            speedtest_state['progress'] = 'download'

        st.download(threads=10)

        with speedtest_state_lock:
            speedtest_state['data']['download'] = round(st.results.download / 1_000_000, 2)
            speedtest_state['progress'] = 'upload'

        st.upload(threads=10)

        results = st.results.dict()
        download_mbps = round(results['download'] / 1_000_000, 2)
        upload_mbps = round(results['upload'] / 1_000_000, 2)

        final_data = {
            'ping': results['ping'],
            'download': download_mbps,
            'upload': upload_mbps,
            'server_name': f"{results['server']['name']} ({results['server']['sponsor']})"
        }

        save_speed_to_db(download_mbps, upload_mbps, "Speed Test")

        with speedtest_state_lock:
            speedtest_state = {'status': 'complete', 'data': final_data}

    except Exception as e:
        logging.error(f"Speed Test Error: {e}")
        with speedtest_state_lock:
            speedtest_state = {'status': 'error', 'error': str(e)}

# --- Routes ---
@app.route('/')
def index():
    cache_version = int(time.time())
    return render_template('layout.html', cache_version=cache_version)

@app.route('/page/<path:page_name>')
def page(page_name):
    allowed_pages = ['dashboard', 'speedtest', 'myip', 'history', 'settings']
    if page_name in allowed_pages:
        return render_template(f'{page_name}.html')
    return "Not Found", 404

@app.route('/get_speed')
def get_speed():
    with network_stats_lock:
        logging.debug(f"Returning speed: {latest_network_stats}")
        return jsonify(latest_network_stats)

@app.route('/run_speedtest', methods=['POST'])
def run_speedtest():
    with speedtest_state_lock:
        if speedtest_state.get('status') == 'running':
            return jsonify({'success': False, 'message': 'Tes lain sedang berjalan.'}), 409

        speedtest_state['status'] = 'running'
        thread = threading.Thread(target=background_run_speedtest, daemon=True)
        thread.start()
        return jsonify({'success': True})

@app.route('/speedtest_status')
def get_speedtest_status():
    with speedtest_state_lock:
        current_state = speedtest_state.copy()
        if speedtest_state['status'] in ['complete', 'error']:
            speedtest_state['status'] = 'idle'
        logging.debug(f"Speedtest status: {current_state}")
        return jsonify(current_state)

@app.route('/get_my_ip')
def get_my_ip():
    try:
        response = requests.get('http://ip-api.com/json/', timeout=10)
        response.raise_for_status()
        data = response.json()
        return jsonify({
            'success': True, 'ip_address': data.get('query'), 'isp': data.get('isp'),
            'organization': data.get('org'), 'city': data.get('city'),
            'region': data.get('regionName'), 'country': data.get('country'),
            'latitude': data.get('lat'), 'longitude': data.get('lon'),
            'timezone': data.get('timezone')
        })
    except requests.RequestException as e:
        logging.error(f"Geo-location API error: {e}")
        return jsonify({'success': False, 'error': 'API geolokasi gagal dihubungi.'}), 500

@app.route('/get_history')
def get_history():
    with Session() as session:
        time_range = request.args.get('time_range', 'all')
        record_type = request.args.get('type', 'all')

        query = session.query(SpeedRecord).order_by(SpeedRecord.timestamp.desc())

        if time_range == '1hour':
            query = query.filter(SpeedRecord.timestamp >= datetime.now() - timedelta(hours=1))
        elif time_range == 'all':
            query = query.limit(20)

        if record_type != 'all':
            query = query.filter(SpeedRecord.type == record_type)

        records = query.all()
        history = [
            {"timestamp": r.timestamp.strftime("%Y-%m-%d %H:%M:%S"), "download": r.download, "upload": r.upload, "type": r.type}
            for r in records
        ]
        logging.debug(f"History retrieved: {len(history)} records")
        return jsonify(history)

@app.route('/clear_history', methods=['POST'])
def clear_history():
    with Session() as session:
        try:
            session.query(SpeedRecord).delete()
            session.commit()
            logging.info("History cleared successfully")
            return jsonify({"message": "Riwayat berhasil dihapus."})
        except SQLAlchemyError as e:
            session.rollback()
            logging.error(f"Error clearing history: {e}")
            return jsonify({"message": "Gagal menghapus riwayat."}), 500

@app.route('/export_csv')
def export_csv():
    with Session() as session:
        try:
            query = session.query(SpeedRecord).statement
            df = pd.read_sql(query, session.bind)
            csv_path = os.path.join(os.path.dirname(__file__), 'network_history.csv')
            df.to_csv(csv_path, index=False)
            logging.info("CSV exported successfully")
            return send_file(csv_path, as_attachment=True, download_name='network_history.csv')
        except Exception as e:
            logging.error(f"Error exporting CSV: {e}")
            return "Gagal membuat file CSV.", 500

if __name__ == '__main__':
    monitor_thread = threading.Thread(target=background_network_monitor, daemon=True)
    monitor_thread.start()
    app.run(debug=True, host='0.0.0.0', port=5000)