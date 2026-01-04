/**
 * dashboard.js
 * Logic for the Analytics Dashboard
 */

// --- Shared Utility Logic (Keep in sync with background.js) ---

function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return `week_${year}_${weekNo.toString().padStart(2, '0')}`;
}

function getDateString(date) {
    return date.toISOString().split('T')[0];
}

function formatTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    const pad = (num) => num.toString().padStart(2, '0');

    if (hours > 0) return `${hours}h ${minutes}m`;
    if (minutes > 0) return `${minutes}m ${seconds}s`;
    return `${seconds}s`;
}

// --- Dashboard Logic ---

async function loadDashboard() {
    const now = new Date();
    const currentWeekKey = getWeekKey(now);
    const todayKey = getDateString(now);

    document.getElementById('date-range').textContent = `Week ${currentWeekKey.split('_')[2]}, ${now.getFullYear()}`;

    try {
        const result = await chrome.storage.local.get([currentWeekKey]);
        const weekData = result[currentWeekKey] || {};

        // 1. Process Weekly Data for Chart
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const chartLabels = [];
        const chartData = [];

        // Generate last 7 days or current ISO week days? 
        // Let's stick to the days IN the recorded week object to keep it alignment with "Current Week" view.
        // Actually, let's show Monday-Sunday of the current week.

        // Get start of this week (Monday)
        const d = new Date(now);
        const day = d.getDay();
        const diff = d.getDate() - day + (day == 0 ? -6 : 1); // adjust when day is sunday
        const monday = new Date(d.setDate(diff));

        for (let i = 0; i < 7; i++) {
            const tempDate = new Date(monday);
            tempDate.setDate(monday.getDate() + i);
            const dateStr = getDateString(tempDate);

            chartLabels.push(days[tempDate.getDay()]);

            // Sum total time for this day
            let totalMs = 0;
            if (weekData[dateStr]) {
                totalMs = Object.values(weekData[dateStr]).reduce((a, b) => a + b, 0);
            }
            // Convert to minutes for chart
            chartData.push(Math.round(totalMs / 1000 / 60));
        }

        renderChart(chartLabels, chartData);

        // 2. Process Today's Top Sites
        const todaySites = weekData[todayKey] || {};
        renderTopSites(todaySites);

    } catch (err) {
        console.error("Error loading dashboard:", err);
    }
}

function renderChart(labels, data) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Active Time (Minutes)',
                data: data,
                backgroundColor: 'rgba(187, 134, 252, 0.6)', // Accent color
                borderColor: 'rgba(187, 134, 252, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: '#333' },
                    ticks: { color: '#a0a0a0' }
                },
                x: {
                    grid: { color: '#333' },
                    ticks: { color: '#a0a0a0' }
                }
            },
            plugins: {
                legend: { labels: { color: '#e0e0e0' } },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.y !== null) {
                                label += context.parsed.y + ' min';
                            }
                            return label;
                        }
                    }
                }
            }
        }
    });
}

function renderTopSites(data) {
    const list = document.getElementById('top-sites-list');
    list.innerHTML = '';

    if (Object.keys(data).length === 0) {
        list.innerHTML = '<li style="padding:10px; text-align:center; color:#666;">No activity today.</li>';
        return;
    }

    // Sort by time desc
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5); // Start with top 5

    sorted.forEach(([domain, ms]) => {
        const li = document.createElement('li');
        li.className = 'site-item';
        li.innerHTML = `
      <span class="site-name">${domain}</span>
      <span class="site-time">${formatTime(ms)}</span>
    `;
        list.appendChild(li);
    });
}

// --- Event Listeners ---

document.addEventListener('DOMContentLoaded', loadDashboard);

document.getElementById('export-btn').addEventListener('click', async () => {
    const data = await chrome.storage.local.get(null);
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `time-tracker-backup-${getDateString(new Date())}.json`;
    a.click();
});

document.getElementById('clear-btn').addEventListener('click', async () => {
    if (confirm("Are you sure you want to delete ALL tracking data? This cannot be undone.")) {
        await chrome.storage.local.clear();
        alert("Data cleared.");
        location.reload();
    }
});
