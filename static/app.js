// File: static/app.js

document.addEventListener('DOMContentLoaded', function () {
    // DOM elements and variables for state management
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.menu-item');
    const darkModeButton = document.getElementById('toggleDarkMode');
    
    // (NEW) Variables for the hamburger menu
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.getElementById('hamburger-menu');

    let liveUpdateInterval; // Interval for the dashboard's live speed updates
    let networkChart = null; // Chart.js instance for network speed
    let avgChart = null; // Chart.js instance for average speed
    let ipMap = null; // Leaflet map instance for the IP page

    // (NEW) Event Listener for Hamburger Menu
    if (hamburgerBtn && sidebar) {
        // Logic to open/close the sidebar
        hamburgerBtn.addEventListener('click', () => {
            sidebar.classList.toggle('open');
        });

        // Logic to close the sidebar when a menu item is clicked on mobile
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768) {
                    sidebar.classList.remove('open');
                }
            });
        });
    }

    /**
     * Loads a new page dynamically into the main content area.
     * @param {string} page The name of the page to load (e.g., 'dashboard', 'speedtest').
     */
    function loadPage(page = 'dashboard') {
        // Clear any existing live update intervals or map instances to prevent memory leaks
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        if (ipMap) {
            ipMap.remove();
            ipMap = null;
        }

        // Fetch the HTML content for the requested page
        fetch(`/page/${page}`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load page ${page}: ${response.statusText}`);
                return response.text();
            })
            .then(html => {
                mainContent.innerHTML = html;
                // Initialize the corresponding page function
                if (page === 'dashboard') initDashboard();
                else if (page === 'speedtest') initSpeedTestPage();
                else if (page === 'myip') initMyIpPage();
                else if (page === 'history') initHistoryPage();
                else if (page === 'settings') initSettingsPage();
            })
            .catch(err => mainContent.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`);
    }

    // Add click event listeners to menu items for navigation
    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadPage(item.getAttribute('data-page'));
        });
    });


    /**
     * Initializes the dashboard page, including charts and live updates.
     */
    function initDashboard() {
        const timeRangeSelect = document.getElementById('time_range');
        if (timeRangeSelect) {
            timeRangeSelect.addEventListener('change', updateAveragesAndHistory);
        }
        const lineCtx = document.getElementById('networkChart')?.getContext('2d');
        const barCtx = document.getElementById('avgChart')?.getContext('2d');
        if (lineCtx && barCtx) {
            networkChart = new Chart(lineCtx, createChartConfig('line'));
            avgChart = new Chart(barCtx, createChartConfig('bar'));
            updateAveragesAndHistory();
            // Live updates are now managed within updateAveragesAndHistory based on the time range.
        }
    }

    /**
     * Initializes the speed test page. This is the function with the polling logic.
     */
    function initSpeedTestPage() {
        const startBtn = document.getElementById('startTestBtn');
        const statusText = document.getElementById('statusText');
        const resultsPanel = document.getElementById('resultsPanel');
        const serverInfo = document.getElementById('serverInfo');
        const canvas = document.getElementById('speedometer');
        const ctx = canvas?.getContext('2d');
        
        let pollingInterval; // Interval for polling the speed test status
        let animationFrameId; // Frame ID for the speedometer animation loop
        let currentSpeed = 0; // Current displayed speed
        let targetSpeed = 0; // Target speed for animation smoothing

        /**
         * Draws the speedometer gauge on the canvas.
         * @param {number} speed The speed value to display.
         */
        function drawGauge(speed = 0) {
            if (!ctx) return;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 140;
            const maxSpeed = 100;
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Draw the grey background arc
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
            ctx.lineWidth = 20;
            ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#333' : '#e0e0e0';
            ctx.stroke();

            // Draw the colored speed arc if speed is greater than 0
            if (speed > 0) {
                const speedAngle = (Math.min(speed, maxSpeed) / maxSpeed) * 1.5 * Math.PI;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.75 * Math.PI + speedAngle);
                ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#3f9eff' : '#007bff';
                ctx.stroke();
            }

            // Draw the speed text and unit
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333';
            ctx.font = 'bold 48px Poppins';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(speed.toFixed(1), centerX, centerY - 15);
            ctx.font = '16px Poppins';
            ctx.fillText('Mbps', centerX, centerY + 20);
        }

        /**
         * The animation loop for the speedometer.
         */
        function animate() {
            currentSpeed += (targetSpeed - currentSpeed) * 0.1;
            drawGauge(currentSpeed);
            animationFrameId = requestAnimationFrame(animate);
        }

        drawGauge();

        /**
         * Polls the server for the current status of the speed test.
         */
        function pollStatus() {
            fetch('/speedtest_status')
                .then(response => response.json())
                .then(state => {
                    if (state.status === 'running') {
                        statusText.textContent = 'Tes sedang berjalan...';
                        // Use the real-time speed from the server to update the gauge
                        if (state.data && state.data.download) {
                             targetSpeed = state.data.download;
                        }
                    } else if (state.status === 'complete') {
                        // Test is complete, stop polling and animation
                        clearInterval(pollingInterval);
                        cancelAnimationFrame(animationFrameId);
                        
                        const data = state.data;
                        document.getElementById('pingResult').textContent = data.ping;
                        document.getElementById('downloadResult').textContent = data.download;
                        document.getElementById('uploadResult').textContent = data.upload;
                        document.getElementById('serverResult').textContent = data.server_name;
                        
                        statusText.textContent = 'Tes Selesai!';
                        drawGauge(data.download); // Display the final download speed
                        resultsPanel.style.display = 'grid';
                        serverInfo.style.display = 'block';
                        startBtn.disabled = false;
                        startBtn.querySelector('i').className = 'fas fa-play';
                    } else if (state.status === 'error') {
                        // An error occurred, stop polling and animation
                        clearInterval(pollingInterval);
                        cancelAnimationFrame(animationFrameId);
                        statusText.textContent = `Error: ${state.error}`;
                        drawGauge(0);
                        startBtn.disabled = false;
                        startBtn.querySelector('i').className = 'fas fa-play';
                    }
                })
                .catch(err => {
                    clearInterval(pollingInterval);
                    cancelAnimationFrame(animationFrameId);
                    console.error('Polling error:', err);
                    statusText.textContent = 'Gagal menghubungi server untuk status tes.';
                    drawGauge(0);
                    startBtn.disabled = false;
                    startBtn.querySelector('i').className = 'fas fa-play';
                });
        }

        // Add event listener to the "Start Test" button
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                // Clear any previous polling interval
                if (pollingInterval) clearInterval(pollingInterval);

                // Reset UI elements
                startBtn.disabled = true;
                startBtn.querySelector('i').className = 'fas fa-spinner fa-spin';
                statusText.textContent = 'Memulai tes kecepatan...';
                resultsPanel.style.display = 'none';
                serverInfo.style.display = 'none';
                targetSpeed = 0;
                animate();

                // Start the speed test on the backend
                fetch('/run_speedtest', { method: 'POST' })
                    .then(response => {
                        if (!response.ok) {
                            if (response.status === 409) {
                                throw new Error('Tes lain sedang berjalan.');
                            }
                            throw new Error('Gagal memulai tes.');
                        }
                        return response.json();
                    })
                    .then(data => {
                        if (data.success) {
                            // Start polling for status if the test successfully started
                            pollingInterval = setInterval(pollStatus, 2000);
                        } else {
                            throw new Error(data.message || 'Gagal memulai tes dari server.');
                        }
                    })
                    .catch(err => {
                        statusText.textContent = err.message;
                        startBtn.disabled = false;
                        startBtn.querySelector('i').className = 'fas fa-play';
                        cancelAnimationFrame(animationFrameId);
                        drawGauge(0);
                    });
            });
        }
    }


    /**
     * Initializes the My IP page, fetching and displaying IP information and a map.
     */
    function initMyIpPage() {
        const ipAddressEl = document.getElementById('ipAddress');
        const ispInfoEl = document.getElementById('ispInfo');
        const orgInfoEl = document.getElementById('orgInfo');
        const locationInfoEl = document.getElementById('locationInfo');
        const countryInfoEl = document.getElementById('countryInfo');
        const timezoneInfoEl = document.getElementById('timezoneInfo');
        const copyBtn = document.getElementById('copyIpBtn');
        fetch('/get_my_ip')
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch IP info: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                if (data.success) {
                    ipAddressEl.textContent = data.ip_address || 'Gagal Memuat';
                    ispInfoEl.textContent = data.isp || 'N/A';
                    orgInfoEl.textContent = data.organization || 'N/A';
                    locationInfoEl.textContent = `${data.city || ''}, ${data.region || ''}`.replace(/^, |^ | $/g, '') || 'N/A';
                    countryInfoEl.textContent = data.country || 'N/A';
                    timezoneInfoEl.textContent = data.timezone || 'N/A';
                    if (data.latitude && data.longitude) {
                        document.querySelector('#ipMap .loader-container').style.display = 'none';
                        ipMap = L.map('ipMap').setView([data.latitude, data.longitude], 10);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        }).addTo(ipMap);
                        L.marker([data.latitude, data.longitude]).addTo(ipMap)
                            .bindPopup(`<b>Perkiraan Lokasi IP Anda</b><br>${data.city || ''}`).openPopup();
                    } else {
                        document.querySelector('#ipMap .loader-container p').textContent = 'Data Peta Tidak Tersedia';
                    }
                } else {
                    document.querySelector('#ipMap').innerHTML = '<div class="loader-container"><p>Gagal memuat data.</p></div>';
                    [ipAddressEl, ispInfoEl, orgInfoEl, locationInfoEl, countryInfoEl, timezoneInfoEl]
                        .forEach(el => el.textContent = 'Gagal Memuat');
                }
            });
        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const ip = ipAddressEl.textContent;
                if (ip && !ip.includes('...')) {
                    // Use document.execCommand for clipboard copy
                    const tempInput = document.createElement('input');
                    tempInput.value = ip;
                    document.body.appendChild(tempInput);
                    tempInput.select();
                    document.execCommand('copy');
                    document.body.removeChild(tempInput);

                    const icon = copyBtn.querySelector('i');
                    icon.className = 'fas fa-check';
                    setTimeout(() => { icon.className = 'fas fa-copy'; }, 1500);
                }
            });
        }
    }

    /**
     * Initializes the history page.
     */
    function initHistoryPage() {
        const tableBody = document.querySelector('#history-table tbody');
        const typeFilter = document.getElementById('type_filter');

        function loadHistory() {
            const recordType = typeFilter.value;
            fetch(`/get_history?time_range=all_data&type=${recordType}`)
                .then(response => {
                    if (!response.ok) throw new Error(`Failed to fetch history: ${response.statusText}`);
                    return response.json();
                })
                .then(data => {
                    tableBody.innerHTML = '';
                    if (data.length === 0) {
                        tableBody.innerHTML = '<tr><td colspan="4">No history data available.</td></tr>';
                        return;
                    }
                    data.forEach(item => {
                        const row = document.createElement('tr');
                        row.innerHTML = `<td>${item.timestamp}</td><td>${item.download.toFixed(2)}</td><td>${item.upload.toFixed(2)}</td><td>${item.type}</td>`;
                        tableBody.appendChild(row);
                    });
                });
        }

        typeFilter.addEventListener('change', loadHistory);
        loadHistory();
    }

    /**
     * Initializes the settings page.
     */
    function initSettingsPage() {
        const themeButton = document.getElementById('theme-switcher-button');
        if (themeButton) themeButton.addEventListener('click', toggleDarkMode);
        
        const clearHistoryBtn = document.getElementById('clearHistoryBtn');
        if (clearHistoryBtn) clearHistoryBtn.addEventListener('click', () => showConfirm('Are you sure you want to delete all network history?', clearHistory));
    }

    /**
     * Fetches and displays live network speed data.
     */
    function liveUpdate() {
        fetch('/get_speed')
            .then(response => {
                if (!response.ok) throw new Error('Network response was not ok');
                return response.json();
            })
            .then(data => {
                const downloadSpan = document.getElementById('download_speed');
                const uploadSpan = document.getElementById('upload_speed');
                if (downloadSpan && uploadSpan) {
                    downloadSpan.textContent = data.download > 0 ? data.download.toFixed(2) : 'N/A';
                    uploadSpan.textContent = data.upload > 0 ? data.upload.toFixed(2) : 'N/A';
                }
                if (networkChart) {
                    const now = new Date();
                    const timeLabel = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`;
                    networkChart.data.labels.push(timeLabel);
                    networkChart.data.datasets[0].data.push(data.download || 0);
                    networkChart.data.datasets[1].data.push(data.upload || 0);
                    if (networkChart.data.labels.length > 20) {
                        networkChart.data.labels.shift();
                        networkChart.data.datasets.forEach(dataset => dataset.data.shift());
                    }
                    networkChart.update('none');
                }
            })
            .catch(err => {
                console.error('Live update error:', err);
                const downloadSpan = document.getElementById('download_speed');
                const uploadSpan = document.getElementById('upload_speed');
                if (downloadSpan) downloadSpan.textContent = 'N/A';
                if (uploadSpan) uploadSpan.textContent = 'N/A';
            });
    }

    /**
     * Fetches history data and updates the average speed charts.
     */
    function updateAveragesAndHistory() {
        const timeRange = document.getElementById('time_range')?.value || 'all';

        // Stop live updates when changing the time range
        if (liveUpdateInterval) {
            clearInterval(liveUpdateInterval);
            liveUpdateInterval = null;
        }

        fetch(`/get_history?time_range=${timeRange}`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to fetch history: ${response.statusText}`);
                return response.json();
            })
            .then(history => {
                if (networkChart && history.length > 0) {
                    networkChart.data.labels = history.map(item => item.timestamp.split(' ')[1]).reverse();
                    networkChart.data.datasets[0].data = history.map(item => item.download || 0).reverse();
                    networkChart.data.datasets[1].data = history.map(item => item.upload || 0).reverse();
                    networkChart.update();
                }
                const avgDownload = history.length ? history.reduce((sum, item) => sum + (item.download || 0), 0) / history.length : 0;
                const avgUpload = history.length ? history.reduce((sum, item) => sum + (item.upload || 0), 0) / history.length : 0;
                const avgDownloadSpan = document.getElementById('avg_download_speed');
                const avgUploadSpan = document.getElementById('avg_upload_speed');
                if (avgDownloadSpan) avgDownloadSpan.textContent = avgDownload.toFixed(2);
                if (avgUploadSpan) avgUploadSpan.textContent = avgUpload.toFixed(2);
                if (avgChart && history.length > 0) {
                    avgChart.data.datasets[0].data = [avgDownload.toFixed(2), avgUpload.toFixed(2)];
                    avgChart.update();
                }

                // Restart live updates only if the 'all' time range is selected
                if (timeRange === 'all') {
                    liveUpdateInterval = setInterval(liveUpdate, 5000);
                }
            })
            .catch(err => console.error('History update error:', err));
    }

    /**
     * Toggles the dark mode class on the body and saves the preference to local storage.
     */
    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        // Update chart colors on theme change
        if (networkChart) {
            const isDarkMode = document.body.classList.contains('dark-mode');
            const textColor = isDarkMode ? '#e0e0e0' : '#333';
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            networkChart.options.scales.y.ticks.color = textColor;
            networkChart.options.scales.x.ticks.color = textColor;
            networkChart.options.scales.y.title.color = textColor;
            networkChart.options.scales.x.title.color = textColor;
            networkChart.options.scales.y.grid.color = gridColor;
            networkChart.options.scales.x.grid.color = gridColor;
            networkChart.options.plugins.legend.labels.color = textColor;
            networkChart.update();
        }
        if (avgChart) {
             const isDarkMode = document.body.classList.contains('dark-mode');
            const textColor = isDarkMode ? '#e0e0e0' : '#333';
            const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
            avgChart.options.scales.y.ticks.color = textColor;
            avgChart.options.scales.y.title.color = textColor;
            avgChart.options.scales.y.grid.color = gridColor;
            avgChart.options.plugins.legend.labels.color = textColor;
            avgChart.update();
        }
    }
    
    /**
     * Shows a custom confirmation message.
     * @param {string} message The message to display.
     * @param {function} onConfirm The callback function to run if the user confirms.
     */
    function showConfirm(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>${message}</p>
                <div class="modal-buttons">
                    <button id="confirm-yes">Yes</button>
                    <button id="confirm-no">No</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        document.getElementById('confirm-yes').addEventListener('click', () => {
            onConfirm();
            document.body.removeChild(modal);
        });

        document.getElementById('confirm-no').addEventListener('click', () => {
            document.body.removeChild(modal);
        });
    }

    // Initialize the dark mode button
    darkModeButton.addEventListener('click', toggleDarkMode);
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');

    // Load the default page on application start
    loadPage('dashboard');
});

