// File: static/app.js
document.addEventListener('DOMContentLoaded', function () {
    const mainContent = document.getElementById('main-content');
    const menuItems = document.querySelectorAll('.menu-item');
    const darkModeButton = document.getElementById('toggleDarkMode');
    const sidebar = document.querySelector('.sidebar');
    const hamburgerBtn = document.getElementById('hamburger-menu');
    let liveUpdateInterval;
    let networkChart = null, avgChart = null, ipMap = null;

    if (hamburgerBtn && sidebar) {
        hamburgerBtn.addEventListener('click', () => sidebar.classList.toggle('open'));
        document.addEventListener('click', (event) => {
            const isClickInside = sidebar.contains(event.target) || hamburgerBtn.contains(event.target);
            if (window.innerWidth <= 768 && sidebar.classList.contains('open') && !isClickInside) {
                sidebar.classList.remove('open');
            }
        });
    }

    function loadPage(page = 'dashboard') {
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);
        if (ipMap) { ipMap.remove(); ipMap = null; }
        fetch(`/page/${page}`)
            .then(response => response.ok ? response.text() : Promise.reject(response.statusText))
            .then(html => {
                mainContent.innerHTML = html;
                const pageInitializers = {
                    'dashboard': initDashboard, 'speedtest': initSpeedTestPage,
                    'myip': initMyIpPage, 'history': initHistoryPage, 'settings': initSettingsPage
                };
                pageInitializers[page]?.();
            })
            .catch(err => mainContent.innerHTML = `<p style="color: red;">Error: ${err}</p>`);
    }

    menuItems.forEach(item => {
        item.addEventListener('click', (e) => {
            menuItems.forEach(i => i.classList.remove('active'));
            e.currentTarget.classList.add('active');
            if (window.innerWidth <= 768) sidebar.classList.remove('open');
            loadPage(e.currentTarget.getAttribute('data-page'));
        });
    });

    function initDashboard() {
        const timeRangeSelect = document.getElementById('time_range');
        const lineCtx = document.getElementById('networkChart')?.getContext('2d');
        const barCtx = document.getElementById('avgChart')?.getContext('2d');
        if (lineCtx && barCtx) {
            networkChart = new Chart(lineCtx, createChartConfig('line'));
            avgChart = new Chart(barCtx, createChartConfig('bar'));
            timeRangeSelect?.addEventListener('change', updateAveragesAndHistory);
            updateAveragesAndHistory();
        }
    }

    // Di dalam file static/app.js

    function initSpeedTestPage() {
        const startBtn = document.getElementById('startTestBtn');
        const statusText = document.getElementById('statusText');
        const pingCard = document.getElementById('pingCard');
        const downloadCard = document.getElementById('downloadCard');
        const uploadCard = document.getElementById('uploadCard');
        const serverInfo = document.getElementById('serverInfo');
        const canvas = document.getElementById('speedometer');
        const ctx = canvas?.getContext('2d');

        let pollingInterval, animationFrameId;
        let currentSpeed = 0, targetSpeed = 0;

        // Sembunyikan semua kartu hasil di awal
        [pingCard, downloadCard, uploadCard, serverInfo].forEach(el => el?.classList.add('hidden'));

        function drawGauge(speed = 0) {
            if (!ctx) return;
            const centerX = canvas.width / 2, centerY = canvas.height / 2, radius = 140, maxSpeed = 100;
            const isDark = document.body.classList.contains('dark-mode');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            // Background arc
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.25 * Math.PI);
            ctx.lineWidth = 20;
            ctx.strokeStyle = isDark ? '#333' : '#e0e0e0';
            ctx.stroke();
            // Speed arc
            if (speed > 0) {
                const speedAngle = (Math.min(speed, maxSpeed) / maxSpeed) * 1.5 * Math.PI;
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, 0.75 * Math.PI, 0.75 * Math.PI + speedAngle);
                ctx.strokeStyle = isDark ? '#3f9eff' : '#007bff';
                ctx.stroke();
            }
            // Speed text
            ctx.fillStyle = isDark ? '#e0e0e0' : '#333';
            ctx.font = 'bold 48px Poppins'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(speed.toFixed(1), centerX, centerY - 15);
            ctx.font = '16px Poppins';
            ctx.fillText('Mbps', centerX, centerY + 20);
        }

        function animate() {
            currentSpeed += (targetSpeed - currentSpeed) * 0.1; // Smoothing
            drawGauge(currentSpeed);
            animationFrameId = requestAnimationFrame(animate);
        }

        const stopTestActivities = () => {
            clearInterval(pollingInterval);
            pollingInterval = null;
            cancelAnimationFrame(animationFrameId);
            startBtn.disabled = false;
            startBtn.querySelector('i').className = 'fas fa-play';
            targetSpeed = 0;
        };

        function pollStatus() {
            fetch('/speedtest_status').then(res => res.json()).then(state => {
                if (state.status === 'idle') {
                    stopTestActivities();
                    return;
                }

                if (state.status === 'running') {
                    if (state.progress === 'ping') {
                        statusText.textContent = 'Mencari server optimal...';
                    } else if (state.progress === 'download') {
                        statusText.textContent = 'Mengukur kecepatan unduh...';
                        if (state.data.ping > 0 && pingCard.classList.contains('hidden')) {
                            document.getElementById('pingResult').textContent = state.data.ping.toFixed(2);
                            pingCard.classList.remove('hidden');
                        }
                    } else if (state.progress === 'upload') {
                        statusText.textContent = 'Mengukur kecepatan unggah...';
                        if (state.data.download > 0) {
                            // Animasikan gauge ke hasil download yang AKURAT
                            targetSpeed = state.data.download;
                            if(downloadCard.classList.contains('hidden')) {
                                document.getElementById('downloadResult').textContent = state.data.download.toFixed(2);
                                downloadCard.classList.remove('hidden');
                            }
                        }
                    }
                } else if (state.status === 'complete') {
                    statusText.textContent = 'Tes Selesai!';
                    const data = state.data;
                    
                    // Animasikan gauge ke hasil upload yang AKURAT
                    targetSpeed = data.upload; 
                    
                    document.getElementById('pingResult').textContent = data.ping.toFixed(2);
                    document.getElementById('downloadResult').textContent = data.download.toFixed(2);
                    document.getElementById('uploadResult').textContent = data.upload.toFixed(2);
                    document.getElementById('serverResult').textContent = data.server_name;
                    
                    [pingCard, downloadCard, uploadCard, serverInfo].forEach(el => el?.classList.remove('hidden'));
                } else if (state.status === 'error') {
                    statusText.textContent = `Error: ${state.error}`;
                    stopTestActivities();
                    drawGauge(0);
                }
            }).catch(() => {
                statusText.textContent = 'Gagal menghubungi server.';
                stopTestActivities();
            });
        }

        startBtn?.addEventListener('click', () => {
            if (pollingInterval) return;
            
            [pingCard, downloadCard, uploadCard, serverInfo].forEach(el => el?.classList.add('hidden'));

            startBtn.disabled = true;
            startBtn.querySelector('i').className = 'fas fa-spinner fa-spin';
            statusText.textContent = 'Memulai tes kecepatan...';
            targetSpeed = 0;
            currentSpeed = 0;
            animate();
            
            fetch('/run_speedtest', { method: 'POST' }).then(res => res.json()).then(data => {
                if (!data.success) throw new Error(data.message || 'Gagal memulai tes.');
                pollingInterval = setInterval(pollStatus, 500);
            }).catch(err => {
                statusText.textContent = err.message;
                stopTestActivities();
                drawGauge(0);
            });
        });

        drawGauge();

        return () => {
            stopTestActivities();
        };
    }

    function initMyIpPage() {
        fetch('/get_my_ip').then(res => res.json()).then(data => {
            if (data.success) {
                document.getElementById('ipAddress').textContent = data.ip_address || 'N/A';
                document.getElementById('ispInfo').textContent = data.isp || 'N/A';
                document.getElementById('orgInfo').textContent = data.organization || 'N/A';
                document.getElementById('locationInfo').textContent = `${data.city || ''}, ${data.region || ''}`.replace(/^, |^ | $/g, '') || 'N/A';
                document.getElementById('countryInfo').textContent = data.country || 'N/A';
                document.getElementById('timezoneInfo').textContent = data.timezone || 'N/A';
                if (data.latitude && data.longitude) {
                    document.querySelector('#ipMap .loader-container').style.display = 'none';
                    ipMap = L.map('ipMap').setView([data.latitude, data.longitude], 10);
                    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(ipMap);
                    L.marker([data.latitude, data.longitude]).addTo(ipMap);
                }
            }
        });
        document.getElementById('copyIpBtn')?.addEventListener('click', (e) => {
            navigator.clipboard.writeText(document.getElementById('ipAddress').textContent);
        });
    }

    function initHistoryPage() {
        const tableBody = document.querySelector('#history-table tbody');
        const typeFilter = document.getElementById('type_filter');
        const loadHistory = () => {
            fetch(`/get_history?time_range=all_data&type=${typeFilter.value}`).then(res => res.json()).then(data => {
                tableBody.innerHTML = data.length > 0
                    ? data.map(item => `<tr><td>${item.timestamp}</td><td>${item.download.toFixed(2)}</td><td>${item.upload.toFixed(2)}</td><td>${item.type}</td></tr>`).join('')
                    : '<tr><td colspan="4">Tidak ada riwayat.</td></tr>';
            });
        };
        typeFilter.addEventListener('change', loadHistory);
        loadHistory();
    }

    function initSettingsPage() {
        document.getElementById('theme-switcher-button')?.addEventListener('click', toggleDarkMode);
        document.getElementById('clearHistoryBtn')?.addEventListener('click', () => showConfirm('Anda yakin ingin menghapus semua riwayat?', clearHistory));
    }

    function liveUpdate() {
        fetch('/get_speed').then(res => res.ok ? res.json() : Promise.reject()).then(data => {
            document.getElementById('download_speed').textContent = (data.download || 0).toFixed(2);
            document.getElementById('upload_speed').textContent = (data.upload || 0).toFixed(2);
            if (networkChart && document.getElementById('time_range')?.value === 'all') {
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
        }).catch(() => {
            document.getElementById('download_speed').textContent = '0.00';
            document.getElementById('upload_speed').textContent = '0.00';
        });
    }

    function updateAveragesAndHistory() {
        const timeRange = document.getElementById('time_range')?.value || 'all';
        if (liveUpdateInterval) clearInterval(liveUpdateInterval);

        fetch(`/get_history?time_range=${timeRange}`).then(res => res.json()).then(history => {
            const avgDownload = history.length ? history.reduce((sum, item) => sum + item.download, 0) / history.length : 0;
            const avgUpload = history.length ? history.reduce((sum, item) => sum + item.upload, 0) / history.length : 0;
            document.getElementById('avg_download_speed').textContent = avgDownload.toFixed(2);
            document.getElementById('avg_upload_speed').textContent = avgUpload.toFixed(2);
            if (networkChart) {
                if (timeRange === 'all') {
                    networkChart.data.labels = [];
                    networkChart.data.datasets.forEach(d => d.data = []);
                } else {
                    networkChart.data.labels = history.map(item => item.timestamp.split(' ')[1]).reverse();
                    networkChart.data.datasets[0].data = history.map(item => item.download).reverse();
                    networkChart.data.datasets[1].data = history.map(item => item.upload).reverse();
                }
                networkChart.update();
            }
            if (avgChart) {
                avgChart.data.datasets[0].data = [avgDownload, avgUpload];
                avgChart.update();
            }
            if (timeRange === 'all') {
                liveUpdateInterval = setInterval(liveUpdate, 2000);
            }
        });
    }

    function toggleDarkMode() {
        document.body.classList.toggle('dark-mode');
        localStorage.setItem('theme', document.body.classList.contains('dark-mode') ? 'dark' : 'light');
        [networkChart, avgChart].forEach(chart => {
            if (chart) {
                const isDark = document.body.classList.contains('dark-mode');
                const textColor = isDark ? '#e0e0e0' : '#333';
                const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                chart.options.plugins.legend.labels.color = textColor;
                Object.values(chart.options.scales).forEach(scale => {
                    scale.ticks.color = textColor;
                    scale.title.color = textColor;
                    scale.grid.color = gridColor;
                });
                chart.update();
            }
        });
    }

    function showConfirm(message, onConfirm) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content">
                <p>${message}</p>
                <div class="modal-buttons">
                    <button id="confirm-yes" class="btn">Ya</button>
                    <button id="confirm-no" class="btn btn-secondary">Tidak</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        document.getElementById('confirm-yes').addEventListener('click', () => {
            onConfirm();
            modal.remove();
        });
        document.getElementById('confirm-no').addEventListener('click', () => modal.remove());
        modal.style.display = 'flex';
    }

    function clearHistory() {
        fetch('/clear_history', { method: 'POST' }).then(res => res.json()).then(data => {
            loadPage('history');
            showConfirm(data.message);
        });
    }

    // Initial Setup
    if(localStorage.getItem('theme') === 'dark') document.body.classList.add('dark-mode');
    darkModeButton.addEventListener('click', toggleDarkMode);
    if(document.getElementById('current-year')) document.getElementById('current-year').textContent = new Date().getFullYear();
    loadPage('dashboard');
});

