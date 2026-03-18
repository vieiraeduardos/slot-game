import * as PIXI from "pixi.js"
import { SYMBOL_SIZE, VISIBLE_ROWS } from "../config/reels"

/**
 * WinAnimation
 * Manages all visual win effects on top of the PIXI stage.
 *
 * Usage:
 *   const fx = new WinAnimation(app, stage)
 *
 *   // Pass the 3 reel symbol containers and the payline Graphics
 *   fx.play(reelSymbolSprites, paylineGraphic)
 *
 *   // Stop early if needed
 *   fx.stop()
 */

interface Particle {
    sprite: PIXI.Graphics
    vx: number
    vy: number
    gravity: number
    rotSpeed: number
    alpha: number
    alphaDec: number
    color: number
}

export class WinAnimation {
    private app: PIXI.Application
    private stage: PIXI.Container

    // Container for all win FX (rendered above reels)
    private fxContainer: PIXI.Container

    private particles: Particle[] = []
    private tickerFn: ((ticker: PIXI.Ticker) => void) | null = null

    // References set on play()
    private winSprites: PIXI.Sprite[] = []
    private payline: PIXI.Graphics | null = null

    // Timers
    private timeouts: ReturnType<typeof setTimeout>[] = []

    constructor(app: PIXI.Application, stage: PIXI.Container) {
        this.app = app
        this.stage = stage

        this.fxContainer = new PIXI.Container()
        this.stage.addChild(this.fxContainer)
    }

    /**
     * @param winSprites  The 3 sprites on the middle (payline) row — one per reel
     * @param payline     The payline Graphics object from main.ts
     * @param panelX      Left edge of the reel panel (for flash overlay positioning)
     * @param panelY      Top edge of the reel panel
     * @param panelW      Width of the reel panel
     * @param panelH      Height of the reel panel
     */
    play(
        winSprites: PIXI.Sprite[],
        payline: PIXI.Graphics,
        panelX: number,
        panelY: number,
        panelW: number,
        panelH: number
    ) {
        this.stop()

        this.winSprites = winSprites
        this.payline = payline

        this._flashScreen(panelX, panelY, panelW, panelH)
        this._pulseSymbols()
        this._flashPayline()
        this._spawnConfetti(panelX, panelY, panelW)
        this._startParticleTicker()

        // Auto-stop after 3 seconds
        this.timeouts.push(setTimeout(() => this.stop(), 3000))
    }

    stop() {
        // Clear all timeouts
        this.timeouts.forEach(t => clearTimeout(t))
        this.timeouts = []

        // Remove ticker
        if (this.tickerFn) {
            this.app.ticker.remove(this.tickerFn)
            this.tickerFn = null
        }

        // Remove all FX children
        this.fxContainer.removeChildren()
        this.particles = []

        // Reset symbol scales and payline
        for (const sprite of this.winSprites) {
            sprite.scale.set(1)
            sprite.alpha = 1
        }
        if (this.payline) {
            this.payline.alpha = 0.35
            this.payline.tint = 0xffffff
        }

        this.winSprites = []
        this.payline = null
    }

    // ─── 1. Gold flash overlay ─────────────────────────────────────────────────

    private _flashScreen(x: number, y: number, w: number, h: number) {
        const flash = new PIXI.Graphics()
        flash.roundRect(x, y, w, h, 14)
        flash.fill({ color: 0xffd700, alpha: 0 })
        this.fxContainer.addChild(flash)

        let alpha = 0
        let dir = 1
        let flashes = 0
        const maxFlashes = 3

        const tick = () => {
            alpha += dir * 0.06
            if (alpha >= 0.35) { alpha = 0.35; dir = -1 }
            if (alpha <= 0) {
                alpha = 0
                dir = 1
                flashes++
                if (flashes >= maxFlashes) {
                    this.app.ticker.remove(tick)
                    this.fxContainer.removeChild(flash)
                    return
                }
            }
            flash.clear()
            flash.roundRect(x, y, w, h, 14)
            flash.fill({ color: 0xffd700, alpha })
        }

        this.app.ticker.add(tick)
        this.timeouts.push(setTimeout(() => this.app.ticker.remove(tick), 2000))
    }

