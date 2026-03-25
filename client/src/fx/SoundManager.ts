/**
 * SoundManager — all sounds via Web Audio API, zero external files.
 */
export class SoundManager {
    private ctx: AudioContext | null = null
    private spinNode: AudioBufferSourceNode | null = null
    private spinGain: GainNode | null = null
    private coinInterval: ReturnType<typeof setInterval> | null = null

    private getCtx(): AudioContext {
        if (!this.ctx) this.ctx = new AudioContext()
        if (this.ctx.state === "suspended") this.ctx.resume()
        return this.ctx
    }

    private out(ctx: AudioContext, vol = 0.4): GainNode {
        const g = ctx.createGain()
        g.gain.value = vol
        g.connect(ctx.destination)
        return g
    }

    private adsr(g: GainNode, ctx: AudioContext, a: number, d: number, s: number, r: number, t: number, peak = 1) {
        g.gain.setValueAtTime(0, t)
        g.gain.linearRampToValueAtTime(peak, t + a)
        g.gain.linearRampToValueAtTime(s * peak, t + a + d)
        g.gain.setValueAtTime(s * peak, t + a + d)
        g.gain.linearRampToValueAtTime(0, t + a + d + r)
    }

    private osc(ctx: AudioContext, dest: AudioNode, type: OscillatorType, freq: number, t0: number, t1: number, freqEnd?: number) {
        const o = ctx.createOscillator()
        o.type = type
        o.frequency.setValueAtTime(freq, t0)
        if (freqEnd !== undefined) o.frequency.linearRampToValueAtTime(freqEnd, t1)
        o.connect(dest)
        o.start(t0)
        o.stop(t1 + 0.01)
    }

    // ─── Click ─────────────────────────────────────────────────────────────────
    click() {
        const ctx = this.getCtx()
        const now = ctx.currentTime
        const g = ctx.createGain()
        g.connect(ctx.destination)
        this.adsr(g, ctx, 0.002, 0.015, 0, 0.04, now, 0.4)
        this.osc(ctx, g, "square", 900, now, now + 0.06, 500)
    }

    // ─── Spin (mechanical noise loop) ─────────────────────────────────────────
    spin() {
        const ctx = this.getCtx()
        if (this.spinNode) return

        const sr = ctx.sampleRate
        const buf = ctx.createBuffer(1, sr * 0.4, sr)
        const data = buf.getChannelData(0)
        for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.4

        const filter = ctx.createBiquadFilter()
        filter.type = "bandpass"
        filter.frequency.value = 200
        filter.Q.value = 1.2

        // Add a subtle periodic click to simulate reel ticks
        const click = ctx.createOscillator()
        click.type = "square"
        click.frequency.value = 12  // ~12 clicks per second
        const clickGain = ctx.createGain()
        clickGain.gain.value = 0.04
        click.connect(clickGain)
        clickGain.connect(ctx.destination)
        click.start()

        this.spinGain = ctx.createGain()
        this.spinGain.gain.value = 0.2

        this.spinNode = ctx.createBufferSource()
        this.spinNode.buffer = buf
        this.spinNode.loop = true
        this.spinNode.connect(filter)
        filter.connect(this.spinGain)
        this.spinGain.connect(ctx.destination)
        this.spinNode.start()

        // Store click ref for cleanup
        ;(this.spinNode as any)._clickOsc = click
        ;(this.spinNode as any)._clickGain = clickGain
    }

    stopSpin() {
        if (!this.spinNode || !this.spinGain) return
        const ctx = this.getCtx()
        const now = ctx.currentTime

        this.spinGain.gain.setValueAtTime(this.spinGain.gain.value, now)
        this.spinGain.gain.linearRampToValueAtTime(0, now + 0.12)

        const node = this.spinNode
        const clickOsc = (node as any)._clickOsc
        const clickGain = (node as any)._clickGain

        setTimeout(() => {
            try { node.stop() } catch {}
            try { clickOsc?.stop() } catch {}
        }, 150)

        this.spinNode = null
        this.spinGain = null
    }

