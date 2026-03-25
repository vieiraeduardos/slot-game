import * as PIXI from "pixi.js"
import { SYMBOL_SIZE, VISIBLE_ROWS } from "../config/reels"

interface Coin {
    g: PIXI.Graphics
    x: number
    y: number
    vx: number
    vy: number
    rot: number
    rotSpeed: number
    scaleX: number       // for flip animation
    scaleDir: number
    alpha: number
    bounces: number
}

interface Confetti {
    g: PIXI.Graphics
    vx: number
    vy: number
    gravity: number
    rotSpeed: number
    alpha: number
    alphaDec: number
}

export class WinAnimation {
    private app: PIXI.Application
    private stage: PIXI.Container
    private fxContainer: PIXI.Container

    private coins: Coin[] = []
    private confetti: Confetti[] = []
    private tickerFn: ((t: PIXI.Ticker) => void) | null = null

    private winSprites: PIXI.Sprite[] = []
    private payline: PIXI.Graphics | null = null
    private timeouts: ReturnType<typeof setTimeout>[] = []

    // For credit count-up
    private countUpInterval: ReturnType<typeof setInterval> | null = null

    constructor(app: PIXI.Application, stage: PIXI.Container) {
        this.app = app
        this.stage = stage
        this.fxContainer = new PIXI.Container()
        this.stage.addChild(this.fxContainer)
    }

    /** Call after all other stage children are added so coins render on top */
    bringToFront() {
        this.stage.removeChild(this.fxContainer)
        this.stage.addChild(this.fxContainer)
    }

    play(
        winSprites: PIXI.Sprite[],
        payline: PIXI.Graphics,
        panelX: number,
        panelY: number,
        panelW: number,
        panelH: number,
        canvasW: number,
        canvasH: number,
        isJackpot: boolean
    ) {
        this.stop()
        this.winSprites = winSprites
        this.payline = payline

        this._flashScreen(panelX, panelY, panelW, panelH)
        this._pulseSymbols(isJackpot)
        this._flashPayline(isJackpot)
        this._spawnCoins(canvasW, canvasH, isJackpot ? 28 : 16)
        this._spawnConfetti(panelX, panelY, panelW, isJackpot ? 80 : 40)
        this._startTicker(canvasH)

        this.timeouts.push(setTimeout(() => this.stop(), isJackpot ? 4500 : 3200))
    }

    stop() {
        this.timeouts.forEach(t => clearTimeout(t))
        this.timeouts = []

        if (this.tickerFn) {
            this.app.ticker.remove(this.tickerFn)
            this.tickerFn = null
        }

        if (this.countUpInterval) {
            clearInterval(this.countUpInterval)
            this.countUpInterval = null
        }

        this.fxContainer.removeChildren()
        this.coins = []
        this.confetti = []

        for (const s of this.winSprites) {
            s.scale.set(1)
            s.alpha = 1
        }
        if (this.payline) {
            this.payline.alpha = 0.35
            this.payline.tint = 0xffffff
        }

        this.winSprites = []
        this.payline = null
    }

    // Animated credit count-up — call separately from main.ts
    animateCredits(
        from: number,
        to: number,
        label: PIXI.Text,
        onDone?: () => void
    ) {
        if (this.countUpInterval) clearInterval(this.countUpInterval)

        const diff = to - from
        const steps = 30
        let step = 0

        this.countUpInterval = setInterval(() => {
            step++
            const eased = Math.round(from + diff * (1 - Math.pow(1 - step / steps, 3)))
            label.text = `CREDITS: ${eased}`

            // Flash gold while counting
            label.style.fill = step % 2 === 0 ? 0xffd700 : 0xffffff

            if (step >= steps) {
                clearInterval(this.countUpInterval!)
                this.countUpInterval = null
                label.text = `CREDITS: ${to}`
                label.style.fill = 0xd4af37
                onDone?.()
            }
        }, 40)
    }

