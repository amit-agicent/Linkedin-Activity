/* ===================================== */
/* script.js - MODIFIED */
/* ===================================== */

// Note: The original hardcoded time slots are replaced by real-time calculation.

let entries = [];
let nextId = 1;

// --- Time Zone Calculation Logic ---

/**
 * Calculates time for EST, PST, and BST based on a given IST date/time.
 * @param {string} istDateTimeString - A string combining date and time (e.g., "2025-10-01T20:30").
 * @returns {object} An object containing the calculated time zone strings.
 */
function calculateTimeZones(istDateTimeString) {
    if (!istDateTimeString) {
        return { day: '', est: '', pdt: '', bst: '' };
    }

    // 1. Create a Date object from the IST string
    // The input format is ISO-like (YYYY-MM-DDTHH:MM), but we'll treat it as IST.
    // The trick is to append 'Z' to make the browser treat it as UTC, then apply
    // a 5.5 hour offset (IST is UTC+5.5) to get the real UTC time of the event.
    // This is complex, so for simplicity and robustness, we use a custom parser.
    
    // Simple way to get a Date object that is *exactly* the IST time:
    const [datePart, timePart] = istDateTimeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create a new Date object assuming the local machine is running IST (or a similar trick)
    // The most reliable way is often to parse it as an IST string for conversion.
    
    // Using UTC date and then adjusting for IST to get a universal reference time:
    const istDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    // IST is UTC+5:30. To get the actual moment in UTC, we subtract 5.5 hours (330 minutes) from the assumed IST time.
    istDate.setUTCMinutes(istDate.getUTCMinutes() - 330);


    // 2. Formatting options
    const options = {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'shortOffset',
        weekday: 'short'
    };
    
    // Day formatting
    const dayOptions = { weekday: 'long' };
    const istDay = istDate.toLocaleString('en-US', dayOptions);

    // 3. Time Zone Conversions
    const timeZones = [
        { zone: 'America/New_York', key: 'est' }, // EST/EDT
        { zone: 'America/Los_Angeles', key: 'pdt' }, // PST/PDT
        { zone: 'Europe/London', key: 'bst' } // GMT/BST
    ];

    const results = { day: istDay };
    
    timeZones.forEach(({ zone, key }) => {
        try {
            const timeOptions = { ...options, timeZone: zone };
            const timeString = istDate.toLocaleString('en-US', timeOptions);
            results[key] = timeString.replace(/, GMT\+\d+/, ''); // Clean up the result
        } catch (e) {
            results[key] = 'N/A';
            console.error(`Error formatting time for ${zone}:`, e);
        }
    });
    
    return results;
}

// --- Dark Mode Toggle (Keep as is) ---
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    
    const toggle = document.querySelector('.dark-mode-toggle');
    toggle.style.animation = 'none';
    setTimeout(() => {
        toggle.style.animation = 'float 3s ease-in-out infinite';
    }, 10);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// --- Data Management (Updated) ---
function loadData() {
    const saved = localStorage.getItem('linkedinTrackerData');
    if (saved) {
        try {
            entries = JSON.parse(saved);
            // Ensure compatibility with old structure if necessary, or just rely on new structure
            if (entries.length > 0) {
                nextId = Math.max(...entries.map(e => e.id)) + 1;
            } else {
                addEntry();
            }
        } catch (e) {
            addEntry();
        }
    } else {
        addEntry();
    }
    renderTable();
    updateStats();
}

function saveData() {
    localStorage.setItem('linkedinTrackerData', JSON.stringify(entries));
}

