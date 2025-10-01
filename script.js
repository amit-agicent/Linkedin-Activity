/* ===================================== */
/* script.js - Modified for Google Sheets */
/* ===================================== */

// 🛑 IMPORTANT: PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT URL HERE
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRuvU7ipi7gq1aSRDuJ6C2hP6WaTHnYVbQt1ROpy-sve_rZIBlGp28no_2GVBOWXTgAg/exec'; 
let entries = [];
let nextId = 1;
let isSaving = false; // Flag to prevent rapid-fire saves

// --- API Communication Functions ---

/**
 * Communicates with the Google Apps Script endpoint.
 */
async function apiCall(action, entry = null) {
    try {
        const response = await fetch(APP_SCRIPT_URL, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            // Apps Script requires the payload in a specific format
            body: JSON.stringify({ action, entry })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        return await response.json();

    } catch (error) {
        console.error("API Call Failed:", action, entry, error);
        alert(`Failed to communicate with Google Sheet. Please check the console and your deployed script settings. Error: ${error.message}`);
        return { success: false };
    }
}

/**
 * Fetches all data from the Google Sheet.
 */
async function loadData() {
    try {
        const response = await fetch(APP_SCRIPT_URL);
        const json = await response.json();
        
        if (json.success) {
            entries = json.data.map(e => ({
                // Ensure ID and request counts are treated as numbers
                ...e,
                id: parseInt(e.id) || 0,
                requestsSent: parseInt(e.requestsSent) || 0,
                accepted: parseInt(e.accepted) || 0,
                pending: parseInt(e.pending) || 0,
                rejected: parseInt(e.rejected) || 0
            }));
            
            if (entries.length > 0) {
                // Determine the next sequential ID
                nextId = Math.max(...entries.map(e => e.id)) + 1;
            } else {
                nextId = 1;
            }
            
            if (entries.length === 0) {
                // Initialize with one blank entry if the sheet is empty
                addEntry(false); 
            }

        } else {
            console.error("Failed to load data from sheet:", json.error);
            addEntry(false);
        }
    } catch (e) {
        console.error("Error fetching data:", e);
        // Show the initial entry on failure but alert the user
        addEntry(false);
        alert("Warning: Could not load data from Google Sheet. Data will not be saved.");
    }
    renderTable();
    updateStats();
}


// --- Time Zone Calculation Logic (IST -> Day, EST, PDT, BST) ---

/**
 * Calculates day and time for target time zones based on an IST date/time.
 * @param {string} istDateTimeString - A string combining date and time (e.g., "2025-10-01T20:30").
 * @returns {object} Calculated time zone strings.
 */
function calculateTimeZones(istDateTimeString) {
    if (!istDateTimeString) {
        return { day: '', est: '', pdt: '', bst: '' };
    }

    const [datePart, timePart] = istDateTimeString.split('T');
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    
    // Create a Date object assuming the time input is IST (UTC+5:30)
    // We create the UTC date and then subtract 5.5 hours (330 minutes) to get the true universal time (UTC)
    const istDate = new Date(Date.UTC(year, month - 1, day, hour, minute));
    istDate.setUTCMinutes(istDate.getUTCMinutes() - 330); 

    // Formatting options for time zones
    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short', 
    };
    
    // Day formatting
    const dayOptions = { weekday: 'long' };
    const istDay = istDate.toLocaleString('en-US', dayOptions);

    // Time Zone Conversions
    const timeZones = [
        { zone: 'America/New_York', key: 'est' },   // EST/EDT
        { zone: 'America/Los_Angeles', key: 'pdt' }, // PST/PDT
        { zone: 'Europe/London', key: 'bst' }       // GMT/BST
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

// --- Dark Mode Toggle (Kept as is) ---
function toggleDarkMode() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ?
