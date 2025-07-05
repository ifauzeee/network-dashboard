from flask import Flask, render_template, jsonify, request, send_file
import psutil
import time
import sqlite3
from datetime import datetime, timedelta
import pandas as pd
import os
import speedtest
import requests

app = Flask(__name__)
DB_NAME = 'network_data.db'

def init_db():
    """Membuat tabel database jika belum ada."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS speeds (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            download REAL NOT NULL,
            upload REAL NOT NULL
        )
    ''')
    conn.commit()
    conn.close()

def get_network_speed():
    """Mengukur kecepatan unduh dan unggah saat ini."""
    net_io_start = psutil.net_io_counters()
    time.sleep(1)
    net_io_end = psutil.net_io_counters()

    bytes_sent = net_io_end.bytes_sent - net_io_start.bytes_sent
    bytes_recv = net_io_end.bytes_recv - net_io_start.bytes_recv

    upload_speed = (bytes_sent * 8) / (1024 * 1024)  # Mbps
    download_speed = (bytes_recv * 8) / (1024 * 1024)  # Mbps

    return {"upload": round(upload_speed, 2), "download": round(download_speed, 2)}

def save_speed_to_db(download, upload):
    """Menyimpan data kecepatan ke database."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO speeds (timestamp, download, upload) VALUES (?, ?, ?)",
              (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), download, upload))
    conn.commit()
    conn.close()

# --- Routes ---
@app.route('/')
def index():
    return render_template('layout.html')

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

# --- API Endpoints ---
@app.route('/get_my_ip')
def get_my_ip():
    """API untuk mendapatkan informasi geolokasi detail dari IP publik."""
    try:
        st = speedtest.Speedtest()
        st.get_best_server()
        client_info = st.results.dict().get('client', {})
        ip_address = client_info.get('ip')

        if not ip_address:
            raise Exception("Tidak dapat mengambil alamat IP.")

        geo_response = requests.get(f'http://ip-api.com/json/{ip_address}')
        geo_data = geo_response.json()

        if geo_data.get('status') == 'success':
            return jsonify({
                'success': True,
                'ip_address': ip_address,
                'isp': geo_data.get('isp', 'N/A'),
                'organization': geo_data.get('org', 'N/A'),
                'city': geo_data.get('city', 'N/A'),
                'region': geo_data.get('regionName', 'N/A'),
                'country': geo_data.get('country', 'N/A'),
                'latitude': geo_data.get('lat'),
                'longitude': geo_data.get('lon'),
                'timezone': geo_data.get('timezone', 'N/A')
            })
        else:
            return jsonify({
                'success': True, 'ip_address': ip_address, 'isp': client_info.get('isp', 'N/A'),
                'country': client_info.get('country', 'N/A'), 'error': 'Gagal mengambil data geolokasi.'
            })
            
    except Exception as e:
        print(f"Get IP error: {e}")
        return jsonify({'success': False, 'error': 'Gagal mengambil informasi IP.'}), 500

@app.route('/get_speed')
def get_speed():
    speeds = get_network_speed()
    save_speed_to_db(speeds['download'], speeds['upload'])
    return jsonify(speeds)

@app.route('/run_speedtest', methods=['POST'])
def run_speedtest():
    try:
        st = speedtest.Speedtest()
        st.get_best_server()
        st.download(threads=None)
        st.upload(threads=None)
        results = st.results.dict()

        download_mbps = round(results['download'] / 1_000_000, 2)
        upload_mbps = round(results['upload'] / 1_000_000, 2)
        ping_ms = round(results['ping'], 2)
        
        return jsonify({
            'success': True,
            'download': download_mbps,
            'upload': upload_mbps,
            'ping': ping_ms,
            'server_name': results['server']['name']
        })
    except Exception as e:
        print(f"Speedtest error: {e}")
        return jsonify({'success': False, 'error': 'Gagal menjalankan speed test.'}), 500

@app.route('/get_history')
def get_history():
    time_range = request.args.get('time_range', 'all')
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if time_range == '1hour':
        one_hour_ago = datetime.now() - timedelta(hours=1)
        query = "SELECT timestamp, download, upload FROM speeds WHERE timestamp >= ? ORDER BY id DESC"
        c.execute(query, (one_hour_ago.strftime("%Y-%m-%d %H:%M:%S"),))
    elif time_range == 'all_data':
        query = "SELECT timestamp, download, upload FROM speeds ORDER BY id DESC"
        c.execute(query)
    else:
        query = "SELECT timestamp, download, upload FROM speeds ORDER BY id DESC LIMIT 10"
        c.execute(query)
    history = [{"timestamp": row[0], "download": row[1], "upload": row[2]} for row in c.fetchall()]
    conn.close()
    return jsonify(history)

@app.route('/clear_history', methods=['POST'])
def clear_history():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM speeds")
    conn.commit()
    conn.close()
    return jsonify({"message": "Riwayat berhasil dihapus"})

@app.route('/export_csv')
def export_csv():
    conn = sqlite3.connect(DB_NAME)
    df = pd.read_sql_query("SELECT * FROM speeds", conn)
    conn.close()
    csv_path = 'network_speeds_history.csv'
    df.to_csv(csv_path, index=False)
    return send_file(csv_path, as_attachment=True, download_name='network_history.csv')

if __name__ == '__main__':
    init_db()
    app.run(debug=True)