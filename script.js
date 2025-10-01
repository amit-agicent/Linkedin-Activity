/* ===================================== */
/* script.js (Google Sheets Backend) */
/* ===================================== */

const WEB_APP_URL = 'https://script.google.com/macros/s/AKfycbwO22KmGbXkP5sT28w129BT4u9yoIUUc81CeC46B9Mh0RNOuzWjw02vqVK4abScBmc-HQ/exec';

const timeSlots = [
    { ist: '8:00 PM', us: '9:30 AM EST / 6:30 AM PST' },
    { ist: '8:30 PM', us: '10:00 AM EST / 7:00 AM PST' },
    { ist: '9:00 PM', us: '10:30 AM EST / 7:30 AM PST' },
    { ist: '9:30 PM', us: '11:00 AM EST / 8:00 AM PST' },
    { ist: '10:00 PM', us: '11:30 AM EST / 8:30 AM PST' },
    { ist: '11:00 PM', us: '12:30 PM EST / 9:30 AM PST' },
    { ist: '12:00 AM', us: '1:30 PM EST / 10:30 AM PST' },
    { ist: '12:30 AM', us: '2:00 PM EST / 11:00 AM PST' },
];

const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

let entries = [];
let nextId = 1;

// Dark Mode
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);

    const toggle = document.querySelector('.dark-mode-toggle');
    toggle.style.animation = 'none';
    setTimeout(() => { toggle.style.animation = 'float 3s ease-in-out infinite'; }, 10);
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// Fetch data from Google Sheet
async function loadData() {
    try {
        const response = await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'get' }),
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        entries = data.map(e => ({
            id: parseInt(e.id),
            date: e.date || '',
            day: e.day || 'Tuesday',
            istTime: e.istTime || '8:30 PM',
            usTime: e.usTime || '10:00 AM EST / 7:00 AM PST',
            requestsSent: parseInt(e.requestsSent) || 0,
            accepted: parseInt(e.accepted) || 0,
            rejected: parseInt(e.rejected) || 0,
            pending: parseInt(e.pending) || 0
        }));

        nextId = entries.length > 0 ? Math.max(...entries.map(e => e.id)) + 1 : 1;

        if (entries.length === 0) addEntry();
        renderTable();
        updateStats();
    } catch (err) {
        console.error('Error fetching data from Google Sheets:', err);
        addEntry();
    }
}

// Save a single entry to Google Sheet
async function saveEntry(entry) {
    try {
        await fetch(WEB_APP_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'save', entry }),
            headers: { 'Content-Type': 'application/json' }
        });
    } catch (err) {
        console.error('Error saving entry:', err);
    }
}

function addEntry() {
    const newEntry = {
        id: nextId++,
        date: '',
        day: 'Tuesday',
        istTime: '8:30 PM',
        usTime: '10:00 AM EST / 7:00 AM PST',
        requestsSent: 0,
        accepted: 0,
        rejected: 0,
        pending: 0
    };
    entries.push(newEntry);
    saveEntry(newEntry);
    renderTable();
    updateStats();

    setTimeout(() => {
        const lastRow = document.querySelector('#tableBody tr:last-child');
        if (lastRow) lastRow.style.animation = 'slideUp 0.5s ease-out';
    }, 10);
}

function deleteEntry(id) {
    if (!confirm('Are you sure you want to delete this entry?')) return;
    entries = entries.filter(e => e.id !== id);
    saveEntry({ id, deleted: true });
    renderTable();
    updateStats();
}

function updateEntry(id, field, value) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    entry[field] = field === 'requestsSent' || field === 'accepted' || field === 'rejected' ? parseInt(value) || 0 : value;

    if (field === 'istTime') {
        const slot = timeSlots.find(s => s.ist === value);
        entry.usTime = slot ? slot.us : '';
    }

    entry.pending = entry.requestsSent - entry.accepted - entry.rejected;

    saveEntry(entry);
    renderTable();
    updateStats();
}

