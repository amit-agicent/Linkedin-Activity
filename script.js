/* ===================================== */
/* script.js - Modified for Google Sheets */
/* ===================================== */

// 🛑 IMPORTANT: PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT URL HERE
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRuvU7ipi7gq1aSRDuJ6C2hP6WaTHnYVbQt1ROpy-sve_rZIBlGp28no_2GVBOWXTgAg/exec'; 


let entries = [];
let nextId = 1;
let isSaving = false; 

// --- Utility Functions ---

/**
 * Debounce function to limit the rate of function calls (for saving).
 */
const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(this, args), delay);
    };
};

/**
 * Communicates with the Google Apps Script endpoint.
 */
async function apiCall(action, entry = null) {
    if (!APP_SCRIPT_URL || !APP_SCRIPT_URL.startsWith('http')) {
        console.error("APP_SCRIPT_URL is not set or invalid. Data will not be saved.");
        return { success: false };
    }
    
    try {
        const response = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: JSON.stringify({ action, entry })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error("API Call Failed:", action, entry, error);
        alert(`Failed to communicate with Google Sheet. Error: ${error.message}`);
        return { success: false };
    }
}

// --- Time Zone Calculation Logic (IST -> Day, EST, PDT, BST) ---
function calculateTimeZones(istDateTimeString) {
    if (!istDateTimeString) {
        return { day: '', est: '', pdt: '', bst: '' };
    }

    const [datePart, timePart] = istDateTimeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create a Date object representing the IST moment
    const istDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    istDate.setUTCMinutes(istDate.getUTCMinutes() - 330); // Adjust to true UTC 

    // Formatting options
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short', 
    };
    
    const dayOptions = { weekday: 'long' };
    const istDay = istDate.toLocaleString('en-US', dayOptions);

    const timeZones = [
        { zone: 'America/New_York', key: 'est' },   
        { zone: 'America/Los_Angeles', key: 'pdt' }, 
        { zone: 'Europe/London', key: 'bst' }       
    ];

    const results = { day: istDay };
    
    timeZones.forEach(({ zone, key }) => {
        try {
            const options = { ...timeOptions, timeZone: zone };
            results[key] = istDate.toLocaleString('en-US', options);
        } catch (e) {
            results[key] = 'N/A';
        }
    });
    
    return results;
}

// --- Dark Mode (Keep as is) ---
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
}
function loadTheme() {
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
}

// --- Data CRUD ---

async function loadData() {
    try {
        const response = await fetch(APP_SCRIPT_URL);
        const json = await response.json();
        
        if (json.success) {
            entries = json.data.map(e => ({
                ...e,
                id: parseInt(e.id) || 0,
                // 🛑 FIX: Ensure istDateTime is a string, defaulting to empty string if blank/null
                istDateTime: e.istDateTime ? String(e.istDateTime) : '', 
                requestsSent: parseInt(e.requestsSent) || 0,
                accepted: parseInt(e.accepted) || 0,
                pending: parseInt(e.pending) || 0,
                rejected: parseInt(e.rejected) || 0
            }));
            
            if (entries.length > 0) {
                nextId = Math.max(...entries.map(e => e.id)) + 1;
            } else {
                nextId = 1;
            }
        } else {
            console.error("Failed to load data from sheet:", json.error);
        }
    } catch (e) {
        console.error("Error fetching data:", e);
    }
    
    if (entries.length === 0) {
        addEntry(false); // Add one local entry if database is empty/failed
    }
    renderTable();
    updateStats();
}

async function addEntry(saveToSheet = true) {
    let istDateTime = '';
    let calculatedTimes = { day: '', est: '', pdt: '', bst: '' };
    
    // Auto-populate with current IST time
    const now = new Date();
    const istOffset = 330 * 60000; 
    const utcTime = now.getTime() + (now.getTimezoneOffset() * 60000);
    const istTime = new Date(utcTime + istOffset);
    
    const datePart = istTime.toISOString().split('T')[0];
    const timePart = istTime.toTimeString().slice(0, 5); 
    istDateTime = `${datePart}T${timePart}`;
    calculatedTimes = calculateTimeZones(istDateTime);

    const newEntry = {
        id: nextId, 
        istDateTime: istDateTime,
        day: calculatedTimes.day,
        estTime: calculatedTimes.est,
        pdtTime: calculatedTimes.pdt,
        bstTime: calculatedTimes.bst,
        requestsSent: 0,
        accepted: 0,
        pending: 0,
        rejected: 0
    };
    
    nextId++;

    if (saveToSheet) {
        const response = await apiCall('ADD', newEntry);
        if (response.success) {
            newEntry.id = parseInt(response.entry.id); 
            entries.push(newEntry);
        } else {
            nextId--; 
        }
    } else {
        entries.push(newEntry);
    }

    renderTable();
    updateStats();
    
    setTimeout(() => {
        const lastRow = document.querySelector('#tableBody tr:last-child');
        if (lastRow) {
            lastRow.style.animation = 'slideUp 0.5s ease-out';
        }
    }, 10);
}

