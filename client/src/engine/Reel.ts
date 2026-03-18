import * as PIXI from "pixi.js"
import { REELS, SYMBOL_SIZE, VISIBLE_ROWS } from "../config/reels"
import { SYMBOL_TEXTURES } from "./symbols"

const TOTAL = VISIBLE_ROWS + 1

function getSymbol(reel: number, index: number) {
    const strip = REELS[reel]
    const pos = ((index % strip.length) + strip.length) % strip.length
    return strip[pos]
}

export class Reel {
    reelIndex: number
    container: PIXI.Container
    symbolsContainer: PIXI.Container
    symbols: PIXI.Sprite[] = []

    speed = 0
    spinning = false
    stopping = false

    // scrollPx grows monotonically across ALL spins — never reset
    private scrollPx = 0
    private stopAtPx = 0
    private stripCounter = 0

    constructor(reelIndex: number, x: number) {
        this.reelIndex = reelIndex

        this.container = new PIXI.Container()
        this.container.x = x
        this.container.y = 80

        this.symbolsContainer = new PIXI.Container()
        this.container.addChild(this.symbolsContainer)

        // Initial layout:
        //   slot 0 (buffer, above viewport) → strip[TOTAL-1]
        //   slot 1 (top row)                → strip[TOTAL-2]
        //   slot 2 (middle row / PAYLINE)   → strip[1]
        //   slot 3 (bottom row)             → strip[0]
        for (let i = 0; i < TOTAL; i++) {
            const stripIdx = TOTAL - 1 - i
            const sprite = new PIXI.Sprite(SYMBOL_TEXTURES[getSymbol(reelIndex, stripIdx)])
            sprite.width = SYMBOL_SIZE
            sprite.height = SYMBOL_SIZE
            sprite.anchor.set(0.5)
            sprite.x = SYMBOL_SIZE / 2
            sprite.y = (i - 1) * SYMBOL_SIZE + SYMBOL_SIZE / 2
            this.symbols.push(sprite)
            this.symbolsContainer.addChild(sprite)
        }

        // stripCounter: index of the next symbol to assign when a sprite
        // wraps from bottom back to the top. Starts at TOTAL because
        // slots 0..TOTAL-1 are already assigned above.
        this.stripCounter = TOTAL

        const mask = new PIXI.Graphics()
        mask.rect(0, 0, SYMBOL_SIZE, SYMBOL_SIZE * VISIBLE_ROWS)
        mask.fill(0xffffff)
        this.container.addChild(mask)
        this.symbolsContainer.mask = mask
    }

    start() {
        this.speed = 14
        this.spinning = true
        this.stopping = false
        // Do NOT reset scrollPx or stripCounter — they must stay in sync
    }

    stop(index: number) {
        const stripLen = REELS[this.reelIndex].length

        // scrollPx is monotonic so scrolledSymbols correctly reflects
        // the total travel across all spins so far
        const scrolledSymbols = Math.ceil(this.scrollPx / SYMBOL_SIZE)

        // The PAYLINE (middle row) initially shows strip[1].
        // Each symbol scroll advances the payline by 1 position in the strip.
        // So after N total scrolls: payline shows strip[(1 + N) % stripLen]
        const paylineNow = (1 + scrolledSymbols) % stripLen

        let delta = ((index - paylineNow) + stripLen) % stripLen
        if (delta === 0) delta = stripLen

        const targetSymbols = scrolledSymbols + delta + stripLen * 2
        this.stopAtPx = targetSymbols * SYMBOL_SIZE
        this.stopping = true
    }

    update() {
        if (!this.spinning) return

        if (this.stopping) {
            const remaining = this.stopAtPx - this.scrollPx

            if (remaining <= this.speed + 1) {
                this._advance(remaining)
                this.speed = 0
                this.spinning = false
                this.stopping = false
                return
            }

            this.speed = Math.max(1.2, Math.min(this.speed, remaining * 0.05))
        }

        this._advance(this.speed)
    }

    /**
     * Returns the sprite visually on the payline (middle row).
     * Uses Y position — correct regardless of pool rotation.
     */
    getPaylineSprite(): PIXI.Sprite {
        const paylineCenterY = SYMBOL_SIZE * 1.5
        let closest = this.symbols[0]
        let closestDist = Infinity
        for (const sprite of this.symbols) {
            const dist = Math.abs(sprite.y - paylineCenterY)
            if (dist < closestDist) {
                closestDist = dist
                closest = sprite
            }
        }
        return closest
    }

    private _advance(px: number) {
        this.scrollPx += px

        for (const sprite of this.symbols) {
            sprite.y += px

            if (sprite.y - SYMBOL_SIZE / 2 >= SYMBOL_SIZE * VISIBLE_ROWS) {
                sprite.y -= SYMBOL_SIZE * TOTAL
                sprite.texture = SYMBOL_TEXTURES[getSymbol(this.reelIndex, this.stripCounter)]
                this.stripCounter++
            }
        }
    }
}