function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = entries.map((entry, index) => {
        const rate = entry.requestsSent > 0 ? ((entry.accepted / entry.requestsSent) * 100).toFixed(1) : 0;
        const rateClass = rate >= 30 ? 'rate-high' : rate >= 20 ? 'rate-medium' : 'rate-low';

        return `
            <tr style="animation: fadeIn 0.5s ease-out ${index * 0.1}s backwards">
                <td><input type="date" value="${entry.date}" onchange="updateEntry(${entry.id}, 'date', this.value)"></td>
                <td><select onchange="updateEntry(${entry.id}, 'day', this.value)">
                    ${days.map(d => `<option value="${d}" ${entry.day === d ? 'selected' : ''}>${d}</option>`).join('')}
                </select></td>
                <td><select onchange="updateEntry(${entry.id}, 'istTime', this.value)">
                    ${timeSlots.map(s => `<option value="${s.ist}" ${entry.istTime === s.ist ? 'selected' : ''}>${s.ist}</option>`).join('')}
                </select></td>
                <td>${entry.usTime}</td>
                <td><input type="number" value="${entry.requestsSent}" min="0" onchange="updateEntry(${entry.id}, 'requestsSent', this.value)"></td>
                <td><input type="number" value="${entry.accepted}" min="0" onchange="updateEntry(${entry.id}, 'accepted', this.value)"></td>
                <td><span class="pending-value">${entry.pending}</span></td>
                <td><input type="number" value="${entry.rejected}" min="0" onchange="updateEntry(${entry.id}, 'rejected', this.value)"></td>
                <td><span class="${rateClass}">${rate}%</span></td>
                <td><button onclick="deleteEntry(${entry.id})" class="delete-btn" title="Delete entry">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                    </svg>
                </button></td>
            </tr>
        `;
    }).join('');
}

function updateStats() {
    const totalSent = entries.reduce((sum, e) => sum + e.requestsSent, 0);
    const totalAccepted = entries.reduce((sum, e) => sum + e.accepted, 0);
    const totalPending = entries.reduce((sum, e) => sum + e.pending, 0);
    const totalRejected = entries.reduce((sum, e) => sum + e.rejected, 0);
    const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;

    animateValue('totalSent', parseInt(document.getElementById('totalSent').textContent) || 0, totalSent, 500);
    animateValue('totalAccepted', parseInt(document.getElementById('totalAccepted').textContent) || 0, totalAccepted, 500);
    animateValue('totalPending', parseInt(document.getElementById('totalPending').textContent) || 0, totalPending, 500);
    animateValue('totalRejected', parseInt(document.getElementById('totalRejected').textContent) || 0, totalRejected, 500);
    
    document.getElementById('acceptRate').textContent = acceptanceRate + '%';

    // Best performing time
    const timeStats = {};
    entries.forEach(entry => {
        const key = `${entry.day} ${entry.istTime}`;
        if (!timeStats[key]) timeStats[key] = { sent: 0, accepted: 0 };
        timeStats[key].sent += entry.requestsSent;
        timeStats[key].accepted += entry.accepted;
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

// Export CSV (remains local)
function exportData() {
    const totalSent = entries.reduce((sum, e) => sum + e.requestsSent, 0);
    const totalAccepted = entries.reduce((sum, e) => sum + e.accepted, 0);
    const totalPending = entries.reduce((sum, e) => sum + e.pending, 0);
    const totalRejected = entries.reduce((sum, e) => sum + e.rejected, 0);
    const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;

    const csvContent = [
        'Date,Day,IST Time,US Time,Requests Sent,Accepted,Pending,Rejected,Acceptance Rate',
        ...entries.map(e => {
            const rate = e.requestsSent > 0 ? ((e.accepted / e.requestsSent) * 100).toFixed(1) : 0;
            return `${e.date},${e.day},${e.istTime},"${e.usTime}",${e.requestsSent},${e.accepted},${e.pending},${e.rejected},${rate}%`;
        }),
        '',
        `Total,,,${totalSent},${totalAccepted},${totalPending},${totalRejected},${acceptanceRate}%`
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linkedin_timing_analysis_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

// Initialize
window.addEventListener('DOMContentLoaded', () => {
    loadTheme();
    loadData();
});
