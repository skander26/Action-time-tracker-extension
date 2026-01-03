/**
 * popup.js
 * UI Logic for displaying time tracking data
 */

// Helper: Get today's date key
function getDateKey() {
    const now = new Date();
    return now.toISOString().split('T')[0];
}

// Helper: Format milliseconds to HH:MM:SS
function formatTime(ms) {
    let seconds = Math.floor(ms / 1000);
    let minutes = Math.floor(seconds / 60);
    let hours = Math.floor(minutes / 60);

    seconds = seconds % 60;
    minutes = minutes % 60;

    const pad = (num) => num.toString().padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Render the list of domains
function renderList(data) {
    const listDetails = document.getElementById('domain-list');
    const emptyState = document.getElementById('empty-state');

    // Clear current list
    listDetails.innerHTML = '';

    if (!data || Object.keys(data).length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Convert object to array and sort by time (descending)
    const sortedDomains = Object.entries(data).sort((a, b) => b[1] - a[1]);

    sortedDomains.forEach(([domain, ms]) => {
        const li = document.createElement('li');
        li.className = 'domain-item';

        const nameSpan = document.createElement('span');
        nameSpan.className = 'domain-name';
        nameSpan.textContent = domain;
        nameSpan.title = domain; // Tooltip for long names

        const timeSpan = document.createElement('span');
        timeSpan.className = 'domain-time';
        timeSpan.textContent = formatTime(ms);

        li.appendChild(nameSpan);
        li.appendChild(timeSpan);
        listDetails.appendChild(li);
    });
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    const dateKey = getDateKey();

    // Display current date
    const dateDisplay = document.getElementById('date-display');
    dateDisplay.textContent = new Date().toDateString();

    // Load data
    try {
        const result = await chrome.storage.local.get([dateKey]);
        const todayData = result[dateKey] || {};
        renderList(todayData);
    } catch (err) {
        console.error("Failed to load data:", err);
    }
});
