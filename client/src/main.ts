import * as PIXI from "pixi.js"

import { Reel } from "./engine/Reel"
import { SlotEngine } from "./engine/SlotEngine"
import { loadSymbols } from "./engine/symbols"
import { spin } from "./api/slotApi"
import { SYMBOL_SIZE } from "./config/reels"
import { SoundManager } from "./fx/SoundManager"
import { WinAnimation } from "./fx/WinAnimation"

const REEL_COUNT = 3
const VISIBLE_ROWS = 3
const REEL_GAP = 8
const PADDING_X = 40
const PADDING_Y = 60

const TOTAL_REEL_W = REEL_COUNT * SYMBOL_SIZE + (REEL_COUNT - 1) * REEL_GAP
const CANVAS_W = TOTAL_REEL_W + PADDING_X * 2
const CANVAS_H = SYMBOL_SIZE * VISIBLE_ROWS + PADDING_Y * 2 + 100

const REEL_X = (i: number) => PADDING_X + i * (SYMBOL_SIZE + REEL_GAP)
const REEL_Y = PADDING_Y

async function start() {
    const app = new PIXI.Application()

    await app.init({
        width: CANVAS_W,
        height: CANVAS_H,
        background: 0x0a0a0f,
        antialias: true,
        resolution: window.devicePixelRatio || 1,
        autoDensity: true,
    })

    document.body.style.margin = "0"
    document.body.style.display = "flex"
    document.body.style.alignItems = "center"
    document.body.style.justifyContent = "center"
    document.body.style.minHeight = "100vh"
    document.body.style.background = "linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)"

    const canvas = app.canvas
    canvas.style.borderRadius = "24px"
    canvas.style.boxShadow = "0 0 80px rgba(180,120,255,0.3), 0 0 160px rgba(100,60,200,0.15)"
    document.body.appendChild(canvas)

    await loadSymbols()

    // ── FX systems ───────────────────────────────────────────────────────────────
    const sfx = new SoundManager()
    const winFx = new WinAnimation(app, app.stage)

    // ── Background ──────────────────────────────────────────────────────────────
    const bg = new PIXI.Graphics()
    bg.roundRect(0, 0, CANVAS_W, CANVAS_H, 20)
    bg.fill({ color: 0x14102a })
    app.stage.addChild(bg)

    // ── Top banner ──────────────────────────────────────────────────────────────
    const banner = new PIXI.Graphics()
    banner.roundRect(10, 10, CANVAS_W - 20, 46, 12)
    banner.fill({ color: 0x1e1640 })
    banner.stroke({ color: 0x7c3aed, width: 1.5, alpha: 0.6 })
    app.stage.addChild(banner)

    const titleText = new PIXI.Text({
        text: "✦ LUCKY REELS ✦",
        style: { fontFamily: "Georgia, serif", fontSize: 20, fill: 0xd4af37, letterSpacing: 6, fontWeight: "bold" }
    })
    titleText.anchor.set(0.5)
    titleText.x = CANVAS_W / 2
    titleText.y = 33
    app.stage.addChild(titleText)

    // ── Reel panel ──────────────────────────────────────────────────────────────
    const panelX = PADDING_X - 14
    const panelY = REEL_Y - 14
    const panelW = TOTAL_REEL_W + 28
    const panelH = SYMBOL_SIZE * VISIBLE_ROWS + 28

    const panelShadow = new PIXI.Graphics()
    panelShadow.roundRect(panelX + 4, panelY + 6, panelW, panelH, 14)
    panelShadow.fill({ color: 0x000000, alpha: 0.6 })
    app.stage.addChild(panelShadow)

    const panel = new PIXI.Graphics()
    panel.roundRect(panelX, panelY, panelW, panelH, 14)
    panel.fill({ color: 0x0d0b1e })
    panel.stroke({ color: 0x9f7aea, width: 2, alpha: 0.5 })
    app.stage.addChild(panel)

    const drawCorner = (gx: number, gy: number, dy: number, dx: number) => {
        const g = new PIXI.Graphics()
        const cr = 16
        g.moveTo(gx, gy + dy * cr)
        g.lineTo(gx, gy)
        g.lineTo(gx + dx * cr, gy)
        g.stroke({ color: 0xd4af37, width: 2.5 })
        app.stage.addChild(g)
    }
    drawCorner(panelX + 1,          panelY + 1,           1,  1)
    drawCorner(panelX + panelW - 1,  panelY + 1,           1, -1)
    drawCorner(panelX + 1,          panelY + panelH - 1,  -1,  1)
    drawCorner(panelX + panelW - 1,  panelY + panelH - 1, -1, -1)

    for (let i = 1; i < REEL_COUNT; i++) {
        const divX = PADDING_X + i * (SYMBOL_SIZE + REEL_GAP) - REEL_GAP / 2
        const div = new PIXI.Graphics()
        div.moveTo(divX, REEL_Y)
        div.lineTo(divX, REEL_Y + SYMBOL_SIZE * VISIBLE_ROWS)
        div.stroke({ color: 0x3d2d7a, width: 1, alpha: 0.8 })
        app.stage.addChild(div)
    }

    // ── Payline ─────────────────────────────────────────────────────────────────
    const paylineY = REEL_Y + SYMBOL_SIZE * 1.5
    const payline = new PIXI.Graphics()
    payline.moveTo(panelX - 8, paylineY)
    payline.lineTo(panelX + panelW + 8, paylineY)
    payline.stroke({ color: 0xff4444, width: 2, alpha: 0.35 })
    app.stage.addChild(payline)
    ;[panelX - 8, panelX + panelW + 8].forEach(px => {
        const dot = new PIXI.Graphics()
        dot.circle(px, paylineY, 5)
        dot.fill({ color: 0xff4444, alpha: 0.7 })
        app.stage.addChild(dot)
    })

    // ── Reels ────────────────────────────────────────────────────────────────────
    const reels = [
        new Reel(0, REEL_X(0)),
        new Reel(1, REEL_X(1)),
        new Reel(2, REEL_X(2)),
    ]
    reels.forEach(r => {
        r.container.y = REEL_Y
        app.stage.addChild(r.container)
    })

    const engine = new SlotEngine(reels)

    // ── Credits ──────────────────────────────────────────────────────────────────
    const creditsPanel = new PIXI.Graphics()
    creditsPanel.roundRect(PADDING_X - 14, REEL_Y + SYMBOL_SIZE * VISIBLE_ROWS + 28, panelW, 38, 10)
    creditsPanel.fill({ color: 0x0d0b1e })
    creditsPanel.stroke({ color: 0x3d2d7a, width: 1 })
    app.stage.addChild(creditsPanel)

    let credits = 1000
    const creditsLabel = new PIXI.Text({
        text: `CREDITS: ${credits}`,
        style: { fontFamily: "Courier New, monospace", fontSize: 14, fill: 0xd4af37, letterSpacing: 3 }
    })
    creditsLabel.anchor.set(0.5)
    creditsLabel.x = CANVAS_W / 2
    creditsLabel.y = REEL_Y + SYMBOL_SIZE * VISIBLE_ROWS + 47
    app.stage.addChild(creditsLabel)

    // ── SPIN button ──────────────────────────────────────────────────────────────
    const btnY = CANVAS_H - 44
    const btnW = 140
    const btnH = 46

    const btnShadow = new PIXI.Graphics()
    btnShadow.roundRect(CANVAS_W / 2 - btnW / 2 + 3, btnY + 4, btnW, btnH, btnH / 2)
    btnShadow.fill({ color: 0x4c1d95, alpha: 0.7 })
    app.stage.addChild(btnShadow)

    const btnBg = new PIXI.Graphics()
    btnBg.roundRect(CANVAS_W / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2)
    btnBg.fill({ color: 0x7c3aed })
    app.stage.addChild(btnBg)

    const btnHighlight = new PIXI.Graphics()
    btnHighlight.roundRect(CANVAS_W / 2 - btnW / 2 + 4, btnY + 2, btnW - 8, btnH / 2 - 2, btnH / 2 - 2)
    btnHighlight.fill({ color: 0xffffff, alpha: 0.1 })
    app.stage.addChild(btnHighlight)

    const btnBorder = new PIXI.Graphics()
    btnBorder.roundRect(CANVAS_W / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2)
    btnBorder.stroke({ color: 0xc084fc, width: 1.5 })
    app.stage.addChild(btnBorder)

    const spinText = new PIXI.Text({
        text: "SPIN",
        style: { fontFamily: "Georgia, serif", fontSize: 20, fill: 0xffffff, fontWeight: "bold", letterSpacing: 5 }
    })
    spinText.anchor.set(0.5)
    spinText.x = CANVAS_W / 2
    spinText.y = btnY + btnH / 2
    app.stage.addChild(spinText)

    const btnHit = new PIXI.Graphics()
    btnHit.roundRect(CANVAS_W / 2 - btnW / 2, btnY, btnW, btnH, btnH / 2)
    btnHit.fill({ alpha: 0 })
    btnHit.eventMode = "static"
    btnHit.cursor = "pointer"
    app.stage.addChild(btnHit)

    let isSpinning = false

    const setEnabled = (on: boolean) => {
        btnBg.alpha = on ? 1 : 0.45
        spinText.alpha = on ? 1 : 0.5
        btnHit.eventMode = on ? "static" : "none"
        btnHit.cursor = on ? "pointer" : "default"
    }

    btnHit.on("pointerover", () => { if (!isSpinning) btnBg.tint = 0xbb88ff })
    btnHit.on("pointerout",  () => { btnBg.tint = 0xffffff })

    btnHit.on("pointerdown", async () => {
        if (isSpinning) return
        isSpinning = true
        setEnabled(false)
        winFx.stop()

        sfx.click()

        credits -= 10
        creditsLabel.text = `CREDITS: ${credits}`

        engine.start()
        sfx.spin()

        const data = await spin()
        engine.stop(data.stops)

        // Wait for all reels to stop
        await new Promise<void>(resolve => {
            const check = app.ticker.add(() => {
                if (reels.every(r => !r.spinning)) {
                    app.ticker.remove(check)
                    resolve()
                }
            })
        })

        sfx.stopSpin()

        // ── Check for win ────────────────────────────────────────────────────────
        // data.stops[i] = strip index that landed on the PAYLINE for reel i
        // Read the actual symbol name from the REELS config
        const { REELS } = await import("./config/reels")
        const landedSymbols = (data.stops as number[]).map((stopIdx, ri) => {
            const strip = REELS[ri]
            return strip[((stopIdx % strip.length) + strip.length) % strip.length]
        })

        const allThree  = landedSymbols[0] === landedSymbols[1] && landedSymbols[1] === landedSymbols[2]
        const anyTwo    = landedSymbols[0] === landedSymbols[1]
                       || landedSymbols[1] === landedSymbols[2]
                       || landedSymbols[0] === landedSymbols[2]
        const isWin = anyTwo

        if (isWin) {
            const prize = allThree ? 150 : 50

            credits += prize
            creditsLabel.text = `CREDITS: ${credits}`

            // Find the sprite visually on the payline for each reel (by Y position)
            const paylineSprites = reels.map(r => r.getPaylineSprite())

            sfx.win()
            sfx.coins(2.5)
            winFx.play(paylineSprites, payline, panelX, panelY, panelW, panelH)
        }

        isSpinning = false
        setEnabled(true)
    })

    // ── Game loop ────────────────────────────────────────────────────────────────
    app.ticker.add(() => {
        engine.update()
        // Idle payline pulse (only when not in win animation)
        if (!isSpinning) {
            payline.alpha = 0.2 + 0.15 * Math.sin(performance.now() / 500)
        }
    })
}

start()