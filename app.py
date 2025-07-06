from flask import Flask, render_template, jsonify, request, send_file
from flask_wtf.csrf import CSRFProtect
import psutil
import time
import sqlite3
from datetime import datetime, timedelta
import pandas as pd
import os
import speedtest as speedtest_cli
import requests
import logging

app = Flask(__name__)
app.config['SECRET_KEY'] = 'your-secret-key'  # Replace with your secret key
csrf = CSRFProtect(app)
DB_NAME = 'network_data.db'

# Setup logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')

def init_db():
    """Initialize database tables if they don't exist."""
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
    c.execute('''
        CREATE TABLE IF NOT EXISTS speedtest_results (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            download REAL NOT NULL,
            upload REAL NOT NULL,
            ping REAL NOT NULL,
            server_name TEXT
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS settings (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            key TEXT NOT NULL UNIQUE,
            value TEXT NOT NULL
        )
    ''')
    c.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", ('low_speed_threshold', '2'))
    conn.commit()
    conn.close()

def get_network_speed():
    """Measure current download and upload speed."""
    net_io_start = psutil.net_io_counters()
    time.sleep(1)
    net_io_end = psutil.net_io_counters()
    bytes_sent = net_io_end.bytes_sent - net_io_start.bytes_sent
    bytes_recv = net_io_end.bytes_recv - net_io_start.bytes_recv
    upload_speed = (bytes_sent * 8) / (1024 * 1024)  # Mbps
    download_speed = (bytes_recv * 8) / (1024 * 1024)  # Mbps
    return {"upload": round(upload_speed, 2), "download": round(download_speed, 2), "timestamp": datetime.now().strftime("%H:%M:%S")}

def save_speed_to_db(download, upload):
    """Save network speed data to database and remove old data."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO speeds (timestamp, download, upload) VALUES (?, ?, ?)",
              (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), download, upload))
    c.execute("DELETE FROM speeds WHERE timestamp < ?",
              ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),))
    conn.commit()
    conn.close()
    logging.info(f"Saved network speed to database: download={download}, upload={upload}")

def save_speedtest_to_db(download, upload, ping, server_name):
    """Save speed test results to database."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT INTO speedtest_results (timestamp, download, upload, ping, server_name) VALUES (?, ?, ?, ?, ?)",
              (datetime.now().strftime("%Y-%m-%d %H:%M:%S"), download, upload, ping, server_name))
    conn.commit()
    conn.close()
    logging.info(f"Saved speedtest to database: download={download}, upload={upload}, ping={ping}, server={server_name}")

def get_low_speed_threshold():
    """Retrieve low speed threshold from database."""
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key = ?", ('low_speed_threshold',))
    result = c.fetchone()
    conn.close()
    return float(result[0]) if result else 2.0

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

@app.route('/get_my_ip')
def get_my_ip():
    """API to retrieve detailed geolocation information from public IP."""
    try:
        st = speedtest_cli.Speedtest()
        st.get_best_server()
        client_info = st.results.dict().get('client', {})
        ip_address = client_info.get('ip')
        if not ip_address:
            geo_response = requests.get('https://api.ipify.org?format=json')
            ip_address = geo_response.json().get('ip')
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
                'success': True,
                'ip_address': ip_address,
                'isp': client_info.get('isp', 'N/A'),
                'country': client_info.get('country', 'N/A'),
                'error': 'Failed to retrieve geolocation data.'
            })
    except Exception as e:
        logging.error(f"Get IP error: {e}")
        return jsonify({'success': False, 'error': f'Failed to retrieve IP information: {str(e)}'}), 500

@app.route('/get_speed')
def get_speed():
    speeds = get_network_speed()
    threshold = get_low_speed_threshold()
    speeds['threshold'] = threshold
    save_speed_to_db(speeds['download'], speeds['upload'])
    return jsonify(speeds)

@app.route('/run_speedtest', methods=['POST'])
@csrf.exempt
def run_speedtest():
    try:
        st = speedtest_cli.Speedtest()
        st.get_best_server()
        st.download(threads=None)
        st.upload(threads=None)
        results = st.results.dict()
        download_mbps = round(results['download'] / 1_000_000, 2)
        upload_mbps = round(results['upload'] / 1_000_000, 2)
        ping_ms = round(results['ping'], 2)
        server_name = results['server']['name']
        save_speedtest_to_db(download_mbps, upload_mbps, ping_ms, server_name)
        return jsonify({
            'success': True,
            'download': download_mbps,
            'upload': upload_mbps,
            'ping': ping_ms,
            'server_name': server_name
        })
    except Exception as e:
        logging.error(f"Speedtest error: {e}")
        return jsonify({'success': False, 'error': f'Failed to run speed test: {str(e)}'}), 500

