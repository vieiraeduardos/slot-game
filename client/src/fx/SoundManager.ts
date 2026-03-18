/**
 * SoundManager
 * All sounds synthesized via Web Audio API — no external files needed.
 *
 * Usage:
 *   const sfx = new SoundManager()
 *   sfx.spin()        // call while reels are spinning
 *   sfx.stopSpin()    // call when reels stop
 *   sfx.coin()        // single coin clink
 *   sfx.coins()       // cascading coins (win)
 *   sfx.win()         // victory jingle
 *   sfx.click()       // button click
 */
export class SoundManager {
    private ctx: AudioContext | null = null
    private spinNode: AudioBufferSourceNode | null = null
    private spinGain: GainNode | null = null
    private coinInterval: ReturnType<typeof setInterval> | null = null

    /** Lazily create AudioContext on first user interaction */
    private getCtx(): AudioContext {
        if (!this.ctx) {
            this.ctx = new AudioContext()
        }
        // Resume if suspended (browser autoplay policy)
        if (this.ctx.state === "suspended") {
            this.ctx.resume()
        }
        return this.ctx
    }

    // ─── Helpers ───────────────────────────────────────────────────────────────

    private masterGain(ctx: AudioContext, value = 0.4): GainNode {
        const g = ctx.createGain()
        g.gain.value = value
        g.connect(ctx.destination)
        return g
    }

    private oscillator(
        ctx: AudioContext,
        dest: AudioNode,
        type: OscillatorType,
        freq: number,
        startTime: number,
        endTime: number,
        freqEnd?: number
    ) {
        const osc = ctx.createOscillator()
        osc.type = type
        osc.frequency.setValueAtTime(freq, startTime)
        if (freqEnd !== undefined) {
            osc.frequency.linearRampToValueAtTime(freqEnd, endTime)
        }
        osc.connect(dest)
        osc.start(startTime)
        osc.stop(endTime)
    }

    private envelope(
        gainNode: GainNode,
        ctx: AudioContext,
        attack: number,
        decay: number,
        sustain: number,
        release: number,
        startTime: number,
        peakValue = 1
    ) {
        const g = gainNode.gain
        g.setValueAtTime(0, startTime)
        g.linearRampToValueAtTime(peakValue, startTime + attack)
        g.linearRampToValueAtTime(sustain * peakValue, startTime + attack + decay)
        g.setValueAtTime(sustain * peakValue, startTime + attack + decay)
        g.linearRampToValueAtTime(0, startTime + attack + decay + release)
    }

    // ─── Click ─────────────────────────────────────────────────────────────────

    click() {
        const ctx = this.getCtx()
        const master = this.masterGain(ctx, 0.3)
        const now = ctx.currentTime

        const gainNode = ctx.createGain()
        gainNode.connect(master)
        this.envelope(gainNode, ctx, 0.002, 0.02, 0, 0.05, now, 1)
        this.oscillator(ctx, gainNode, "square", 800, now, now + 0.07, 400)
    }

    // ─── Spin ──────────────────────────────────────────────────────────────────

    spin() {
        const ctx = this.getCtx()
        if (this.spinNode) return  // already playing

        // Create a looping noise buffer to simulate mechanical reel sound
        const bufferSize = ctx.sampleRate * 0.5
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
        const data = buffer.getChannelData(0)
        for (let i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1) * 0.3
        }

        // Bandpass filter to make it sound like a mechanical click-clack
        const filter = ctx.createBiquadFilter()
        filter.type = "bandpass"
        filter.frequency.value = 180
        filter.Q.value = 0.8

        this.spinGain = ctx.createGain()
        this.spinGain.gain.value = 0.18

        this.spinNode = ctx.createBufferSource()
        this.spinNode.buffer = buffer
        this.spinNode.loop = true
        this.spinNode.connect(filter)
        filter.connect(this.spinGain)
        this.spinGain.connect(ctx.destination)
        this.spinNode.start()
    }

    stopSpin() {
        if (!this.spinNode || !this.spinGain) return
        const ctx = this.getCtx()
        this.spinGain.gain.setValueAtTime(this.spinGain.gain.value, ctx.currentTime)
        this.spinGain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.15)
        const node = this.spinNode
        setTimeout(() => node.stop(), 200)
        this.spinNode = null
        this.spinGain = null
    }

    // ─── Single coin clink ─────────────────────────────────────────────────────

    coin(delay = 0) {
        const ctx = this.getCtx()
        const master = this.masterGain(ctx, 0.35)
        const now = ctx.currentTime + delay

        const gainNode = ctx.createGain()
        gainNode.connect(master)
        this.envelope(gainNode, ctx, 0.001, 0.05, 0.1, 0.25, now, 1)

        // Two sine waves slightly detuned = metallic coin sound
        this.oscillator(ctx, gainNode, "sine", 1200, now, now + 0.35)
        this.oscillator(ctx, gainNode, "sine", 1450, now, now + 0.25)
    }

    // ─── Cascading coins (for win) ─────────────────────────────────────────────

    coins(duration = 2.5) {
        this.stopCoins()
        let elapsed = 0
        const interval = 120  // ms between coins
        this.coinInterval = setInterval(() => {
            this.coin()
            elapsed += interval
            if (elapsed >= duration * 1000) this.stopCoins()
        }, interval)
    }

    stopCoins() {
        if (this.coinInterval !== null) {
            clearInterval(this.coinInterval)
            this.coinInterval = null
        }
    }

    // ─── Victory jingle ────────────────────────────────────────────────────────

    win() {
        const ctx = this.getCtx()
        const master = this.masterGain(ctx, 0.4)
        const now = ctx.currentTime

        // Happy ascending arpeggio: C4 E4 G4 C5
        const notes = [261.63, 329.63, 392.0, 523.25]
        const noteDur = 0.13
        const gap = 0.11

        notes.forEach((freq, i) => {
            const t = now + i * (noteDur + gap)
            const gainNode = ctx.createGain()
            gainNode.connect(master)
            this.envelope(gainNode, ctx, 0.01, 0.05, 0.6, 0.2, t, 1)
            this.oscillator(ctx, gainNode, "triangle", freq, t, t + noteDur + 0.2)
            // Add a shimmer octave above
            const gainNode2 = ctx.createGain()
            gainNode2.connect(master)
            this.envelope(gainNode2, ctx, 0.01, 0.05, 0.3, 0.15, t, 0.5)
            this.oscillator(ctx, gainNode2, "sine", freq * 2, t, t + noteDur + 0.1)
        })

        // Final chord hold
        const tFinal = now + notes.length * (noteDur + gap)
        notes.forEach(freq => {
            const g = ctx.createGain()
            g.connect(master)
            this.envelope(g, ctx, 0.02, 0.1, 0.5, 0.5, tFinal, 0.6)
            this.oscillator(ctx, g, "triangle", freq, tFinal, tFinal + 0.8)
        })
    }
}