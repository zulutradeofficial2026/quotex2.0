/**
 * ChartEngine Core v4.0 (Liquidity + Fixes + Deterministic)
 */
class ChartEngine {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        this.ctx = this.canvas.getContext('2d');

        // State
        this.candles = [];
        this.currentCandle = null;
        this.price = 0;

        // Config
        this.basePrice = 65420.50;
        this.candleTime = 8000;
        this.zoom = 1.5;

        // Physics
        this.momentum = 0;
        this.botSignal = 'NEUTRAL';
        this.volatility = 1.0;

        // Interaction
        this.mouseX = 0;
        this.mouseY = 0;
        this.isMouseOver = false;

        this.init();
    }

    // ---------------- CORE LIFECYCLE ----------------

    init() {
        console.log("ChartEngine v4: Init starting...");
        if (!this.canvas) {
            console.error("ChartEngine: Canvas NOT found!");
            return;
        }
        this.resize();
        console.log("ChartEngine: Initial resize done, dims:", this.canvas.width, this.canvas.height);
        window.addEventListener('resize', () => {
            this.resize();
            console.log("ChartEngine: Window resized, new dims:", this.canvas.width, this.canvas.height);
        });

        // Mouse Listeners
        this.canvas.addEventListener('mousemove', (e) => {
            const r = this.canvas.getBoundingClientRect();
            this.mouseX = e.clientX - r.left;
            this.mouseY = e.clientY - r.top;
            this.isMouseOver = true;
        });
        this.canvas.addEventListener('mouseleave', () => this.isMouseOver = false);

        // 1. Initial Price
        this.price = this.getDeterministicPrice(Date.now());

        // 2. Generate History
        this.seedHistory();

        // 3. Align Grid
        this.alignCandleToGrid();

        // 4. Start Loop
        this.lastFrame = Date.now();
        this.loop();
    }

    resize() {
        if (this.canvas.parentElement) {
            this.canvas.width = this.canvas.parentElement.clientWidth;
            this.canvas.height = this.canvas.parentElement.clientHeight;
        }
    }

    // ---------------- DETERMINISTIC LOGIC ----------------

    getDeterministicPrice(time) {
        const t = time / 1000;
        // Mathematical Market Maker
        const macro = Math.sin(t / 3600) * 500;
        const micro = Math.sin(t / 300) * 50;
        const noise = (Math.sin(t * 0.5) + Math.cos(t * 0.2)) * 10;
        return this.basePrice + macro + micro + noise;
    }

    seedHistory() {
        // Look back 200 candles
        const now = Date.now();
        this.candles = [];

        for (let i = 200; i > 0; i--) {
            const end = now - (i * this.candleTime);
            const start = end - this.candleTime;

            const o = this.getDeterministicPrice(start);
            const c = this.getDeterministicPrice(end);
            const mid = this.getDeterministicPrice(start + this.candleTime / 2); // Volatility factor

            // Fake High/Low based on O/C
            const h = Math.max(o, c, mid) + Math.abs(o - c) * 0.2;
            const l = Math.min(o, c, mid) - Math.abs(o - c) * 0.2;

            this.candles.push({ o, h, l, c, start, time: end });
        }

        // Ensure seamless join
        if (this.candles.length > 0) {
            this.price = this.candles[this.candles.length - 1].c;
        }
    }

    alignCandleToGrid() {
        const now = Date.now();
        const rem = now % this.candleTime;
        this.currentCandle = {
            o: this.price, h: this.price, l: this.price, c: this.price,
            start: now - rem
        };
    }

    // ---------------- PHYSICS & UPDATE ----------------

    updatePhysics(dt) {
        // Target
        const target = this.getDeterministicPrice(Date.now());
        const drift = (target - this.price) * 0.05;

        // Admin Signal Override
        let force = 0;
        if (this.botSignal === 'UP') force = 1.5 * this.volatility;
        if (this.botSignal === 'DOWN') force = -1.5 * this.volatility;

        if (this.botSignal !== 'NEUTRAL') {
            this.momentum = this.lerp(this.momentum, force, 0.05);
        } else {
            this.momentum *= 0.95; // Decay
            this.momentum += drift;
        }

        this.price += this.momentum;

        // Update Current Candle
        if (this.price > this.currentCandle.h) this.currentCandle.h = this.price;
        if (this.price < this.currentCandle.l) this.currentCandle.l = this.price;
        this.currentCandle.c = this.price;

        // Cycle
        const now = Date.now();
        if (now >= this.currentCandle.start + this.candleTime) {
            this.candles.push({ ...this.currentCandle });
            if (this.candles.length > 300) this.candles.shift();

            const nextStart = this.currentCandle.start + this.candleTime;
            this.currentCandle = {
                o: this.price, h: this.price, l: this.price, c: this.price,
                start: nextStart
            };
        }
    }

    lerp(a, b, t) { return a + (b - a) * t; }

    loop() {
        requestAnimationFrame(() => this.loop());

        // Auto-fix zero or default size
        if (this.canvas.width === 0 || (this.canvas.width === 300 && this.canvas.parentElement && this.canvas.parentElement.clientWidth !== 300)) {
            this.resize();
        }

        const now = Date.now();
        const dt = (now - this.lastFrame) / 1000;
        this.lastFrame = now;

        this.updatePhysics(dt);
        this.draw();
    }

    // ---------------- RENDER ENGINE ----------------

    draw() {
        if (!this.ctx) {
            if (!this.drawErrorLogged) {
                console.error("ChartEngine: Context is NULL");
                this.drawErrorLogged = true;
            }
            return;
        }
        if (this.canvas.width === 0) return;

        const w = this.canvas.width;
        const h = this.canvas.height;
        this.ctx.clearRect(0, 0, w, h);

        // 1. Calculate Viewport
        const visCount = Math.floor(60 / this.zoom);
        const visible = this.candles.slice(-visCount);
        visible.push(this.currentCandle);

        if (visible.length === 0) {
            if (!this.visibleErrorLogged) {
                console.warn("ChartEngine: No visible candles to draw");
                this.visibleErrorLogged = true;
            }
            return;
        }

        // 2. Scale
        let min = Infinity, max = -Infinity;
        visible.forEach(c => { if (c.l < min) min = c.l; if (c.h > max) max = c.h; });
        let range = max - min;
        if (range < 1) range = 1;
        min -= range * 0.2; max += range * 0.2; range = max - min;
        const mapY = (v) => h - ((v - min) / range) * h;
        const cW = w / (visCount + 2);

        // 3. Grid
        this.drawGrid(w, h);

        // 4. Draw Candles & LIQUIDITY VOID LABELS
        // Calculate average body size for detection
        let totalBody = 0;
        visible.forEach(c => totalBody += Math.abs(c.c - c.o));
        const avgBody = totalBody / visible.length;

        visible.forEach((c, i) => {
            const x = i * cW;
            const yO = mapY(c.o);
            const yC = mapY(c.c);
            const yH = mapY(c.h);
            const yL = mapY(c.l);

            const isGreen = c.c >= c.o;
            this.ctx.fillStyle = isGreen ? '#00b894' : '#ff6b6b';
            this.ctx.strokeStyle = this.ctx.fillStyle;

            // Wick
            this.ctx.beginPath(); this.ctx.moveTo(x + cW / 2, yH); this.ctx.lineTo(x + cW / 2, yL); this.ctx.stroke();
            // Body
            const bodyH = Math.max(1, Math.abs(yC - yO));
            this.ctx.fillRect(x + 2, Math.min(yO, yC), cW - 4, bodyH);

            // --- LIQUIDITY VOID DETECTOR ---
            // "Imbalance" = Huge body (> 2.5x average)
            if (bodyH > avgBody * 2.5 && bodyH > 20) {
                this.drawVoidLabel(x, isGreen ? yH : yL, isGreen, cW);
            }
        });

        // 5. Price Line
        const curY = mapY(this.price);
        this.ctx.strokeStyle = this.price >= this.currentCandle.o ? '#00b894' : '#ff6b6b';
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath(); this.ctx.moveTo(0, curY); this.ctx.lineTo(w, curY); this.ctx.stroke();
        this.ctx.setLineDash([]);

        // 6. Crosshair (Interaction)
        this.drawCrosshair(w, h, mapY, min, range);

        // 7. HTML Price Tag Update
        const pl = document.getElementById('priceLineDisplay');
        if (pl) {
            pl.style.top = (curY - 10) + 'px';
            pl.innerText = this.price.toFixed(2);
            pl.style.backgroundColor = this.ctx.strokeStyle;
        }
    }

    drawGrid(w, h) {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        this.ctx.lineWidth = 1;
        // Vert
        for (let i = 0; i < w; i += w / 12) {
            this.ctx.beginPath(); this.ctx.moveTo(i, 0); this.ctx.lineTo(i, h); this.ctx.stroke();
        }
        // Horz
        for (let i = 0; i < h; i += h / 8) {
            this.ctx.beginPath(); this.ctx.moveTo(0, i); this.ctx.lineTo(w, i); this.ctx.stroke();
        }
    }

    drawVoidLabel(x, y, isBuy, colW) {
        this.ctx.save();
        this.ctx.font = '10px sans-serif';
        this.ctx.shadowColor = 'rgba(0,0,0,0.5)';
        this.ctx.shadowBlur = 4;
        this.ctx.fillStyle = isBuy ? '#00b894' : '#ff6b6b';

        // Draw small indicator box/text
        const txt = isBuy ? "IMBALANCE" : "IMBALANCE";
        const txtW = this.ctx.measureText(txt).width;
        const textX = x + colW / 2 - txtW / 2;
        const textY = isBuy ? y - 8 : y + 15;

        this.ctx.fillText(txt, textX, textY);
        this.ctx.restore();
    }

    drawCrosshair(w, h, mapY, min, range) {
        if (!this.isMouseOver) return;
        const x = this.mouseX;
        const y = this.mouseY;

        // Draw Lines
        this.ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        this.ctx.setLineDash([2, 2]);
        this.ctx.beginPath(); this.ctx.moveTo(x, 0); this.ctx.lineTo(x, h); this.ctx.stroke();
        this.ctx.beginPath(); this.ctx.moveTo(0, y); this.ctx.lineTo(w, y); this.ctx.stroke();
        this.ctx.setLineDash([]);

        // Labels
        const price = min + (range * (1 - y / h));
        const timeOffset = (x / w) * 60; // 60 sec window

        this.ctx.fillStyle = '#1e2330';
        this.ctx.fillRect(w - 60, y - 10, 60, 20);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText(price.toFixed(2), w - 55, y + 4);

        this.ctx.fillStyle = '#1e2330';
        this.ctx.fillRect(x - 20, h - 15, 40, 15);
        this.ctx.fillStyle = '#fff';
        this.ctx.fillText("00:" + Math.floor(timeOffset), x - 15, h - 4);
    }

    // Helper to control bot
    setBotSignal(s) { this.botSignal = s; }
    setVolatility(v) { this.volatility = v; }
}