async function deleteEntry(id) {
    if (confirm('Are you sure you want to delete this entry?')) {
        const entryToDelete = entries.find(e => e.id === id);
        if (!entryToDelete) return;
        
        const response = await apiCall('DELETE', entryToDelete);
        
        if (response.success) {
            entries = entries.filter(e => e.id !== id);
            renderTable();
            updateStats();
        }
    }
}

// The core saving logic, called by the debounced handler
async function saveEntry(id, field, value) {
    if (isSaving) return; 

    const entry = entries.find(e => e.id === id);
    if (!entry) return;

    // 1. Update the field
    entry[field] = value;

    // 2. Recalculate time zones
    if (field === 'istDateTime') {
        // Ensure that the value passed to calculateTimeZones is valid
        const validValue = value || '';
        const calculatedTimes = calculateTimeZones(validValue);
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
    
    // 4. Save to Sheet
    isSaving = true;
    const response = await apiCall('UPDATE', entry);
    isSaving = false;

    if (response.success) {
        renderTable(); 
        updateStats();
    } 
}

// Public facing function that uses debounce to prevent rapid-fire saves
const debouncedSaveEntry = debounce(saveEntry, 1000); 

function updateEntry(id, field, value) {
    // Pass the arguments to the debounced function
    debouncedSaveEntry(id, field, value);
}

// --- Table Rendering ---
function renderTable() {
    const tbody = document.getElementById('tableBody');
    tbody.innerHTML = entries.map((entry, index) => {
        const sent = parseInt(entry.requestsSent) || 0;
        const accepted = parseInt(entry.accepted) || 0;
        const rate = sent > 0 
            ? ((accepted / sent) * 100).toFixed(1) 
            : 0;
        
        const rateClass = rate >= 30 ? 'rate-high' : rate >= 20 ? 'rate-medium' : 'rate-low';
        
        // 🛑 FIX: Use || '' here to ensure the value attribute is always a string.
        const istDateTimeValue = entry.istDateTime || '';
        const timePart = istDateTimeValue.split('T')[1] || 'N/A';

        return `
            <tr style="animation: fadeIn 0.5s ease-out ${index * 0.1}s backwards">
                <td>
                    <input 
                        type="datetime-local" 
                        value="${istDateTimeValue}"
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

// --- Stats Update (Logic remains the same) ---
function updateStats() {
    const totalSent = entries.reduce((sum, e) => sum + (parseInt(e.requestsSent) || 0), 0);
    const totalAccepted = entries.reduce((sum, e) => sum + (parseInt(e.accepted) || 0), 0);
    const totalPending = entries.reduce((sum, e) => sum + (parseInt(e.pending) || 0), 0);
    const totalRejected = entries.reduce((sum, e) => sum + (parseInt(e.rejected) || 0), 0);
    const acceptanceRate = totalSent > 0 ? ((totalAccepted / totalSent) * 100).toFixed(1) : 0;

    animateValue('totalSent', parseInt(document.getElementById('totalSent').textContent) || 0, totalSent, 500);
    animateValue('totalAccepted', parseInt(document.getElementById('totalAccepted').textContent) || 0, totalAccepted, 500);
    animateValue('totalPending', parseInt(document.getElementById('totalPending').textContent) || 0, totalPending, 500);
    
    document.getElementById('acceptRate').textContent = acceptanceRate + '%';

    const timeStats = {};
    entries.forEach(entry => {
        if (!entry.istDateTime || !entry.day) return;
        
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

// --- Export Data (Keep as is) ---
function exportData(event) {
    const csvContent = [
        'IST Date,IST Time,Day,EST Time,PDT Time,BST Time,Requests Sent,Accepted,Pending,Rejected,Acceptance Rate',
        ...entries.map(e => {
            const sent = parseInt(e.requestsSent) || 0;
            const accepted = parseInt(e.accepted) || 0;
            const rate = sent > 0 ? ((accepted / sent) * 100).toFixed(1) : 0;
            const [datePart, timePart] = e.istDateTime ? e.istDateTime.split('T') : ['N/A', 'N/A'];
            return `${datePart},${timePart},${e.day},"${e.estTime}","${e.pdtTime}","${e.bstTime}",${sent},${accepted},${e.pending},${e.rejected},${rate}%`;
        }),
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'linkedin_timing_analysis_' + new Date().toISOString().split('T')[0] + '.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    
    const btn = event.target.closest('.
