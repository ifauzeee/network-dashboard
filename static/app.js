document.addEventListener('DOMContentLoaded', function () {
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.menu-item');
    const darkModeButton = document.getElementById('toggleDarkMode');
    let liveUpdateInterval;
    let networkChart = null;
    let avgChart = null;
    let ipMap = null;

    function loadPage(page = 'dashboard') {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        if (ipMap) {
            ipMap.remove();
            ipMap = null;
        }
        fetch(`/page/${page}`)
            .then(response => {
                if (!response.ok) throw new Error(`Failed to load page ${page}: ${response.statusText}`);
                return response.text();
            })
            .then(html => {
                mainContent.innerHTML = html;
                if (page === 'dashboard') initDashboard();
                else if (page === 'speedtest') initSpeedTestPage();
                else if (page === 'myip') initMyIpPage();
                else if (page === 'history') initHistoryPage();
                else if (page === 'settings') initSettingsPage();
            })
            .catch(err => mainContent.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`);
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            loadPage(item.getAttribute('data-page'));
        });
    });

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
            liveUpdateInterval = setInterval(liveUpdate, 5000); // Diubah ke 5000ms untuk stabilitas
        }
    }

    function initSpeedTestPage() {
        const startBtn = document.getElementById('startTestBtn');
        const statusText = document.getElementById('statusText');
        const resultsPanel = document.getElementById('resultsPanel');
        const serverInfo = document.getElementById('serverInfo');
        const canvas = document.getElementById('speedometer');
        const ctx = canvas?.getContext('2d');
        let animationFrameId;
        let currentSpeed = 0;
        let targetSpeed = 0;

        function drawGauge(speed = 0) {
            if (!ctx) return;
            const centerX = canvas.width / 2;
            const centerY = canvas.height / 2;
            const radius = 140;
            const maxSpeed = 100;
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
            ctx.lineWidth = 20;
            ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#333' : '#e0e0e0';
            ctx.stroke();
            if (speed > 0) {
                const speedAngle = (Math.min(speed, maxSpeed) / maxSpeed) * 1.5 * Math.PI;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.75 * Math.PI + speedAngle);
                ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#3f9eff' : '#007bff';
                ctx.stroke();
            }
            ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333';
            ctx.font = 'bold 48px Poppins';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(speed.toFixed(1), centerX, centerY - 15);
            ctx.font = '16px Poppins';
            ctx.fillText('Mbps', centerX, centerY + 20);
        }

        function animate() {
            currentSpeed += (targetSpeed - currentSpeed) * 0.1;
            drawGauge(currentSpeed);
            animationFrameId = requestAnimationFrame(animate);
        }

        drawGauge();

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                const icon = startBtn.querySelector('i');
                const pingSpan = document.getElementById('pingResult');
                const downloadSpan = document.getElementById('downloadResult');
                const uploadSpan = document.getElementById('uploadResult');
                const serverSpan = document.getElementById('serverResult');
                startBtn.disabled = true;
                icon.className = 'fas fa-spinner fa-spin';
                statusText.textContent = 'Mencari server terbaik...';
                resultsPanel.style.display = 'none';
                serverInfo.style.display = 'none';
                targetSpeed = Math.random() * 5 + 5;
                animate();
                fetch('/run_speedtest', { method: 'POST' })
                    .then(response => {
                        if (!response.ok) throw new Error('Failed to run speed test');
                        return response.json();
                    })
                    .then(data => {
                        cancelAnimationFrame(animationFrameId);
                        if (data.success) {
                            drawGauge(data.download);
                            pingSpan.textContent = data.ping;
                            downloadSpan.textContent = data.download;
                            uploadSpan.textContent = data.upload;
                            serverSpan.textContent = data.server_name;
                            statusText.textContent = 'Tes Selesai!';
                            resultsPanel.style.display = 'grid';
                            serverInfo.style.display = 'block';
                        } else {
                            statusText.textContent = `Error: ${data.error}`;
                            drawGauge(0);
                        }
                    })
                    .catch(err => {
                        console.error('Fetch error:', err);
                        statusText.textContent = 'Gagal menghubungi server untuk speed test.';
                        cancelAnimationFrame(animationFrameId);
                        drawGauge(0);
                    })
                    .finally(() => {
                        startBtn.disabled = false;
                        icon.className = 'fas fa-play';
                    });
            });
        }
    }

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
                    navigator.clipboard.writeText(ip).then(() => {
                        const icon = copyBtn.querySelector('i');
                        icon.className = 'fas fa-check';
                        setTimeout(() => { icon.className = 'fas fa-copy'; }, 1500);
                    });
                }
            });
        }
    }

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
        loadHistory(); // Panggil fungsi saat halaman dimuat
    }

    function initSettingsPage() {
        const themeButton = document.getElementById('theme-switcher-button');
        if (themeButton) themeButton.addEventListener('click', toggleDarkMode);
    }

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

    function updateAveragesAndHistory() {
        const timeRange = document.getElementById('time_range')?.value || 'all';
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
            })
            .catch(err => console.error('History update error:', err));
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
    }

    darkModeButton.addEventListener('click', toggleDarkMode);
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    loadPage('dashboard');
});

function exportCsv() { window.location.href = '/export_csv'; }

function clearHistory() {
    if (confirm('Are you sure you want to delete all network history?')) {
        fetch('/clear_history', { method: 'POST' })
            .then(response => {
                if (!response.ok) throw new Error(`Failed to clear history: ${response.statusText}`);
                return response.json();
            })
            .then(data => {
                alert(data.message);
                const activePage = document.querySelector('.menu-item.active');
                if (activePage) activePage.click();
            });
    }
}

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