    // ─── Flash overlay ─────────────────────────────────────────────────────────

    private _flashScreen(x: number, y: number, w: number, h: number) {
        const flash = new PIXI.Graphics()
        this.fxContainer.addChild(flash)

        let alpha = 0
        let dir = 1
        let count = 0

        const tick = () => {
            alpha += dir * 0.08
            if (alpha >= 0.45) { alpha = 0.45; dir = -1 }
            if (alpha <= 0) {
                alpha = 0; dir = 1; count++
                if (count >= 3) { this.app.ticker.remove(tick); this.fxContainer.removeChild(flash); return }
            }
            flash.clear()
            flash.roundRect(x, y, w, h, 14)
            flash.fill({ color: 0xffd700, alpha })
        }
        this.app.ticker.add(tick)
        this.timeouts.push(setTimeout(() => this.app.ticker.remove(tick), 2500))
    }

    // ─── Symbol pulse ──────────────────────────────────────────────────────────

    private _pulseSymbols(jackpot: boolean) {
        const duration = jackpot ? 3500 : 2500
        const start = performance.now()

        const tick = () => {
            const elapsed = performance.now() - start
            if (elapsed > duration) {
                this.app.ticker.remove(tick)
                for (const s of this.winSprites) { s.scale.set(1); s.alpha = 1 }
                return
            }
            const t = elapsed / duration
            const pulse = 1.0 + (jackpot ? 0.22 : 0.14) * Math.abs(Math.sin(elapsed / (jackpot ? 140 : 180)))
            const alpha = t > 0.8 ? 1 - (t - 0.8) / 0.2 : 1
            for (const s of this.winSprites) {
                s.scale.set(pulse)
                s.alpha = alpha
            }
        }
        this.app.ticker.add(tick)
    }

    // ─── Payline flash ─────────────────────────────────────────────────────────

    private _flashPayline(jackpot: boolean) {
        if (!this.payline) return
        const pl = this.payline
        const colors = jackpot
            ? [0xffd700, 0xffffff, 0xffd700, 0xff8800, 0xffffff]
            : [0xff4444, 0xffd700, 0xff4444, 0xffd700, 0xffffff]
        let ci = 0

        const id = setInterval(() => {
            pl.tint = colors[ci % colors.length]
            pl.alpha = 0.95
            ci++
        }, jackpot ? 120 : 180)

        this.timeouts.push(setTimeout(() => {
            clearInterval(id)
            pl.tint = 0xffffff
            pl.alpha = 0.35
        }, jackpot ? 3500 : 2500))
        this.timeouts.push(id as unknown as ReturnType<typeof setTimeout>)
    }

    // ─── Coins with physics ────────────────────────────────────────────────────

    private _spawnCoins(canvasW: number, canvasH: number, count: number) {
        const spawnY = -20  // start just above canvas

        for (let i = 0; i < count; i++) {
            this.timeouts.push(setTimeout(() => {
                const g = this._drawCoin()
                const cx = canvasW * 0.2 + Math.random() * canvasW * 0.6
                g.x = cx
                g.y = spawnY
                this.fxContainer.addChild(g)

                this.coins.push({
                    g,
                    x: cx,
                    y: spawnY,
                    vx: (Math.random() - 0.5) * 2.5,
                    vy: 2 + Math.random() * 4,
                    rot: Math.random() * Math.PI * 2,
                    rotSpeed: (Math.random() - 0.5) * 0.25,
                    scaleX: 1,
                    scaleDir: Math.random() > 0.5 ? 1 : -1,
                    alpha: 1,
                    bounces: 0,
                })
            }, i * 90 + Math.random() * 60))
        }
    }

