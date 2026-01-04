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
        // Load all data for heatmap
        const allData = await chrome.storage.local.get(null);
        const weekData = allData[currentWeekKey] || {};

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

        // 3. Calculate and render hero stats
        renderHeroStats(weekData, todayKey, chartData);

        // 4. Render heatmap with all data
        if (typeof ActivityHeatmap !== 'undefined') {
            new ActivityHeatmap('heatmap-container', allData);
        }

    } catch (err) {
        console.error("Error loading dashboard:", err);
    }
}

// Render hero stats cards
function renderHeroStats(weekData, todayKey, chartData) {
    // Total time today
    const todayData = weekData[todayKey] || {};
    const totalToday = Object.values(todayData).reduce((sum, time) => sum + time, 0);
    document.getElementById('total-time-today').textContent = formatTime(totalToday);

    // Most visited site
    if (Object.keys(todayData).length > 0) {
        const sorted = Object.entries(todayData).sort((a, b) => b[1] - a[1]);
        const [topSite, topTime] = sorted[0];
        const percentage = Math.round((topTime / totalToday) * 100);
        
        document.getElementById('most-visited-site').textContent = topSite;
        document.getElementById('most-visited-percentage').textContent = `${percentage}% of total time`;
    }

    // Weekly average
    const totalWeekMinutes = chartData.reduce((sum, min) => sum + min, 0);
    const avgMinutes = Math.round(totalWeekMinutes / 7);
    const avgHours = Math.floor(avgMinutes / 60);
    const avgMins = avgMinutes % 60;
    document.getElementById('weekly-average').textContent = `${avgHours}h ${avgMins}m`;
}

function renderChart(labels, data) {
    const ctx = document.getElementById('weeklyChart').getContext('2d');
    
    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Deadly Activity',
                data: data,
                backgroundColor: 'rgba(255, 152, 106, 0.8)',
                borderColor: '#FF986A',
                borderWidth: 2,
                borderRadius: 6,
                hoverBackgroundColor: '#FF986A',
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.05)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.5)',
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    grid: { 
                        display: false,
                        drawBorder: false
                    },
                    ticks: { 
                        color: 'rgba(255, 255, 255, 0.7)',
                        font: {
                            size: 12,
                            weight: '500'
                        }
                    }
                }
            },
            plugins: {
                legend: { 
                    display: true,
                    position: 'bottom',
                    labels: { 
                        color: '#FF986A',
                        font: {
                            size: 12,
                            weight: '500'
                        },
                        usePointStyle: true,
                        pointStyle: 'rect',
                        padding: 15
                    }
                },
                tooltip: {
                    backgroundColor: '#0f1640',
                    titleColor: '#FFFFFF',
                    bodyColor: '#FF986A',
                    borderColor: 'rgba(255, 152, 106, 0.3)',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false,
                    callbacks: {
                        label: function (context) {
                            return context.parsed.y + ' minutes active';
                        }
                    }
                }
            },
            animation: {
                duration: 800,
                easing: 'easeOutQuart'
            }
        }
    });
}

function renderTopSites(data) {
    const list = document.getElementById('top-sites-list');
    list.innerHTML = '';

    if (Object.keys(data).length === 0) {
        list.innerHTML = `
            <li class="empty-state">
                <p style="color: rgba(255,255,255,0.5); font-size: 14px;">No activity today.</p>
            </li>
        `;
        return;
    }

    // Sort by time desc and take top 5
    const sorted = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 5);

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