function addEntry() {
    // Auto-populate with current date/time in YYYY-MM-DDT HH:MM format (IST assumed)
    const now = new Date();
    // Use an IST offset of 5 hours 30 minutes
    const istOffset = 330 * 60000; // 330 minutes in ms
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    const datePart = istTime.toISOString().split('T')[0];
    const timePart = istTime.toTimeString().slice(0, 5); // HH:MM
    const istDateTime = `${datePart}T${timePart}`;
    
    const calculatedTimes = calculateTimeZones(istDateTime);

    const newEntry = {
        id: nextId++,
        istDateTime: istDateTime, // Combined date and time
        day: calculatedTimes.day,
        estTime: calculatedTimes.est,
        pdtTime: calculatedTimes.pdt,
        bstTime: calculatedTimes.bst,
        requestsSent: 0,
        accepted: 0,
        pending: 0,
        rejected: 0
    };
    entries.push(newEntry);
    saveData();
    renderTable();
    updateStats();
    
    // Animate the new row
    setTimeout(() => {
        const lastRow = document.querySelector('#tableBody tr:last-child');
        if (lastRow) {
            lastRow.style.animation = 'slideUp 0.5s ease-out';
        }
    }, 10);
}

function deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        entries = entries.filter(e => e.id !== id);
        saveData();
        renderTable();
        updateStats();
    }
}

function updateEntry(id, field, value) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    // 1. Update the field
    entry[field] = value;

    // 2. Recalculate time zones if the IST date/time changed
    if (field === 'istDateTime') {
        const calculatedTimes = calculateTimeZones(value);
        entry.day = calculatedTimes.day;
        entry.estTime = calculatedTimes.est;
        entry.pdtTime = calculatedTimes.pdt;
        entry.bstTime = calculatedTimes.bst;
    }

    // 3. Recalculate pending requests
    if (['requestsSent', 'accepted', 'rejected'].includes(field)) {
        const sent = parseInt(entry.requestsSent) || 0;
        const accepted = parseInt(entry.accepted) || 0;
        const rejected = parseInt(entry.rejected) || 0;
        entry.pending = sent - accepted - rejected;
    }

    saveData();
    renderTable();
    updateStats();
}

