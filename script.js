/* ===================================== */
/* script.js - Modified for Google Sheets */
/* ===================================== */

// 🛑 IMPORTANT: PASTE YOUR DEPLOYED GOOGLE APPS SCRIPT URL HERE
const APP_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwRuvU7ipi7gq1aSRDuJ6C2hP6WaTHnYVbQt1ROpy-sve_rZIBlGp28no_2GVBOWXTgAg/exec'; 

document.addEventListener("DOMContentLoaded", () => {
    loadData();
    applySavedTheme();
});

// ----------------- Dark Mode -----------------
function toggleDarkMode() {
    const html = document.documentElement;
    const current = html.getAttribute("data-theme");
    const next = current === "light" ? "dark" : "light";
    html.setAttribute("data-theme", next);
    localStorage.setItem("theme", next);
}

function applySavedTheme() {
    const saved = localStorage.getItem("theme") || "light";
    document.documentElement.setAttribute("data-theme", saved);
}

// ----------------- Load Table -----------------
async function loadData() {
    try {
        const res = await fetch(SHEET_API_URL);
        const data = await res.json();
        if (!data.success) throw new Error(data.error);

        renderTable(data.data || []);
        updateStats(data.data || []);
    } catch(err) {
        console.error("Failed to load data:", err);
    }
}

function renderTable(entries) {
    const tbody = document.getElementById("tableBody");
    tbody.innerHTML = "";

    if (!entries.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="12">No data available yet. Add a session to get started!</td></tr>`;
        return;
    }

    entries.forEach(entry => {
        const tr = document.createElement("tr");
        tr.innerHTML = `
            <td>${entry.timestamp ? new Date(entry.timestamp).toLocaleString("en-IN") : ""}</td>
            <td>${entry.timestamp ? new Date(entry.timestamp).toLocaleDateString("en-US", { weekday:'long'}) : ""}</td>
            <td>${entry.ISTTime || ""}</td>
            <td>${entry.ESTTime || ""}</td>
            <td>${entry.PDTTime || ""}</td>
            <td>${entry.BSTTime || ""}</td>
            <td>${entry.requestsSent || 0}</td>
            <td>${entry.accepted || 0}</td>
            <td>${entry.pending || 0}</td>
            <td>${entry.rejected || 0}</td>
            <td>${entry.rate || "0%"}</td>
            <td><button class="delete-btn" onclick="deleteEntry(${entry.id})">🗑️</button></td>
        `;
        tbody.appendChild(tr);
    });
}

// ----------------- Stats -----------------
function updateStats(entries) {
    const totalSent = entries.reduce((acc,e)=> acc + (parseInt(e.requestsSent)||0),0);
    const totalAccepted = entries.reduce((acc,e)=> acc + (parseInt(e.accepted)||0),0);
    const totalPending = entries.reduce((acc,e)=> acc + (parseInt(e.pending)||0),0);
    const rate = totalSent>0 ? ((totalAccepted/totalSent)*100).toFixed(1)+"%" : "0%";

    document.getElementById("totalSent").textContent = totalSent;
    document.getElementById("totalAccepted").textContent = totalAccepted;
    document.getElementById("totalPending").textContent = totalPending;
    document.getElementById("acceptRate").textContent = rate;

    // Find best time (placeholder logic)
    document.getElementById("bestTime").textContent = entries.length ? entries[0].ISTTime || "Data insufficient" : "Data insufficient...";
}

// ----------------- Add Entry -----------------
function addEntry() {
    const now = new Date();
    const newEntry = {
        ISTTime: now.toLocaleTimeString('en-IN',{hour12:false}),
        ESTTime: now.toLocaleTimeString('en-US',{timeZone:'America/New_York', hour12:false}),
        PDTTime: now.toLocaleTimeString('en-US',{timeZone:'America/Los_Angeles', hour12:false}),
        BSTTime: now.toLocaleTimeString('en-GB',{timeZone:'Europe/London', hour12:false}),
        requestsSent: 0,
        accepted: 0,
        pending: 0,
        rejected: 0
    };

    saveEntry("ADD", newEntry);
}

// ----------------- Delete Entry -----------------
function deleteEntry(id) {
    if (!confirm("Are you sure you want to delete this entry?")) return;
    saveEntry("DELETE", { id });
}

// ----------------- Save Entry -----------------
async function saveEntry(action, entry) {
    try {
        const res = await fetch(SHEET_API_URL, {
            method:"POST",
            body: JSON.stringify({ action, entry })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.message);
        loadData();
    } catch(err) {
        console.error("Error saving entry:", err);
        alert("Failed to save entry: "+err.message);
    }
}

// ----------------- Export CSV -----------------
function exportData(e){
    e.preventDefault();
    const table = document.querySelector(".data-table");
    let csv = Array.from(table.rows).map(row => Array.from(row.cells).map(cell => `"${cell.textContent}"`).join(",")).join("\n");
    const blob = new Blob([csv], {type: 'text/csv'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "linkedin_activity.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}