    // ─── 2. Symbol pulse + glow ────────────────────────────────────────────────

    private _pulseSymbols() {
        const duration = 2500  // ms
        const start = performance.now()

        const tick = () => {
            const elapsed = performance.now() - start
            if (elapsed > duration) {
                this.app.ticker.remove(tick)
                for (const s of this.winSprites) {
                    s.scale.set(120 / 128)
                    s.alpha = 1
                }
                return
            }

            const t = elapsed / duration
            // Pulse: scale oscillates between 1.0 and 1.15
            const pulse = 1.0 + 0.15 * Math.abs(Math.sin(elapsed / 180))
            // Fade out toward end
            const alpha = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1

            for (const s of this.winSprites) {
                s.scale.set((120 / 128) * pulse)
                s.alpha = alpha
            }
        }

        this.app.ticker.add(tick)
    }

    // ─── 3. Payline flash ──────────────────────────────────────────────────────

    private _flashPayline() {
        if (!this.payline) return
        const pl = this.payline

        const colors = [0xff4444, 0xffd700, 0xff4444, 0xffd700, 0xffffff]
        let ci = 0

        const cycle = () => {
            pl.tint = colors[ci % colors.length]
            pl.alpha = 0.9
            ci++
        }

        cycle()
        const id = setInterval(cycle, 200)
        this.timeouts.push(setTimeout(() => {
            clearInterval(id)
            pl.tint = 0xffffff
            pl.alpha = 0.35
        }, 2000))
        // Store interval id for cleanup (wrapped in timeout)
        this.timeouts.push(id as unknown as ReturnType<typeof setTimeout>)
    }

    // ─── 4. Confetti particles ─────────────────────────────────────────────────

    private _spawnConfetti(panelX: number, panelY: number, panelW: number) {
        const colors = [0xffd700, 0xff4444, 0x7c3aed, 0x00e5ff, 0xff69b4, 0x00ff88]
        const count = 60

        for (let i = 0; i < count; i++) {
            this.timeouts.push(setTimeout(() => {
                const color = colors[Math.floor(Math.random() * colors.length)]
                const size = 4 + Math.random() * 6
                const isCircle = Math.random() > 0.5

                const g = new PIXI.Graphics()
                if (isCircle) {
                    g.circle(0, 0, size / 2)
                } else {
                    g.rect(-size / 2, -size / 2, size, size * 0.6)
                }
                g.fill({ color })

                g.x = panelX + Math.random() * panelW
                g.y = panelY - 10
                g.alpha = 1
                g.rotation = Math.random() * Math.PI * 2

                this.fxContainer.addChild(g)

                this.particles.push({
                    sprite: g,
                    vx: (Math.random() - 0.5) * 3,
                    vy: 1 + Math.random() * 3,
                    gravity: 0.08 + Math.random() * 0.05,
                    rotSpeed: (Math.random() - 0.5) * 0.15,
                    alpha: 1,
                    alphaDec: 0.008 + Math.random() * 0.006,
                    color,
                })
            }, i * 35))
        }
    }

    // ─── Particle ticker ───────────────────────────────────────────────────────

    private _startParticleTicker() {
        const tick = () => {
            for (let i = this.particles.length - 1; i >= 0; i--) {
                const p = this.particles[i]
                p.sprite.x += p.vx
                p.sprite.y += p.vy
                p.vy += p.gravity
                p.sprite.rotation += p.rotSpeed
                p.alpha -= p.alphaDec
                p.sprite.alpha = Math.max(0, p.alpha)

                if (p.alpha <= 0) {
                    this.fxContainer.removeChild(p.sprite)
                    this.particles.splice(i, 1)
                }
            }
        }

        this.tickerFn = tick
        this.app.ticker.add(tick)
    }
}