@app.route('/get_history')
def get_history():
    time_range = request.args.get('time_range', 'all_data')
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    if time_range == '1hour':
        query_speeds = "SELECT timestamp, download, upload FROM speeds WHERE timestamp >= ? ORDER BY id DESC"
        query_speedtest = "SELECT timestamp, download, upload, ping, server_name FROM speedtest_results WHERE timestamp >= ? ORDER BY id DESC"
        c.execute(query_speeds, ((datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),))
        speeds = [{"timestamp": row[0], "download": row[1], "upload": row[2], "type": "network"} for row in c.fetchall()]
        c.execute(query_speedtest, ((datetime.now() - timedelta(hours=1)).strftime("%Y-%m-%d %H:%M:%S"),))
        speedtests = [{"timestamp": row[0], "download": row[1], "upload": row[2], "ping": row[3], "server_name": row[4], "type": "speedtest"} for row in c.fetchall()]
    elif time_range == 'today':
        query_speeds = "SELECT timestamp, download, upload FROM speeds WHERE date(timestamp) = date('now') ORDER BY id DESC"
        query_speedtest = "SELECT timestamp, download, upload, ping, server_name FROM speedtest_results WHERE date(timestamp) = date('now') ORDER BY id DESC"
        c.execute(query_speeds)
        speeds = [{"timestamp": row[0], "download": row[1], "upload": row[2], "type": "network"} for row in c.fetchall()]
        c.execute(query_speedtest)
        speedtests = [{"timestamp": row[0], "download": row[1], "upload": row[2], "ping": row[3], "server_name": row[4], "type": "speedtest"} for row in c.fetchall()]
    elif time_range == 'yesterday':
        query_speeds = "SELECT timestamp, download, upload FROM speeds WHERE date(timestamp) = date('now', '-1 day') ORDER BY id DESC"
        query_speedtest = "SELECT timestamp, download, upload, ping, server_name FROM speedtest_results WHERE date(timestamp) = date('now', '-1 day') ORDER BY id DESC"
        c.execute(query_speeds)
        speeds = [{"timestamp": row[0], "download": row[1], "upload": row[2], "type": "network"} for row in c.fetchall()]
        c.execute(query_speedtest)
        speedtests = [{"timestamp": row[0], "download": row[1], "upload": row[2], "ping": row[3], "server_name": row[4], "type": "speedtest"} for row in c.fetchall()]
    elif time_range == '7days':
        query_speeds = "SELECT timestamp, download, upload FROM speeds WHERE timestamp >= ? ORDER BY id DESC"
        query_speedtest = "SELECT timestamp, download, upload, ping, server_name FROM speedtest_results WHERE timestamp >= ? ORDER BY id DESC"
        c.execute(query_speeds, ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),))
        speeds = [{"timestamp": row[0], "download": row[1], "upload": row[2], "type": "network"} for row in c.fetchall()]
        c.execute(query_speedtest, ((datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d %H:%M:%S"),))
        speedtests = [{"timestamp": row[0], "download": row[1], "upload": row[2], "ping": row[3], "server_name": row[4], "type": "speedtest"} for row in c.fetchall()]
    else:  # all_data
        query_speeds = "SELECT timestamp, download, upload FROM speeds ORDER BY id DESC LIMIT 100"
        query_speedtest = "SELECT timestamp, download, upload, ping, server_name FROM speedtest_results ORDER BY id DESC LIMIT 100"
        c.execute(query_speeds)
        speeds = [{"timestamp": row[0], "download": row[1], "upload": row[2], "type": "network"} for row in c.fetchall()]
        c.execute(query_speedtest)
        speedtests = [{"timestamp": row[0], "download": row[1], "upload": row[2], "ping": row[3], "server_name": row[4], "type": "speedtest"} for row in c.fetchall()]
    history = speeds + speedtests
    logging.info(f"Retrieved history: {len(speeds)} network entries, {len(speedtests)} speedtest entries")
    conn.close()
    return jsonify(history)

@app.route('/clear_history', methods=['POST'])
@csrf.exempt
def clear_history():
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("DELETE FROM speeds")
    c.execute("DELETE FROM speedtest_results")
    conn.commit()
    conn.close()
    logging.info("Cleared all history data")
    return jsonify({"message": "History successfully cleared"})

@app.route('/set_threshold', methods=['POST'])
@csrf.exempt
def set_threshold():
    threshold = request.json.get('threshold', 2.0)
    conn = sqlite3.connect(DB_NAME)
    c = conn.cursor()
    c.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", ('low_speed_threshold', str(threshold)))
    conn.commit()
    conn.close()
    logging.info(f"Set low speed threshold to {threshold}")
    return jsonify({"message": "Low speed threshold updated"})

@app.route('/export_csv')
def export_csv():
    conn = sqlite3.connect(DB_NAME)
    df_speeds = pd.read_sql_query("SELECT timestamp, download, upload, 'network' as type FROM speeds", conn)
    df_speedtest = pd.read_sql_query("SELECT timestamp, download, upload, ping, server_name, 'speedtest' as type FROM speedtest_results", conn)
    df = pd.concat([df_speeds, df_speedtest])
    conn.close()
    csv_path = 'network_speeds_history.csv'
    df.to_csv(csv_path, index=False)
    logging.info(f"Exported history to CSV: {len(df)} records")
    return send_file(csv_path, as_attachment=True, download_name='network_history.csv')

if __name__ == '__main__':
    init_db()
    app.run(debug=True)