// Global Functions
function exportCsv() { window.location.href = '/export_csv'; }

function createChartConfig(type) {
    const isDark = document.body.classList.contains('dark-mode');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const textColor = isDark ? '#e0e0e0' : '#333';
    const baseOptions = {
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { labels: { color: textColor } } },
        scales: {
            y: { beginAtZero: true, title: { display: true, text: 'Speed (Mbps)', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } },
            x: { title: { display: true, text: 'Time', color: textColor }, ticks: { color: textColor }, grid: { color: gridColor } }
        }
    };
    if (type === 'line') return { type: 'line', data: { labels: [], datasets: [ { label: 'Download (Mbps)', data: [], borderColor: '#007bff', backgroundColor: 'rgba(0, 123, 255, 0.1)', fill: true, tension: 0.3 }, { label: 'Upload (Mbps)', data: [], borderColor: '#28a745', backgroundColor: 'rgba(40, 167, 69, 0.1)', fill: true, tension: 0.3 } ] }, options: baseOptions };
    if (type === 'bar') return { type: 'bar', data: { labels: ['Avg. Download', 'Avg. Upload'], datasets: [{ label: 'Average Speed (Mbps)', data: [0, 0], backgroundColor: ['#007bff', '#28a745'] }] }, options: { ...baseOptions, scales: { ...baseOptions.scales, x: { display: false } } } };
}
