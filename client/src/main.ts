import * as PIXI from "pixi.js"

import { Reel } from "./engine/Reel"
import { SlotEngine } from "./engine/SlotEngine"
import { loadSymbols } from "./engine/symbols"
import { spin } from "./api/slotApi"
import { SYMBOL_SIZE, REELS } from "./config/reels"
import { SoundManager } from "./fx/SoundManager"
import { WinAnimation } from "./fx/WinAnimation"

const REEL_COUNT   = 3
const VISIBLE_ROWS = 3
const REEL_GAP     = 8
const PADDING_X    = 40
const PADDING_Y    = 60

const TOTAL_REEL_W = REEL_COUNT * SYMBOL_SIZE + (REEL_COUNT - 1) * REEL_GAP
const CANVAS_W     = TOTAL_REEL_W + PADDING_X * 2
const CANVAS_H     = SYMBOL_SIZE * VISIBLE_ROWS + PADDING_Y * 2 + 110

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

    document.body.style.margin    = "0"
    document.body.style.display   = "flex"
    document.body.style.alignItems    = "center"
    document.body.style.justifyContent = "center"
    document.body.style.minHeight = "100vh"
    document.body.style.background = "linear-gradient(135deg, #0a0a0f 0%, #1a0a2e 100%)"

    app.canvas.style.borderRadius = "24px"
    app.canvas.style.boxShadow    = "0 0 80px rgba(180,120,255,0.3), 0 0 160px rgba(100,60,200,0.15)"
    document.body.appendChild(app.canvas)

    await loadSymbols()

    const sfx   = new SoundManager()
    const winFx = new WinAnimation(app, app.stage)

    // ── Background ──────────────────────────────────────────────────────────────
    const bg = new PIXI.Graphics()
    bg.roundRect(0, 0, CANVAS_W, CANVAS_H, 20)
    bg.fill({ color: 0x14102a })
    app.stage.addChild(bg)

    // ── Banner ──────────────────────────────────────────────────────────────────
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
        g.moveTo(gx, gy + dy * 16); g.lineTo(gx, gy); g.lineTo(gx + dx * 16, gy)
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
        div.moveTo(divX, REEL_Y); div.lineTo(divX, REEL_Y + SYMBOL_SIZE * VISIBLE_ROWS)
        div.stroke({ color: 0x3d2d7a, width: 1, alpha: 0.8 })
        app.stage.addChild(div)
    }

    // ── Payline ─────────────────────────────────────────────────────────────────
    const paylineY = REEL_Y + SYMBOL_SIZE * 1.5
    const payline  = new PIXI.Graphics()
    payline.moveTo(panelX - 8, paylineY)
    payline.lineTo(panelX + panelW + 8, paylineY)
    payline.stroke({ color: 0xff4444, width: 2, alpha: 0.35 })
    app.stage.addChild(payline)
    for (const px of [panelX - 8, panelX + panelW + 8]) {
        const dot = new PIXI.Graphics()
        dot.circle(px, paylineY, 5)
        dot.fill({ color: 0xff4444, alpha: 0.7 })
        app.stage.addChild(dot)
    }

    // ── Reels ────────────────────────────────────────────────────────────────────
    const reels = [0, 1, 2].map(i => new Reel(i, REEL_X(i)))
    reels.forEach(r => { r.container.y = REEL_Y; app.stage.addChild(r.container) })

    const engine = new SlotEngine(reels)

    // ── Credits display (bigger, more impactful) ──────────────────────────────
    const creditsY   = REEL_Y + SYMBOL_SIZE * VISIBLE_ROWS + 22
    const creditsH   = 52

    const creditsPanel = new PIXI.Graphics()
    creditsPanel.roundRect(panelX, creditsY, panelW, creditsH, 12)
    creditsPanel.fill({ color: 0x0a0818 })
    creditsPanel.stroke({ color: 0x5b21b6, width: 1.5 })
    app.stage.addChild(creditsPanel)

    // Inner gold line accent
    const creditsAccent = new PIXI.Graphics()
    creditsAccent.moveTo(panelX + 16, creditsY + creditsH - 6)
    creditsAccent.lineTo(panelX + panelW - 16, creditsY + creditsH - 6)
    creditsAccent.stroke({ color: 0xd4af37, width: 1, alpha: 0.3 })
    app.stage.addChild(creditsAccent)

    let credits = 1000

    // Small "CREDITS" label
    const creditsCaption = new PIXI.Text({
        text: "CREDITS",
        style: { fontFamily: "Courier New, monospace", fontSize: 10, fill: 0x8b7db0, letterSpacing: 4 }
    })
    creditsCaption.anchor.set(0.5)
    creditsCaption.x = CANVAS_W / 2
    creditsCaption.y = creditsY + 12
    app.stage.addChild(creditsCaption)

    // Large number
    const creditsValue = new PIXI.Text({
        text: `${credits}`,
        style: { fontFamily: "Georgia, serif", fontSize: 28, fill: 0xd4af37, fontWeight: "bold", letterSpacing: 2 }
    })
    creditsValue.anchor.set(0.5)
    creditsValue.x = CANVAS_W / 2
    creditsValue.y = creditsY + 34
    app.stage.addChild(creditsValue)

    // ── SPIN button (larger, more presence) ──────────────────────────────────
    const btnCY  = CANVAS_H - 36   // center Y
    const btnW   = 180
    const btnH   = 56
    const btnX   = CANVAS_W / 2 - btnW / 2
    const btnY   = btnCY - btnH / 2

    // Outer glow ring (animated in ticker)
    const btnGlow = new PIXI.Graphics()
    app.stage.addChild(btnGlow)

    // Shadow
    const btnShadow = new PIXI.Graphics()
    btnShadow.roundRect(btnX + 4, btnY + 6, btnW, btnH, btnH / 2)
    btnShadow.fill({ color: 0x2d0d6e, alpha: 0.9 })
    app.stage.addChild(btnShadow)

    // Main body
    const btnBg = new PIXI.Graphics()
    btnBg.roundRect(btnX, btnY, btnW, btnH, btnH / 2)
    btnBg.fill({ color: 0x6d28d9 })
    app.stage.addChild(btnBg)

    // Top shine
    const btnShine = new PIXI.Graphics()
    btnShine.roundRect(btnX + 6, btnY + 3, btnW - 12, btnH * 0.42, btnH / 2 - 3)
    btnShine.fill({ color: 0xffffff, alpha: 0.12 })
    app.stage.addChild(btnShine)

    // Border
    const btnBorder = new PIXI.Graphics()
    btnBorder.roundRect(btnX, btnY, btnW, btnH, btnH / 2)
    btnBorder.stroke({ color: 0xa78bfa, width: 2 })
    app.stage.addChild(btnBorder)

    const spinText = new PIXI.Text({
        text: "SPIN",
        style: { fontFamily: "Georgia, serif", fontSize: 24, fill: 0xffffff, fontWeight: "bold", letterSpacing: 8 }
    })
    spinText.anchor.set(0.5)
    spinText.x = CANVAS_W / 2
    spinText.y = btnCY
    app.stage.addChild(spinText)

    // Hit area
    const btnHit = new PIXI.Graphics()
    btnHit.roundRect(btnX, btnY, btnW, btnH, btnH / 2)
    btnHit.fill({ alpha: 0 })
    btnHit.eventMode = "static"
    btnHit.cursor = "pointer"
    app.stage.addChild(btnHit)

    // ── Button state helpers ──────────────────────────────────────────────────
    let isSpinning = false

    const setEnabled = (on: boolean) => {
        btnBg.alpha    = on ? 1 : 0.4
        btnShine.alpha = on ? 0.12 : 0.04
        spinText.alpha = on ? 1 : 0.45
        btnHit.eventMode = on ? "static" : "none"
        btnHit.cursor    = on ? "pointer" : "default"
    }

    // Press effect
    btnHit.on("pointerdown",  () => { btnBg.y = 2; btnShadow.y = 2; spinText.y = btnCY + 2 })
    btnHit.on("pointerup",    () => { btnBg.y = 0; btnShadow.y = 0; spinText.y = btnCY })
    btnHit.on("pointerupoutside", () => { btnBg.y = 0; btnShadow.y = 0; spinText.y = btnCY })
    btnHit.on("pointerover",  () => { if (!isSpinning) { btnBg.tint = 0xc4b5fd; btnGlow.alpha = 1 } })
    btnHit.on("pointerout",   () => { btnBg.tint = 0xffffff; btnGlow.alpha = 0.4 })

    // ── SPIN handler ─────────────────────────────────────────────────────────
    btnHit.on("pointerdown", async () => {
        if (isSpinning) return
        isSpinning = true
        setEnabled(false)
        winFx.stop()

        sfx.click()
        credits -= 10
        creditsValue.text  = `${credits}`
        creditsValue.style.fill = 0xffffff

        engine.start()
        sfx.spin()

        const data = await spin()
        engine.stop(data.stops)

        await new Promise<void>(resolve => {
            const check = app.ticker.add(() => {
                if (reels.every(r => !r.spinning)) {
                    app.ticker.remove(check)
                    resolve()
                }
            })
        })

        sfx.stopSpin()

        // ── Win detection ─────────────────────────────────────────────────────
        const landed = (data.stops as number[]).map((stopIdx, ri) => {
            const strip = REELS[ri]
            return strip[((stopIdx % strip.length) + strip.length) % strip.length]
        })

        const allThree = landed[0] === landed[1] && landed[1] === landed[2]
        const anyTwo   = landed[0] === landed[1] || landed[1] === landed[2] || landed[0] === landed[2]

        if (anyTwo) {
            const prize     = allThree ? 150 : 50
            const prevCreds = credits
            credits        += prize

            sfx.win(allThree)
            sfx.coins(allThree ? 3.5 : 2.2)

            winFx.play(
                reels.map(r => r.getPaylineSprite()),
                payline,
                panelX, panelY, panelW, panelH,
                CANVAS_W, CANVAS_H,
                allThree
            )

            // Animated count-up
            winFx.animateCredits(prevCreds, credits, creditsValue)

            // Flash the credits panel border gold
            creditsPanel.stroke({ color: 0xffd700, width: 2.5 })
            setTimeout(() => {
                creditsPanel.clear()
                creditsPanel.roundRect(panelX, creditsY, panelW, creditsH, 12)
                creditsPanel.fill({ color: 0x0a0818 })
                creditsPanel.stroke({ color: 0x5b21b6, width: 1.5 })
            }, 3000)
        } else {
            creditsValue.text  = `${credits}`
            creditsValue.style.fill = 0xd4af37
        }

        isSpinning = false
        setEnabled(true)
    })

    // Bring FX container to top of stage so coins render above everything
    winFx.bringToFront()

    // ── Game loop ────────────────────────────────────────────────────────────
    app.ticker.add((ticker) => {
        engine.update()

        const t = performance.now()

        // Idle payline pulse
        if (!isSpinning) payline.alpha = 0.2 + 0.15 * Math.sin(t / 500)

        // Button glow ring pulse
        const glowR = btnH / 2 + 6 + 3 * Math.sin(t / 400)
        btnGlow.clear()
        btnGlow.roundRect(btnX - 4, btnY - 4, btnW + 8, btnH + 8, btnH / 2 + 4)
        btnGlow.stroke({ color: 0x9333ea, width: glowR * 0.18, alpha: 0.25 + 0.12 * Math.sin(t / 400) })
    })
}

start()