// --- Table Rendering (Modified) ---
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = entries.map((entry, index) => {
        const rate = entry.requestsSent > 0 
            ? ((entry.accepted / entry.requestsSent) * 100).toFixed(1) 
            : 0;
        
        const rateClass = rate >= 30 ? 'rate-high' : rate >= 20 ? 'rate-medium' : 'rate-low';
        
        // Extract Date and Time for display/CSV
        const [datePart, timePart] = entry.istDateTime ? entry.istDateTime.split('T') : ['', ''];

        return `
            <tr style="animation: fadeIn 0.5s ease-out ${index * 0.1}s backwards">
                <td>
                    <input type="datetime-local" value="${entry.istDateTime}"
                        onchange="updateEntry(${entry.id}, 'istDateTime', this.value)">
                </td>
                <td>${entry.day || 'N/A'}</td>
                <td>${timePart}</td>
                <td>${entry.estTime || 'N/A'}</td>
                <td>${entry.pdtTime || 'N/A'}</td>
                <td>${entry.bstTime || 'N/A'}</td>
                <td>
                    <input type="number" value="${entry.requestsSent}" min="0"
                        onchange="updateEntry(${entry.id}, 'requestsSent', this.value)">
                </td>
                <td>
                    <input type="number" value="${entry.accepted}" min="0"
                        onchange="updateEntry(${entry.id}, 'accepted', this.value)">
                </td>
                <td>
                    <span class="pending-value">${entry.pending}</span>
                </td>
                <td>
                    <input type="number" value="${entry.rejected}" min="0"
                        onchange="updateEntry(${entry.id}, 'rejected', this.value)">
                </td>
                <td>
                    <span class="${rateClass}">${rate}%</span>
                </td>
                <td>
                    <button onclick="deleteEntry(${entry.id})" class="delete-btn" title="Delete entry">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

// --- Stats Update (Modified to use new fields) ---
function updateStats() {
    const totalSent = entries.reduce((sum, e) => sum + (parseInt(e.requestsSent) || 0), 0);
    const totalAccepted = entries.reduce((sum, e) => sum + (parseInt(e.accepted) || 0), 0);
    const totalPending = entries.reduce((sum, e) => sum + (parseInt(e.pending) || 0), 0);
    const totalRejected = entries.reduce((sum, e) => sum + (parseInt(e.rejected) || 0), 0);
    const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;

    // Animate stat updates
    animateValue('totalSent', parseInt(document.getElementById('totalSent').textContent) || 0, totalSent, 500);
    animateValue('totalAccepted', parseInt(document.getElementById('totalAccepted').textContent) || 0, totalAccepted, 500);
    animateValue('totalPending', parseInt(document.getElementById('totalPending').textContent) || 0, totalPending, 500);
    animateValue('totalRejected', parseInt(document.getElementById('totalRejected').textContent) || 0, totalRejected, 500);
    
    document.getElementById('acceptRate').textContent = acceptanceRate + '%';

    // Calculate best time (grouped by Day and IST Hour for simplicity)
    const timeStats = {};
    entries.forEach(entry => {
        if (!entry.istDateTime) return;
        
        // Extract the day and hour for grouping
        const day = entry.day;
        const istHour = entry.istDateTime.split('T')[1].split(':')[0]; 
        const key = `${day} ${istHour}:00 IST`;

        if (!timeStats[key]) {
            timeStats[key] = { sent: 0, accepted: 0 };
        }
        timeStats[key].sent += parseInt(entry.requestsSent) || 0;
        timeStats[key].accepted += parseInt(entry.accepted) || 0;
    });

    let bestTime = 'Need at least 10 requests per time slot';
    let bestRate = 0;

    Object.entries(timeStats).forEach(([key, stat]) => {
        if (stat.sent >= 10) {
            const rate = (stat.accepted / stat.sent) * 100;
            if (rate > bestRate) {
                bestRate = rate;
                bestTime = `${key} (${rate.toFixed(1)}% acceptance)`;
            }
        }
    });

    document.getElementById('bestTime').textContent = bestTime;
}

// --- Animate Value (Keep as is) ---
function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if ((increment > 0 && current >= end) || (increment < 0 && current <= end)) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.round(current);
    }, 16);
}

// --- Export Data (Modified for new fields) ---
function exportData() {
    // ... (Stats calculation remains the same for the summary) ...
    const totalSent = entries.reduce((sum, e) => sum + (parseInt(e.requestsSent) || 0), 0);
    const totalAccepted = entries.reduce((sum, e) => sum + (parseInt(e.accepted) || 0), 0);
    const totalPending = entries.reduce((sum, e) => sum + (parseInt(e.pending) || 0), 0);
    const totalRejected = entries.reduce((sum, e) => sum + (parseInt(e.rejected) || 0), 0);
    const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;
    
    const csvContent = [
        'IST Date,IST Time,Day,EST Time,PST Time,BST Time,Requests Sent,Accepted,Pending,Rejected,Acceptance Rate',
        ...entries.map(e => {
            const rate = e.requestsSent > 0 ? ((e.accepted / e.requestsSent) * 100).toFixed(1) : 0;
            const [datePart, timePart] = e.istDateTime ? e.istDateTime.split('T') : ['N/A', 'N/A'];
            return `${datePart},${timePart},${e.day},"${e.estTime}","${e.pdtTime}","${e.bstTime}",${e.requestsSent},${e.accepted},${e.pending},${e.rejected},${rate}%`;
        }),
        '',
        `Total,,,,,,${totalSent},${totalAccepted},${totalPending},${totalRejected},${acceptanceRate}%`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linkedin_timing_analysis_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    // Show success feedback
    const btn = event.target.closest('.btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Exported!';
    btn.style.background = '#16a34a';
    
    setTimeout(() => {
        btn.innerHTML = originalText;
        btn.style.background = '';
    }, 2000);
}

// Initialize on page load
window.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadData();
});
