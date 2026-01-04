/**
 * background.js
 * Service Worker for Local-First Time Tracker
 * Handles active tab tracking, idle states, and data persistence.
 */

let currentDomain = null;
let startTime = null;
let timer = null;

// Constants
const IDLE_THRESHOLD = 60; // seconds

/**
 * UTILITY FUNCTIONS
 */

// Helper to extract domain from URL
function getDomain(url) {
    try {
        const urlObj = new URL(url);
        // restrict to http/https
        if (!['http:', 'https:'].includes(urlObj.protocol)) return null;
        return urlObj.hostname;
    } catch (e) {
        return null;
    }
}

// Helper to get ISO week number and year
function getWeekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const year = d.getUTCFullYear();
    const weekNo = Math.ceil((((d - new Date(Date.UTC(year, 0, 1))) / 86400000) + 1) / 7);
    return `week_${year}_${weekNo.toString().padStart(2, '0')}`;
}

// Get numeric date string YYYY-MM-DD
function getDateString(date) {
    return date.toISOString().split('T')[0];
}

/**
 * CORE LOGIC
 */

// Stop tracking the current domain and save the elapsed time
async function stopTracking() {
    if (!currentDomain || !startTime) return;

    const endTime = Date.now();
    const domainToUpdate = currentDomain;

    // Clear state immediately
    currentDomain = null;
    const sessionStartTime = startTime;
    startTime = null;

    // Helper to save data for a specific date
    const saveTime = async (timestamp, duration) => {
        try {
            const dateObj = new Date(timestamp);
            const weekKey = getWeekKey(dateObj);
            const dateStr = getDateString(dateObj);

            const result = await chrome.storage.local.get([weekKey]);
            let weekData = result[weekKey] || {};
            let dayData = weekData[dateStr] || {};

            // Update domain time
            dayData[domainToUpdate] = (dayData[domainToUpdate] || 0) + duration;

            // Write back nested structure
            weekData[dateStr] = dayData;
            await chrome.storage.local.set({ [weekKey]: weekData });

            console.log(`[TimeTracker] Saved ${duration}ms for ${domainToUpdate} in ${weekKey} > ${dateStr}`);
        } catch (err) {
            console.error("[TimeTracker] Storage error:", err);
        }
    };

    const startDate = new Date(sessionStartTime);
    const endDate = new Date(endTime);

    // Check if session crosses midnight
    if (startDate.toDateString() !== endDate.toDateString()) {
        // Calculate split
        const midnight = new Date(endDate);
        midnight.setHours(0, 0, 0, 0); // Midnight of the end day

        const durationDay1 = midnight.getTime() - sessionStartTime;
        const durationDay2 = endTime - midnight.getTime();

        // Save for Day 1
        await saveTime(startDate, durationDay1);
        // Save for Day 2
        await saveTime(endDate, durationDay2);

    } else {
        // Standard same-day session
        await saveTime(endDate, endTime - sessionStartTime);
    }
}

// Start tracking a new domain
function startTracking(domain) {
    if (!domain) return;
    currentDomain = domain;
    startTime = Date.now();
    console.log(`[TimeTracker] Started tracking: ${currentDomain}`);
}

// Main handler to process tab/window changes
async function handleStateChange() {
    // Always stop previous tracking first
    await stopTracking();

    // Check if system is locked/idle
    const idleState = await new Promise((resolve) => chrome.idle.queryState(IDLE_THRESHOLD, resolve));
    if (idleState !== 'active') {
        console.log("[TimeTracker] User is idle/locked. Tracking paused.");
        return;
    }

    // Check current window focus
    const window = await chrome.windows.getLastFocused();
    if (!window || !window.focused) {
        console.log("[TimeTracker] Window not focused. Tracking paused.");
        return;
    }

    // Check active tab in that window
    const [activeTab] = await chrome.tabs.query({ active: true, windowId: window.id });

    if (activeTab && activeTab.url) {
        const domain = getDomain(activeTab.url);
        if (domain) {
            startTracking(domain);
        } else {
            console.log("[TimeTracker] Ignored URL (not http/s):", activeTab.url);
        }
    }
}

/**
 * INITIALIZATION & LISTENERS
 */

// Set idle detection interval
chrome.idle.setDetectionInterval(IDLE_THRESHOLD);

// 1. Tab Activated (Switched tabs)
chrome.tabs.onActivated.addListener(handleStateChange);

// 2. Tab Updated (URL changed in same tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.active) {
        handleStateChange();
    }
});

// 3. Window Focus Changed (Switched windows or minimized)
chrome.windows.onFocusChanged.addListener((windowId) => {
    if (windowId === chrome.windows.WINDOW_ID_NONE) {
        // All windows lost focus (minimized or other app updated)
        stopTracking();
        console.log("[TimeTracker] Chrome lost focus.");
    } else {
        handleStateChange();
    }
});

// 4. Idle State Changed
chrome.idle.onStateChanged.addListener((newState) => {
    console.log(`[TimeTracker] Idle state changed to: ${newState}`);
    if (newState === 'active') {
        handleStateChange();
    } else {
        stopTracking();
    }
});

// Initialize on load (if service worker wakes up)
handleStateChange();