    // ─── Single coin clink ─────────────────────────────────────────────────────
    coin(delay = 0) {
        const ctx = this.getCtx()
        const out = this.out(ctx, 0.4)
        const now = ctx.currentTime + delay

        // Two slightly detuned sines = metallic
        for (const [freq, dur] of [[1180, 0.3], [1460, 0.22], [2200, 0.12]] as [number, number][]) {
            const g = ctx.createGain()
            g.connect(out)
            this.adsr(g, ctx, 0.001, 0.04, 0.15, dur, now, 0.7)
            this.osc(ctx, g, "sine", freq, now, now + dur + 0.06)
        }
    }

    // ─── Cascading coins ───────────────────────────────────────────────────────
    coins(duration = 2.5) {
        this.stopCoins()
        let elapsed = 0
        const interval = 110

        this.coinInterval = setInterval(() => {
            // Vary pitch slightly for natural cascade feel
            this.coinPitched(0.85 + Math.random() * 0.3)
            elapsed += interval
            if (elapsed >= duration * 1000) this.stopCoins()
        }, interval)
    }

    private coinPitched(pitchMul: number) {
        const ctx = this.getCtx()
        const out = this.out(ctx, 0.35)
        const now = ctx.currentTime

        for (const [freq, dur] of [[1180 * pitchMul, 0.28], [1460 * pitchMul, 0.2]] as [number, number][]) {
            const g = ctx.createGain()
            g.connect(out)
            this.adsr(g, ctx, 0.001, 0.03, 0.1, dur, now, 0.6)
            this.osc(ctx, g, "sine", freq, now, now + dur + 0.04)
        }
    }

    stopCoins() {
        if (this.coinInterval !== null) {
            clearInterval(this.coinInterval)
            this.coinInterval = null
        }
    }

    // ─── Victory jingle ────────────────────────────────────────────────────────
    win(jackpot = false) {
        const ctx = this.getCtx()
        const out = this.out(ctx, 0.45)
        const now = ctx.currentTime

        if (jackpot) {
            // Fanfare: faster, higher, with extra shimmer
            const notes = [261.63, 329.63, 392.0, 523.25, 659.25, 783.99]
            notes.forEach((freq, i) => {
                const t = now + i * 0.1
                const g = ctx.createGain()
                g.connect(out)
                this.adsr(g, ctx, 0.005, 0.04, 0.6, 0.25, t, 1)
                this.osc(ctx, g, "triangle", freq, t, t + 0.3)
                this.osc(ctx, g, "sine", freq * 2, t, t + 0.2)
            })
            // Big chord at the end
            const tEnd = now + notes.length * 0.1 + 0.05
            ;[261.63, 392.0, 523.25, 659.25].forEach(freq => {
                const g = ctx.createGain()
                g.connect(out)
                this.adsr(g, ctx, 0.01, 0.05, 0.7, 0.8, tEnd, 0.8)
                this.osc(ctx, g, "triangle", freq, tEnd, tEnd + 1.2)
            })
        } else {
            // Standard: C E G C ascending + chord
            const notes = [261.63, 329.63, 392.0, 523.25]
            const step = 0.13
            notes.forEach((freq, i) => {
                const t = now + i * step
                const g = ctx.createGain()
                g.connect(out)
                this.adsr(g, ctx, 0.008, 0.04, 0.55, 0.2, t, 0.9)
                this.osc(ctx, g, "triangle", freq, t, t + 0.28)
                const g2 = ctx.createGain()
                g2.connect(out)
                this.adsr(g2, ctx, 0.008, 0.04, 0.25, 0.15, t, 0.45)
                this.osc(ctx, g2, "sine", freq * 2, t, t + 0.2)
            })
            const tEnd = now + notes.length * step + 0.04
            notes.forEach(freq => {
                const g = ctx.createGain()
                g.connect(out)
                this.adsr(g, ctx, 0.01, 0.08, 0.5, 0.55, tEnd, 0.55)
                this.osc(ctx, g, "triangle", freq, tEnd, tEnd + 0.85)
            })
        }
    }
}