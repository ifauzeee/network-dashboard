# NetMon - Network Monitoring Dashboard

NetMon is a web-based application built with Flask and Chart.js to monitor network performance in real-time. It provides tools to check network speed, perform speed tests, retrieve public IP and geolocation information, view historical network data, and configure settings such as low-speed thresholds.

## Features

- **Real-time Network Monitoring**: Displays current download and upload speeds using `psutil`.
- **Speed Test**: Performs internet speed tests using `speedtest-cli`, showing download, upload, ping, and server information.
- **IP Geolocation**: Retrieves public IP address and geolocation details (ISP, city, country, etc.) with a map visualization using Leaflet.
- **History Tracking**: Stores and displays network and speed test data in a SQLite database, with filtering options (1 hour, today, yesterday, last 7 days, all data).
- **Customizable Settings**: Allows users to set a low-speed threshold for notifications and toggle between light and dark themes.
- **Data Export**: Exports network history to CSV for analysis.
- **Responsive Design**: Modern, user-friendly interface with a clean design, optimized for both desktop and mobile devices.

## Installation

### Prerequisites

- Python 3.8 or higher
- Git
- A modern web browser (Chrome, Firefox, etc.)

### Setup Instructions

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ifauzeee/network-dashboard.git
   cd network-dashboard
   ```

2. **Create a Virtual Environment (optional but recommended)**:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install Dependencies**: Ensure you have the required Python packages by installing from `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```

   The dependencies include:
   - Flask: Web framework
   - Flask-WTF: CSRF protection for forms
   - psutil: Network usage monitoring
   - pandas: Data handling for CSV export
   - speedtest-cli: Internet speed testing
   - requests: HTTP requests for IP geolocation
   - gunicorn: WSGI server for production (optional)

4. **Initialize the Database**: The application uses a SQLite database (`network_data.db`) to store network and speed test data. The database is automatically initialized when you run the application for the first time.

5. **Run the Application**: Start the Flask development server:
   ```bash
   python app.py
   ```

   The application will be available at [http://127.0.0.1:5000](http://127.0.0.1:5000).

6. **Access the Application**: Open your browser and navigate to [http://127.0.0.1:5000](http://127.0.0.1:5000) to use NetMon.

## Directory Structure

```
network_dashboard/
├── app.py                    # Main Flask application
├── requirements.txt          # Python dependencies
├── network_data.db           # SQLite database (auto-generated)
├── static/
│   ├── app.js                # Frontend JavaScript logic
│   ├── style.css             # CSS for styling
│   ├── images/
│   │   └── logo.png          # Application logo
├── templates/
│   ├── layout.html           # Base HTML template
│   ├── dashboard.html        # Dashboard page
│   ├── speedtest.html        # Speed test page
│   ├── myip.html             # IP geolocation page
│   ├── history.html          # Network history page
│   ├── settings.html         # Settings page
├── .gitignore                # Git ignore file
├── README.md                 # This file
```

## Usage

- **Dashboard**: View real-time download and upload speeds, average speeds, and a historical graph. Filter data by time range (All Data, Last 1 Hour, Today, Yesterday, Last 7 Days).
- **Speed Test**: Run an internet speed test to measure download, upload, and ping. Results are displayed with a dynamic gauge and saved to the database.
- **Cek IP Saya**: Retrieve your public IP address and geolocation details, including a map showing your approximate location.
- **History**: View a table of all network and speed test data, filterable by time range. Export data to CSV or clear the history.
- **Settings**: Configure the low-speed threshold for notifications, toggle the theme (light/dark), and manage data.

## Development

### Technologies Used

- **Backend**: Flask, SQLite, speedtest-cli, psutil, pandas, requests
- **Frontend**: HTML, CSS, JavaScript, Chart.js, Leaflet
- **Styling**: Poppins font, Font Awesome icons, custom CSS with light/dark mode support
- **Dependencies**: Managed via `requirements.txt`

### Running in Production

For production deployment, use a WSGI server like gunicorn:
```bash
gunicorn -w 4 -b 0.0.0.0:8000 app:app
```

Consider using a reverse proxy (e.g., Nginx) and securing the application with HTTPS.

## Troubleshooting

- **Speed Test Errors**: Ensure `speedtest-cli` is installed (`pip install speedtest-cli`). Check your internet connection if tests fail.
- **IP Geolocation Issues**: The application uses `ip-api.com` for geolocation. If it fails, ensure your network allows external API requests.
- **Database Issues**: If `network_data.db` becomes corrupted, delete it and restart the application to reinitialize it.
- **Browser Cache**: Clear your browser cache if the UI does not update after code changes.

## Contributing

Contributions are welcome! Please fork the repository, make your changes, and submit a pull request. Ensure your code follows the project's style and includes appropriate tests.

## License

This project is licensed under the MIT License. See the LICENSE file for details.

## Author

**Muhammad Ibnu Fauzi**  
GitHub: [ifauzeee](https://github.com/ifauzeee)  
Portfolio: [ifauzeee.github.io](https://ifauzeee.github.io)

© 2025 Muhammad Ibnu Fauzi. All rights reserved.