    private _drawCoin(): PIXI.Graphics {
        const g = new PIXI.Graphics()
        const r = 10

        // Coin body
        g.circle(0, 0, r)
        g.fill({ color: 0xffd700 })

        // Inner ring
        g.circle(0, 0, r - 2)
        g.stroke({ color: 0xffaa00, width: 1.5 })

        // $ symbol approximation — two vertical lines
        g.rect(-1, -5, 2, 10)
        g.fill({ color: 0xcc8800 })
        g.rect(-4, -2, 8, 1.5)
        g.fill({ color: 0xcc8800 })
        g.rect(-4, 1, 8, 1.5)
        g.fill({ color: 0xcc8800 })

        return g
    }

    // ─── Confetti ──────────────────────────────────────────────────────────────

    private _spawnConfetti(panelX: number, panelY: number, panelW: number, count: number) {
        const colors = [0xffd700, 0xff4444, 0x7c3aed, 0x00e5ff, 0xff69b4, 0x00ff88, 0xff8800]

        for (let i = 0; i < count; i++) {
            this.timeouts.push(setTimeout(() => {
                const color = colors[Math.floor(Math.random() * colors.length)]
                const size = 5 + Math.random() * 7
                const g = new PIXI.Graphics()
                if (Math.random() > 0.4) {
                    g.rect(-size / 2, -size * 0.3, size, size * 0.6)
                } else {
                    g.circle(0, 0, size / 2)
                }
                g.fill({ color })
                g.x = panelX + Math.random() * panelW
                g.y = panelY - 10
                g.rotation = Math.random() * Math.PI * 2
                this.fxContainer.addChild(g)

                this.confetti.push({
                    g,
                    vx: (Math.random() - 0.5) * 4,
                    vy: -1 + Math.random() * 4,
                    gravity: 0.07 + Math.random() * 0.05,
                    rotSpeed: (Math.random() - 0.5) * 0.18,
                    alpha: 1,
                    alphaDec: 0.006 + Math.random() * 0.005,
                })
            }, i * 25))
        }
    }

    // ─── Combined ticker ───────────────────────────────────────────────────────

    private _startTicker(canvasH: number) {
        const floorY = canvasH - 10
        const BOUNCE_DAMPEN = 0.45

        const tick = () => {
            // Coins
            for (let i = this.coins.length - 1; i >= 0; i--) {
                const c = this.coins[i]

                c.vy += 0.35           // gravity
                c.x += c.vx
                c.y += c.vy

                // Bounce off floor
                if (c.y >= floorY && c.bounces < 3) {
                    c.y = floorY
                    c.vy = -Math.abs(c.vy) * BOUNCE_DAMPEN
                    c.vx *= 0.85
                    c.bounces++
                }

                // Flip animation (scaleX oscillates ±1 = coin spinning)
                c.scaleX += c.scaleDir * 0.08
                if (c.scaleX >= 1)  { c.scaleX = 1;  c.scaleDir = -1 }
                if (c.scaleX <= -1) { c.scaleX = -1; c.scaleDir =  1 }

                // Fade after settling
                if (c.bounces >= 3) {
                    c.alpha -= 0.012
                }

                c.g.x = c.x
                c.g.y = c.y
                c.g.scale.set(c.scaleX, 1)
                c.g.rotation += c.rotSpeed
                c.g.alpha = Math.max(0, c.alpha)

                if (c.alpha <= 0) {
                    this.fxContainer.removeChild(c.g)
                    this.coins.splice(i, 1)
                }
            }

            // Confetti
            for (let i = this.confetti.length - 1; i >= 0; i--) {
                const p = this.confetti[i]
                p.g.x += p.vx
                p.g.y += p.vy
                p.vy += p.gravity
                p.g.rotation += p.rotSpeed
                p.alpha -= p.alphaDec
                p.g.alpha = Math.max(0, p.alpha)

                if (p.alpha <= 0) {
                    this.fxContainer.removeChild(p.g)
                    this.confetti.splice(i, 1)
                }
            }
        }

        this.tickerFn = tick
        this.app.ticker.add(tick)
    }
}