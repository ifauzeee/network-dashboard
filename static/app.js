document.addEventListener('DOMContentLoaded', function () {
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.menu-item');
    const darkModeButton = document.getElementById('toggleDarkMode');
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.getElementById('hamburger-menu');

    let liveUpdateInterval;
    let networkChart = null;
    let avgChart = null;
    let ipMap = null;

    if (hamburgerBtn && sidebar) {
        const contentWrapper = document.querySelector('.content-wrapper');
        hamburgerBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            sidebar.classList.toggle('open');
        });
        menuItems.forEach(item => {
            item.addEventListener('click', () => {
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            });
        });
        if (contentWrapper) {
            contentWrapper.addEventListener('click', () => {
                if (window.innerWidth <= 768 && sidebar.classList.contains('open')) {
                    sidebar.classList.remove('open');
                }
            });
        }
    }

    function loadPage(page = 'dashboard') {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        if (ipMap) { ipMap.remove(); ipMap = null; }

        fetch(`/page/${page}`)
            .then(response => response.ok ? response.text() : Promise.reject(`Failed to load page ${page}: ${response.statusText}`))
            .then(html => {
                mainContent.innerHTML = html;
                const pageInitializers = {
                    dashboard: initDashboard,
                    speedtest: initSpeedTestPage,
                    myip: initMyIpPage,
                    history: initHistoryPage,
                    settings: initSettingsPage,
                };
                pageInitializers[page]?.();
            })
            .catch(err => mainContent.innerHTML = `<p style="color: red;">Error: ${err.message}</p>`);
    }

    menuItems.forEach(item => {
        item.addEventListener('click', () => {
            menuItems.forEach(i => i.classList.remove('active'));
            item.classList.add('active');
            const page = item.getAttribute('data-page');
            loadPage(page);
            localStorage.setItem('lastActivePage', page);
        });
    });

    function initDashboard() {
        document.getElementById('time_range')?.addEventListener('change', updateAveragesAndHistory);
        const lineCtx = document.getElementById('networkChart')?.getContext('2d');
        const barCtx = document.getElementById('avgChart')?.getContext('2d');
        if (lineCtx && barCtx) {
            networkChart = new Chart(lineCtx, createChartConfig('line'));
            avgChart = new Chart(barCtx, createChartConfig('bar'));
            updateAveragesAndHistory();
        }
    }

    function initSpeedTestPage() {
        const startBtn = document.getElementById('startTestBtn');
        const statusText = document.getElementById('statusText');
        const resultsPanel = document.getElementById('resultsPanel');
        const serverInfo = document.getElementById('serverInfo');
        const canvas = document.getElementById('speedometer');
        const ctx = canvas?.getContext('2d');
        let pollingInterval, animationFrameId, currentSpeed = 0, targetSpeed = 0;

        function drawGauge(speed = 0) {
            if (!ctx) return;
            const isMobile = window.innerWidth <= 600;
            canvas.width = isMobile ? 220 : 300;
            canvas.height = isMobile ? 220 : 300;
            const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = isMobile ? 95 : 140;
            const lineWidth = isMobile ? 15 : 20, largeFontSize = isMobile ? '36px' : '48px', smallFontSize = isMobile ? '14px' : '16px';
            const mainTextYOffset = isMobile ? -10 : -15, subTextYOffset = isMobile ? 15 : 20, maxSpeed = 100;

            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
            ctx.lineWidth = lineWidth;
            ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#333' : '#e0e0e0';
            ctx.stroke();

            if (speed > 0) {
                const speedAngle = (Math.min(speed, maxSpeed) / maxSpeed) * 1.5 * Math.PI;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.75 * Math.PI + speedAngle);
                ctx.lineWidth = lineWidth;
                ctx.strokeStyle = document.body.classList.contains('dark-mode') ? '#3f9eff' : '#007bff';
                ctx.stroke();
            }

            ctx.fillStyle = document.body.classList.contains('dark-mode') ? '#e0e0e0' : '#333';
            ctx.font = `bold ${largeFontSize} Poppins`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(speed.toFixed(1), centerX, centerY + mainTextYOffset);
            ctx.font = `${smallFontSize} Poppins`;
            ctx.fillText('Mbps', centerX, centerY + subTextYOffset);
        }

        function animate() {
            currentSpeed += (targetSpeed - currentSpeed) * 0.1;
            drawGauge(currentSpeed);
            animationFrameId = requestAnimationFrame(animate);
        }
        drawGauge();

        function pollStatus() {
            fetch('/speedtest_status').then(response => response.json()).then(state => {
                const cleanup = () => {
                    clearInterval(pollingInterval);
                    cancelAnimationFrame(animationFrameId);
                    startBtn.disabled = false;
                    startBtn.classList.remove('testing');
                };

                if (state.status === 'running') {
                    resultsPanel.style.display = 'grid';
                    serverInfo.style.display = 'block';
                    if (state.data) {
                        if (state.data.ping) document.getElementById('pingResult').textContent = state.data.ping;
                        if (state.data.server_name) document.getElementById('serverResult').textContent = state.data.server_name;
                        if (state.data.download) document.getElementById('downloadResult').textContent = state.data.download;
                    }

                    if (state.progress === 'download') {
                        statusText.textContent = 'Tes kecepatan download...';
                        targetSpeed = 40 + Math.random() * 50;
                    } else if (state.progress === 'upload') {
                        statusText.textContent = 'Tes kecepatan upload...';
                        targetSpeed = 15 + Math.random() * 25;
                    } else {
                        statusText.textContent = 'Mengukur ping...';
                        targetSpeed = 0;
                    }
                } else if (state.status === 'complete') {
                    cleanup();
                    const data = state.data;
                    ['ping', 'download', 'upload', 'server_name'].forEach(key => {
                        const el = document.getElementById(`${key}Result`);
                        if(el) el.textContent = data[key];
                    });
                    statusText.textContent = 'Tes Selesai!';
                    drawGauge(data.download);
                } else if (state.status === 'error') {
                    cleanup();
                    statusText.textContent = `Error: ${state.error}`;
                    drawGauge(0);
                }
            }).catch(() => {
                clearInterval(pollingInterval);
                cancelAnimationFrame(animationFrameId);
                statusText.textContent = 'Gagal menghubungi server.';
                drawGauge(0);
                startBtn.disabled = false;
                startBtn.classList.remove('testing');
            });
        }

        if (startBtn) {
            startBtn.addEventListener('click', () => {
                if (pollingInterval) clearInterval(pollingInterval);
                if (animationFrameId) cancelAnimationFrame(animationFrameId);

                startBtn.disabled = true;
                startBtn.classList.add('testing');
                statusText.textContent = 'Memulai tes kecepatan...';
                resultsPanel.style.display = 'none';
                serverInfo.style.display = 'none';
                ['pingResult', 'downloadResult', 'uploadResult'].forEach(id => {
                    const el = document.getElementById(id);
                    if (el) el.textContent = '-';
                });
                targetSpeed = 0; currentSpeed = 0;
                animate();

                fetch('/run_speedtest', { method: 'POST' })
                    .then(response => response.ok ? response.json() : Promise.reject(response.status === 409 ? 'Tes lain sedang berjalan.' : 'Gagal memulai tes.'))
                    .then(data => {
                        if (data.success) {
                            pollingInterval = setInterval(pollStatus, 1000);
                        } else {
                            throw new Error(data.message || 'Gagal memulai tes dari server.');
                        }
                    })
                    .catch(err => {
                        statusText.textContent = typeof err === 'string' ? err : err.message;
                        startBtn.disabled = false;
                        startBtn.classList.remove('testing');
                        cancelAnimationFrame(animationFrameId);
                        drawGauge(0);
                    });
            });
        }
    }

    function initMyIpPage() {
        const fields = ['ipAddress', 'ispInfo', 'orgInfo', 'locationInfo', 'countryInfo', 'timezoneInfo'];
        const elements = fields.reduce((acc, id) => ({ ...acc, [id]: document.getElementById(id) }), {});
        const copyBtn = document.getElementById('copyIpBtn');

        fetch('/get_my_ip')
            .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch IP info'))
            .then(data => {
                if (data.success) {
                    elements.ipAddress.textContent = data.ip_address || 'N/A';
                    elements.ispInfo.textContent = data.isp || 'N/A';
                    elements.orgInfo.textContent = data.organization || 'N/A';
                    elements.locationInfo.textContent = `${data.city || ''}, ${data.region || ''}`.replace(/^, |^ | $/g, '') || 'N/A';
                    elements.countryInfo.textContent = data.country || 'N/A';
                    elements.timezoneInfo.textContent = data.timezone || 'N/A';

                    if (data.latitude && data.longitude) {
                        document.querySelector('#ipMap .loader-container').style.display = 'none';
                        ipMap = L.map('ipMap').setView([data.latitude, data.longitude], 10);
                        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                            attribution: '© OpenStreetMap contributors'
                        }).addTo(ipMap);
                        L.marker([data.latitude, data.longitude]).addTo(ipMap)
                            .bindPopup(`<b>Perkiraan Lokasi IP Anda</b><br>${data.city || ''}`).openPopup();
                    } else {
                        document.querySelector('#ipMap .loader-container p').textContent = 'Data Peta Tidak Tersedia';
                    }
                } else {
                    throw new Error('Failed to load geo data.');
                }
            }).catch(() => {
                document.querySelector('#ipMap').innerHTML = '<div class="loader-container"><p>Gagal memuat data.</p></div>';
                fields.forEach(id => { if (elements[id]) elements[id].textContent = 'Gagal Memuat' });
            });

        if (copyBtn) {
            copyBtn.addEventListener('click', () => {
                const ip = elements.ipAddress.textContent;
                if (ip && !ip.includes('Gagal')) {
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
                .then(response => response.ok ? response.json() : Promise.reject('Failed to fetch history'))
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

    function initSettingsPage() {
        document.getElementById('theme-switcher-button')?.addEventListener('click', toggleDarkMode);
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => showConfirm('Anda yakin ingin menghapus semua riwayat jaringan?', clearHistory));
    }

    function liveUpdate() { /* ... */ }
    function updateAveragesAndHistory() { /* ... */ }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        [networkChart, avgChart].forEach(chart => {
            if (chart) {
                const isDarkMode = document.body.classList.contains('dark-mode');
                const textColor = isDarkMode ? '#e0e0e0' : '#333';
                const gridColor = isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                chart.options.plugins.legend.labels.color = textColor;
                chart.options.scales.y.ticks.color = textColor;
                chart.options.scales.y.title.color = textColor;
                chart.options.scales.y.grid.color = gridColor;
                if (chart.options.scales.x) {
                    chart.options.scales.x.ticks.color = textColor;
                    chart.options.scales.x.title.color = textColor;
                    chart.options.scales.x.grid.color = gridColor;
                }
                chart.update();
            }
        });
    }

    function showConfirm(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `<div class="modal-content"><p>${message}</p><div class="modal-buttons"><button id="confirm-yes">Ya</button><button id="confirm-no">Tidak</button></div></div>`;
        document.body.appendChild(modal);
        document.getElementById('confirm-yes').addEventListener('click', () => { onConfirm(); document.body.removeChild(modal); });
        document.getElementById('confirm-no').addEventListener('click', () => document.body.removeChild(modal));
    }

    darkModeButton.addEventListener('click', toggleDarkMode);
    if (localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    
    const lastPage = localStorage.getItem('lastActivePage') || 'dashboard';
    const activeMenuItem = document.querySelector(`.menu-item[data-page="${lastPage}"]`);
    if(activeMenuItem) {
        menuItems.forEach(i => i.classList.remove('active'));
        activeMenuItem.classList.add('active');
    }
    loadPage(lastPage);
});

function exportCsv() { window.location.href = '/export_csv'; }

function clearHistory() {
    fetch('/clear_history', { method: 'POST' })
        .then(response => response.ok ? response.json() : Promise.reject('Failed to clear history'))
        .then(data => {
            const messageBox = document.createElement('div');
            messageBox.className = 'message-box';
            messageBox.textContent = data.message;
            document.body.appendChild(messageBox);
            setTimeout(() => document.body.removeChild(messageBox), 2000);
            document.querySelector('.menu-item.active')?.click();
        })
        .catch(err => {
            const messageBox = document.createElement('div');
            messageBox.className = 'message-box error';
            messageBox.textContent = `Error: ${err.message}`;
            document.body.appendChild(messageBox);
            setTimeout(() => document.body.removeChild(messageBox), 3000);
        });
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