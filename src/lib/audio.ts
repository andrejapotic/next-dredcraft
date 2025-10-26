// lib/audio.ts
type LoadedBuffer = { buffer: AudioBuffer };

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private buffers = new Map<string, LoadedBuffer>();
  private masterGain: GainNode | null = null;
  private bus = {
    ambience: null as GainNode | null,
    sfx: null as GainNode | null,
  };

  // Track the currently playing ambience (for crossfades)
  private currentAmb: {
    assetId: string;
    src: AudioBufferSourceNode;
    gain: GainNode;
  } | null = null;

  async init(): Promise<void> {
    if (this.ctx) return;
    this.ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1;
    this.masterGain.connect(this.ctx.destination);

    this.bus.ambience = this.ctx.createGain();
    this.bus.sfx = this.ctx.createGain();
    this.bus.ambience.gain.value = 1;
    this.bus.sfx.gain.value = 1;

    this.bus.ambience.connect(this.masterGain);
    this.bus.sfx.connect(this.masterGain);
  }

  async load(id: string, url: string): Promise<void> {
    if (!this.ctx) throw new Error("AudioEngine not initialized");
    if (this.buffers.has(id)) return;
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    const buffer = await this.ctx.decodeAudioData(arr);
    this.buffers.set(id, { buffer });
  }

  async ensureResumed(): Promise<void> {
    if (!this.ctx) return;
    if (this.ctx.state === "suspended") await this.ctx.resume();
  }

  playSfx(id: string, volume = 1): void {
    if (!this.ctx || !this.bus.sfx) return;
    const found = this.buffers.get(id);
    if (!found) return;
    const src = this.ctx.createBufferSource();
    const gain = this.ctx.createGain();
    gain.gain.value = volume;
    src.buffer = found.buffer;
    src.connect(gain);
    gain.connect(this.bus.sfx);
    src.start(this.ctx.currentTime + 0.02);
  }

  /**
   * Crossfade to a new ambience asset.
   * Pass undefined/null assetId to fade to silence.
   */
  crossfadeAmbienceTo(assetId?: string | null, opts?: { volume?: number; fadeMs?: number }) {
    if (!this.ctx || !this.bus.ambience) return;
    const ctx = this.ctx;
    const fadeMs = opts?.fadeMs ?? 300;
    const vol = opts?.volume ?? 0.4;

    // If no change requested and something is already playing, do nothing
    if (assetId && this.currentAmb?.assetId === assetId) return;

    const now = ctx.currentTime;

    // Fade out old
    if (this.currentAmb) {
      const { src, gain } = this.currentAmb;
      gain.gain.cancelScheduledValues(now);
      gain.gain.setValueAtTime(gain.gain.value, now);
      gain.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      try {
        src.stop(now + fadeMs / 1000 + 0.05);
      } catch {}
      this.currentAmb = null;
    }

    // If target is silence, we're done
    if (!assetId) return;

    // Start new
    const found = this.buffers.get(assetId);
    if (!found) return; // not loaded

    const src = ctx.createBufferSource();
    src.buffer = found.buffer;
    src.loop = true;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(gain);
    gain.connect(this.bus.ambience);

    const t0 = now + 0.02;
    src.start(t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(vol, t0 + fadeMs / 1000);

    this.currentAmb = { assetId, src, gain };
  }
}
