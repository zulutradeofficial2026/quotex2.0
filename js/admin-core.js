// --- ADMIN CORE LOGIC ---
// Handles Authentication, Realtime Database listeners, and UI updates.

const db = initFirebaseApp().database();
const auth = firebase.auth();

// --- STATE MANAGEMENT ---
let currentUser = null;

// --- AUTHENTICATION ---
auth.onAuthStateChanged((user) => {
    const loginOverlay = document.getElementById('loginOverlay');
    if (user) {
        currentUser = user;
        console.log("Logged in as:", user.email);
        loginOverlay.style.display = 'none';
        startListeners(); // ONLY start listening to sensitive data if logged in
    } else {
        currentUser = null;
        loginOverlay.style.display = 'flex';
        // Clear sensitive UI
        document.getElementById('withdrawalTable').innerHTML = '';
        document.getElementById('currentSignal').innerText = 'OFFLINE';
    }
});

function login() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;
    const btn = document.querySelector('.login-box button');

    if (!email || !pass) {
        alert("Please enter both email and password.");
        return;
    }

    btn.innerText = "AUTHENTICATING...";

    auth.signInWithEmailAndPassword(email, pass)
        .then(() => {
            btn.innerText = "UNLOCK SYSTEM";
            // onAuthStateChanged will handle the UI switch
        })
        .catch((error) => {
            console.error(error);
            btn.innerText = "UNLOCK SYSTEM";
            alert("Login Failed: " + error.message);
        });
}

function logout() {
    auth.signOut().then(() => {
        location.reload();
    });
}

// --- REALTIME LISTENERS ---
function startListeners() {
    console.log("Starting Realtime Listeners...");

    // 1. MONITOR CONTROL SIGNALS
    db.ref('control/signal').on('value', (snap) => {
        const val = snap.val() || 'NEUTRAL';
        const badge = document.getElementById('currentSignal');
        badge.innerText = val;

        // Color coding for visual clarity
        if (val === 'UP') badge.style.color = 'var(--accent-green)';
        else if (val === 'DOWN') badge.style.color = 'var(--accent-red)';
        else badge.style.color = '#fff';

        // Update button states
        document.querySelectorAll('.control-btn').forEach(b => b.classList.remove('active-signal'));
        if (val === 'UP') document.querySelector('.control-up').classList.add('active-signal');
        if (val === 'DOWN') document.querySelector('.control-down').classList.add('active-signal');
    });

    // 2. MONITOR WITHDRAWALS
    db.ref('withdrawals').on('value', (snap) => {
        const data = snap.val();
        const tbody = document.getElementById('withdrawalTable');
        tbody.innerHTML = ''; // Clear current

        let pendingCount = 0;

        if (data) {
            // Convert pushID object to array, sort by time (newest first)
            const list = Object.keys(data).map(key => ({ id: key, ...data[key] }));
            list.sort((a, b) => b.timestamp - a.timestamp);

            list.forEach(w => {
                if (w.status === 'PENDING') {
                    pendingCount++;
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${new Date(w.timestamp).toLocaleTimeString()}</td>
                        <td>${w.network || 'USDT'}</td>
                        <td class="mono-font">${w.address}</td>
                        <td class="amount-text">$${w.amount}</td>
                        <td><span class="status-badge pending">PENDING</span></td>
                        <td>
                            <button class="action-btn btn-approve" onclick="processWithdrawal('${w.id}', 'APPROVED')">Approve</button>
                            <button class="action-btn btn-reject" onclick="processWithdrawal('${w.id}', 'REJECTED')">Reject</button>
                        </td>
                    `;
                    tbody.appendChild(tr);
                }
            });
        }

        document.getElementById('withCount').innerText = pendingCount;
        document.getElementById('emptyWithdrawals').style.display = pendingCount > 0 ? 'none' : 'block';
    });

    // 3. LOAD SETTINGS
    db.ref('settings/wallets').once('value').then(snap => {
        const wallets = snap.val() || {};
        if (wallets.TRON) document.getElementById('walletInputTRON').value = wallets.TRON;
        if (wallets.ETH) document.getElementById('walletInputETH').value = wallets.ETH;
        if (wallets.BSC) document.getElementById('walletInputBSC').value = wallets.BSC;
        if (wallets.BTC) document.getElementById('walletInputBTC').value = wallets.BTC;
    });
}

// --- ACTIONS ---
window.sendSignal = function (type) {
    if (!currentUser) return alert("Action Blocked: You are not logged in.");
    db.ref('control/signal').set(type)
        .catch(err => alert("Error setting signal: " + err.message));
};

window.processWithdrawal = function (id, status) {
    if (!currentUser) return alert("Action Blocked: You are not logged in.");
    if (!confirm(`Are you sure you want to mark this as ${status}?`)) return;

    db.ref('withdrawals/' + id).update({ status: status })
        .then(() => console.log("Withdrawal updated"))
        .catch(err => alert("Error updating withdrawal: " + err.message));
};

window.saveSettings = function () {
    if (!currentUser) return alert("Action Blocked: You are not logged in.");

    const wallets = {
        TRON: document.getElementById('walletInputTRON').value,
        ETH: document.getElementById('walletInputETH').value,
        BSC: document.getElementById('walletInputBSC').value,
        BTC: document.getElementById('walletInputBTC').value
    };

    db.ref('settings/wallets').set(wallets)
        .then(() => alert('Wallet Addresses Updated Successfully!'))
        .catch(err => alert("Error saving settings: " + err.message));
};

// --- SCHEDULER LOGIC ---
let scheduledTask = null; // { time: "HH:MM", signal: "UP" }

window.scheduleSignal = function () {
    const time = document.getElementById('schedTime').value;
    const sig = document.getElementById('schedSignal').value;

    if (!time) return alert("Please select a time.");

    scheduledTask = { time, signal: sig };

    // UI Update
    document.getElementById('schedStatus').style.display = 'block';
    document.getElementById('schedText').innerText = `${sig} at ${time}`;
    alert(`Signal ${sig} scheduled for ${time}`);
};

window.cancelSchedule = function () {
    scheduledTask = null;
    document.getElementById('schedStatus').style.display = 'none';
};

// Check Time Loop
setInterval(() => {
    if (!scheduledTask) return;

    const now = new Date();
    const currentHM = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
    // Also check seconds to avoid multiple triggers in the same minute

    if (currentHM === scheduledTask.time) {
        console.log("⏰ Executing Scheduled Task:", scheduledTask);
        window.sendSignal(scheduledTask.signal);

        // Notify & Clear
        console.log(`Executed Scheduled Signal: ${scheduledTask.signal}`);
        window.cancelSchedule();
    }
}, 1000); // Check every second

// --- NAVIGATION ---
window.showSection = function (id) {
    document.querySelectorAll('.content-section').forEach(d => d.style.display = 'none');
    document.getElementById(id + 'Section').style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    // Find the nav item that called this (rough heuristic or simplified)
    // For specific UI highlight, we can modify the HTML onclick to pass 'this'
};

// Better Nav Handler
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', function () {
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        this.classList.add('active');

        const sectionId = this.dataset.section;
        if (sectionId) {
            document.querySelectorAll('.content-section').forEach(d => d.style.display = 'none');
            document.getElementById(sectionId).style.display = 'block';
        }
    });
});

// --- VOLATILITY ---
window.setVolatility = function () {
    const val = document.getElementById('volRange').value;
    db.ref('control/speed').set(parseFloat(val))
        .then(() => alert("Speed updated to " + val + "x"))
        .catch(e => alert("Error: " + e.message));
};
