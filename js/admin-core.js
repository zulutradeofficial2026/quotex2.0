// --- ADMIN CORE LOGIC ---
// Handles Authentication, Realtime Database listeners, and UI updates.

const db = initFirebaseApp().database();
const auth = firebase.auth();

// --- STATE MANAGEMENT ---
let currentUser = null;

// --- AUTHENTICATION BYPASS (UNTIL LAUNCH) ---
// Immediately bypass authentication when DOM loads
document.addEventListener('DOMContentLoaded', function () {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        // Hide login overlay immediately - bypass authentication
        loginOverlay.style.display = 'none';
        console.log("⚠️ ADMIN AUTH BYPASSED - Development Mode");
        // Set a fake current user to allow actions
        currentUser = { email: 'admin@bypass.dev', uid: 'bypass-mode' };
        setTimeout(() => startListeners(), 100); // Start listeners without authentication
    }
});

// Also run immediately in case DOM is already loaded
setTimeout(function () {
    const loginOverlay = document.getElementById('loginOverlay');
    if (loginOverlay) {
        loginOverlay.style.display = 'none';
        console.log("⚠️ ADMIN AUTH BYPASSED - Development Mode (Immediate)");
        currentUser = { email: 'admin@bypass.dev', uid: 'bypass-mode' };
        if (typeof startListeners === 'function') {
            startListeners();
        }
    }
}, 0);

auth.onAuthStateChanged((user) => {
    if (user) {
        currentUser = user;
        console.log("Logged in as:", user.email);
        loginOverlay.style.display = 'none';
        startListeners(); // ONLY start listening to sensitive data if logged in
    } else {
        // In bypass mode, keep overlay hidden
        if (loginOverlay) {
            loginOverlay.style.display = 'none';
        }
    }
});

function login() {
    const email = document.getElementById('adminEmail').value;
    const pass = document.getElementById('adminPass').value;
    const btn = document.querySelector('.login-box button');

    // Bypass mode - accept any credentials
    console.log("Login bypassed - auto-granting access");
    if (loginOverlay) loginOverlay.style.display = 'none';
    currentUser = { email: email || 'admin@bypass.dev', uid: 'bypass-mode' };
    startListeners();
    return;

    // Original Firebase auth (commented out for bypass)
    /*
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
    */
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
    db.ref('settings/walletAddress').once('value').then(snap => {
        if (snap.val()) document.getElementById('walletInput').value = snap.val();
    });
}

// --- ACTIONS ---
window.sendSignal = function (type) {
    if (!currentUser) return;
    db.ref('control/signal').set(type)
        .catch(err => alert("Error setting signal: " + err.message));
};

window.processWithdrawal = function (id, status) {
    if (!currentUser) return;
    if (!confirm(`Are you sure you want to mark this as ${status}?`)) return;

    db.ref('withdrawals/' + id).update({ status: status })
        .then(() => console.log("Withdrawal updated"))
        .catch(err => alert("Error updating withdrawal: " + err.message));
};

window.saveSettings = function () {
    if (!currentUser) return;
    const addr = document.getElementById('walletInput').value;
    db.ref('settings/walletAddress').set(addr)
        .then(() => alert('Wallet Address Updated Successfully!'))
        .catch(err => alert("Error saving settings: " + err.message));
};

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
