
/**
 * ChartEngine Core v3.0 (Persistent Global State)
 * 
 * Features:
 * 1. Deterministic Price Generation: P(t) ensures identical history for all users.
 * 2. Persistent State: Reloading the page resumes the chart from the exact correct time/price.
 * 3. Physics Integration: Admin signals interact with the deterministic trend.
 */
class ChartEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');

        // --- Core State ---
        this.candles = [];
        this.currentCandle = null;

        // --- Persistence Config ---
        this.basePrice = 65420.50;
        this.candleTime = 8000; // 8 seconds per candle
        this.maxCandles = 60;   // Viewport width
        this.zoom = 1.5;

        // --- Physics State ---
        this.momentum = 0;
        this.botSignal = 'NEUTRAL';
        this.volatility = 1.0;


        // --- Interaction State ---
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseOver = false;

        // --- Live Price State ---
        // We start with the deterministic price, then physics takes over for "Live" feel
        this.price = this.getDeterministicPrice(Date.now());

        this.init();
    }

    init() {
        console.log("ChartEngine v3: Initializing Persistent State...");
        this.resize();

        window.addEventListener('resize', () => this.resize());

        // Mouse Listeners
        this.canvas.addEventListener('mousemove', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - rect.left;
            this.mouseY = e.clientY - rect.top;
            this.isMouseOver = true;
        });
        this.canvas.addEventListener('mouseleave', () => {
            this.isMouseOver = false;
        });

        // 1. Generate History based on PAST Timestamps
        this.seedHistory();

        // 2. Align Current Candle to the global 8s Grid
        // This ensures everyone's candles open/close at the exact same millisecond
        this.alignCandleToGrid();

        // 3. Start Loop
        this.lastFrame = Date.now();
        this.loop();
    }

    resize() {
        if (this.canvas && this.canvas.parentElement) {
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.canvas.height = this.canvas.parentElement.clientHeight;
        }
    }

    /**
     * THE MAGICAL DETERMINISTIC FUNCTION P(t)
     * Returns the "Market Maker" price for any given timestamp.
     * Guaranteed to return the same value for the same time, forever.
     */
    getDeterministicPrice(time) {
        // Convert to seconds for easier math
        const t = time / 1000;

        // 1. Macro Trend (Very Slow, Multi-Hour waves)
        const macro = Math.sin(t / 3600) * 500;

        // 2. Micro Trend (Minutes)
        const micro = Math.sin(t / 300) * 50;

        // 3. Volatility/Noise (Seconds)
        // A simple pseudo-random hash based on time bucket
        const noise = (Math.sin(t * 0.5) + Math.cos(t * 0.2)) * 10;

        return this.basePrice + macro + micro + noise;
    }

    seedHistory() {
        const now = Date.now();
        const historyCount = 200; // Look back 200 candles (~26 minutes)

        this.candles = [];

        for (let i = historyCount; i > 0; i--) {
            // Calculate the specific time window for this past candle
            const endTime = now - (i * this.candleTime);
            const startTime = endTime - this.candleTime;

            // Generate deterministic OHLC for this window
            // We sample a few points to fake "High" and "Low"
            const open = this.getDeterministicPrice(startTime);
            const close = this.getDeterministicPrice(endTime);
            const mid = this.getDeterministicPrice(startTime + (this.candleTime / 2));

            const high = Math.max(open, close, mid) + (Math.abs(open - close) * 0.2);
            const low = Math.min(open, close, mid) - (Math.abs(open - close) * 0.2);

            this.candles.push({ o: open, h: high, l: low, c: close, time: endTime });
        }

        // Set current live price to the end of history to ensure seamless join
        this.price = this.candles[this.candles.length - 1].c;
    }

    alignCandleToGrid() {
        const now = Date.now();
        // Calculate where we are in the current 8s block
        const remainder = now % this.candleTime;
        const candleStart = now - remainder;

        this.currentCandle = {
            o: this.price,
            h: this.price,
            l: this.price,
            c: this.price,
            start: candleStart
        };
    }

    // --- EXTERNAL CONTROLS ---
    setBotSignal(signal) {
        this.botSignal = signal;
        // Instant Feedback
        if (signal === 'UP') this.momentum += 0.1;
        if (signal === 'DOWN') this.momentum -= 0.1;
    }

    setVolatility(val) { this.volatility = val || 1.0; }

    // --- PHYSICS ENGINE ---
    updatePhysics(dt) {
        // 1. Get the "Market Gravity" (Where the chart WANTS to be based on date)
        const targetPrice = this.getDeterministicPrice(Date.now());

        // 2. Calculate Pull towards Deterministic Path (Elasticity)
        // If neutral, we drift back to the "Real" market price.
        // If boosted, we can deviatet but eventualy gravity pulls us back.
        let drift = (targetPrice - this.price) * 0.05; // 5% pull per tick

        // 3. Apply Admin Signal / Physics Override
        let activeForce = 0;
        if (this.botSignal === 'UP') activeForce = 1.5 * this.volatility;
        if (this.botSignal === 'DOWN') activeForce = -1.5 * this.volatility;

        if (this.botSignal !== 'NEUTRAL') {
            // When signal is active, physics OVERRIDES the deterministic drift
            // We use Lerp for smooth acceleration
            this.momentum = this.lerp(this.momentum, activeForce, 0.05);
        } else {
            // When neutral, momentum decays and we stick to the "Global Market"
            this.momentum *= 0.95;
            this.momentum += drift; // Add the gravity
        }

        // 4. Update Live Price
        this.price += this.momentum;

        // 5. Update Candle Bounds
        if (this.price > this.currentCandle.h) this.currentCandle.h = this.price;
        if (this.price < this.currentCandle.l) this.currentCandle.l = this.price;
        this.currentCandle.c = this.price;

        // 6. Candle Lifecycle (Grid Based)
        const now = Date.now();
        // Check if we passed the "Next Candle" boundary
        if (now >= this.currentCandle.start + this.candleTime) {
            this.candles.push({ ...this.currentCandle });
            if (this.candles.length > 500) this.candles.shift();

            // Start exact new candle
            const nextStart = this.currentCandle.start + this.candleTime;
            this.currentCandle = {
                o: this.price,
                h: this.price,
                l: this.price,
                c: this.price,
                start: nextStart
            };
        }
    }

    // --- RENDER ENGINE (Unchanged from v2) ---
    draw() {
        if (!this.ctx) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        const visibleCount = Math.floor(60 / this.zoom);
        const visibleCandles = this.candles.slice(-visibleCount);
        visibleCandles.push(this.currentCandle);

        let min = Infinity, max = -Infinity;
        visibleCandles.forEach(c => {
            if (c.l < min) min = c.l;
            if (c.h > max) max = c.h;
        });

        let range = max - min;
        if (range < 1) range = 1;
        min -= range * 0.2;
        max += range * 0.2;
        range = max - min;

        const mapY = (val) => h - ((val - min) / range) * h;
        const candleWidth = w / (visibleCount + 2);

        this.drawGrid(w, h); // Pro Grid

        visibleCandles.forEach((c, i) => {
            const x = i * candleWidth;
            const yO = mapY(c.o);
            const yC = mapY(c.c);
            const yH = mapY(c.h);
            const yL = mapY(c.l);

            const isGreen = c.c >= c.o;
            this.ctx.fillStyle = isGreen ? '#00b894' : '#ff6b6b';
            this.ctx.strokeStyle = isGreen ? '#00b894' : '#ff6b6b';

            this.ctx.lineWidth = 1.5;
            this.ctx.beginPath();
            this.ctx.moveTo(x + candleWidth / 2, yH);
            this.ctx.lineTo(x + candleWidth / 2, yL);
            this.ctx.stroke();

            const bodyH = Math.max(1, Math.abs(yC - yO));
            const bodyY = Math.min(yO, yC);
            this.ctx.fillRect(x + 2, bodyY, candleWidth - 4, bodyH);
        });

        // Price Line
        const currentY = mapY(this.price);

        // Pulse
        this.ctx.shadowBlur = 10;
        this.ctx.shadowColor = this.price >= this.currentCandle.o ? '#00b894' : '#ff6b6b';
        this.ctx.fillStyle = this.ctx.shadowColor;
        this.ctx.beginPath();
        this.ctx.arc(w - 5, currentY, 4, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.shadowBlur = 0;

        this.ctx.strokeStyle = this.ctx.fillStyle;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, currentY);
        this.ctx.lineTo(w, currentY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        const priceLabel = document.getElementById('priceLineDisplay');
        if (priceLabel) {
            priceLabel.style.top = (currentY - 10) + 'px';
            priceLabel.innerText = this.price.toFixed(2);
            priceLabel.style.backgroundColor = this.price >= this.currentCandle.o ? '#00b894' : '#ff6b6b';
        }

        // Draw Crosshair on top
        this.drawCrosshair(w, h, mapY, min, range);
    }

    drawGrid(w, h) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)'; // Brighter Grid
        this.ctx.lineWidth = 1;

        // Vertical Lines (Time)
        for (let i = 0; i < 12; i++) {
            const x = (w / 12) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, h);
            this.ctx.stroke();
        }

        // Horizontal Lines (Price)
        for (let i = 0; i < 8; i++) {
            const y = (h / 8) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(w, y);
            this.ctx.stroke();
        }
    }

    drawCrosshair(w, h, mapY, min, range) {
        if (!this.isMouseOver) return;

        const x = this.mouseX;
        const y = this.mouseY;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        this.ctx.lineWidth = 1;
        this.ctx.setLineDash([4, 4]);

        // Vert
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
        // Horz
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();

        this.ctx.setLineDash([]);

        // Labels
        // Price Label (Y-Axis)
        const priceVal = min + (range * (1 - (y / h)));
        const priceTxt = priceVal.toFixed(2);

        this.ctx.fillStyle = '#1e2330';
        this.ctx.fillRect(w - 70, y - 10, 70, 20);
        this.ctx.fillStyle = '#fff';
        this.ctx.font = '11px JetBrains Mono';
        this.ctx.fillText(priceTxt, w - 60, y + 4);

        // Time Label (X-Axis) - Approximate
        // We just show a dynamic timestamp relative to mouse X
        const timeOffset = (x / w) * (60 * 1000); // visible window approx 60s
        const date = new Date(Date.now() - 30000 + timeOffset); // Relative
        const timeTxt = date.toLocaleTimeString().split(' ')[0]; // HH:MM:SS

        this.ctx.fillStyle = '#1e2330';
        this.ctx.fillRect(x - 30, h - 20, 60, 20);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(timeTxt, x - 25, h - 6);
    }

    lerp(start, end, amt) {
        return (1 - amt) * start + amt * end;
    }

    loop() {
        requestAnimationFrame(() => this.loop());

        const now = Date.now();
        const dt = (now - this.lastFrame) / 1000;
        this.lastFrame = now;

        this.updatePhysics(dt);
        this.draw();
    }
}

// Global Export
window.ChartEngine = ChartEngine;