/**
 * Initiates a CSV export by navigating to the export endpoint.
 */
function exportCsv() { window.location.href = '/export_csv'; }

/**
 * Clears the network history via an API call.
 */
function clearHistory() {
    fetch('/clear_history', { method: 'POST' })
        .then(response => {
            if (!response.ok) throw new Error(`Failed to clear history: ${response.statusText}`);
            return response.json();
        })
        .then(data => {
            // Show a success message
            const messageBox = document.createElement('div');
            messageBox.className = 'message-box';
            messageBox.textContent = data.message;
            document.body.appendChild(messageBox);
            setTimeout(() => document.body.removeChild(messageBox), 2000);

            // Reload the active page to reflect the cleared history
            const activePage = document.querySelector('.menu-item.active');
            if (activePage) activePage.click();
        })
        .catch(err => {
            console.error('Failed to clear history:', err);
            const messageBox = document.createElement('div');
            messageBox.className = 'message-box error';
            messageBox.textContent = `Error: ${err.message}`;
            document.body.appendChild(messageBox);
            setTimeout(() => document.body.removeChild(messageBox), 3000);
        });
}

/**
 * Creates the configuration object for a Chart.js chart.
 * @param {string} type The chart type ('line' or 'bar').
 * @returns {object} The Chart.js configuration object.
 */
function createChartConfig(type) {
    const isDarkMode = document.body.classList.contains('dark-mode');
    const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDarkMode ? '#e0e0e0' : '#333';
    const baseOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Speed (Mbps)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
            x: { title: { display: true, text: 'Time', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
        }
    };
    if (type === 'line') return { type: 'line', data: { labels: [], datasets: [ { label: 'Download (Mbps)', data: [], borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: true, tension: 0.3 }, { label: 'Upload (Mbps)', data: [], borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: true, tension: 0.3 } ] }, options: baseOptions };
    if (type === 'bar') return { type: 'bar', data: { labels: ['Avg. Download', 'Avg. Upload'], datasets: [{ label: 'Average Speed (Mbps)', data: [0, 0], backgroundColor: ['#007bff', '#28a745'], borderColor: ['#0056b3', '#1e7e34'], borderWidth: 1 }] }, options: { ...baseOptions, scales: { ...baseOptions.scales, x: { ...baseOptions.scales.x, title: { display: false } } } } };
}
