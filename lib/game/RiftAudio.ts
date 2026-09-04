type TonePreset =
  | 'shot'
  | 'hit'
  | 'kill'
  | 'dash'
  | 'shield'
  | 'rift'
  | 'hurt'
  | 'ultimate'
  | 'upgrade';

const PRESETS: Record<
  TonePreset,
  {
    frequency: number;
    end: number;
    duration: number;
    type: OscillatorType;
    gain: number;
  }
> = {
  shot: {
    frequency: 330,
    end: 760,
    duration: 0.09,
    type: 'triangle',
    gain: 0.035,
  },
  hit: { frequency: 120, end: 70, duration: 0.07, type: 'square', gain: 0.025 },
  kill: { frequency: 240, end: 920, duration: 0.16, type: 'sine', gain: 0.045 },
  dash: {
    frequency: 160,
    end: 520,
    duration: 0.18,
    type: 'sawtooth',
    gain: 0.035,
  },
  shield: {
    frequency: 620,
    end: 280,
    duration: 0.25,
    type: 'sine',
    gain: 0.05,
  },
  rift: {
    frequency: 100,
    end: 48,
    duration: 0.34,
    type: 'sawtooth',
    gain: 0.045,
  },
  hurt: { frequency: 90, end: 42, duration: 0.2, type: 'square', gain: 0.055 },
  ultimate: {
    frequency: 80,
    end: 880,
    duration: 0.72,
    type: 'sawtooth',
    gain: 0.065,
  },
  upgrade: {
    frequency: 420,
    end: 1100,
    duration: 0.42,
    type: 'triangle',
    gain: 0.05,
  },
};

export class RiftAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private ambient: OscillatorNode[] = [];
  private muted = false;

  async unlock() {
    try {
      if (this.context) {
        if (this.context.state === 'suspended') await this.context.resume();
        return;
      }
      const AudioConstructor =
        window.AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioConstructor) return;
      this.context = new AudioConstructor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.5;
      this.master.connect(this.context.destination);
      this.startAmbience();
    } catch {
      // Audio can be blocked by autoplay or OS policy; gameplay stays available.
    }
  }

  setMuted(muted: boolean) {
    this.muted = muted;
    if (this.context && this.master) {
      this.master.gain.setTargetAtTime(
        muted ? 0 : 0.5,
        this.context.currentTime,
        0.025,
      );
    }
  }

  play(name: TonePreset) {
    if (!this.context || !this.master || this.muted) return;
    const preset = PRESETS[name];
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = preset.type;
    oscillator.frequency.setValueAtTime(preset.frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, preset.end),
      now + preset.duration,
    );
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.exponentialRampToValueAtTime(preset.gain, now + 0.012);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + preset.duration);
    oscillator.connect(envelope);
    envelope.connect(this.master);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
    oscillator.start(now);
    oscillator.stop(now + preset.duration + 0.025);
  }

  private startAmbience() {
    if (!this.context || !this.master) return;
    const now = this.context.currentTime;
    [46, 69.3].forEach((frequency, index) => {
      const oscillator = this.context!.createOscillator();
      const gain = this.context!.createGain();
      oscillator.type = index === 0 ? 'sine' : 'triangle';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.035 : 0.012;
      oscillator.connect(gain);
      gain.connect(this.master!);
      oscillator.start(now);
      this.ambient.push(oscillator);
    });
  }

  dispose() {
    this.ambient.forEach((oscillator) => {
      try {
        oscillator.stop();
      } catch {
        // Already stopped.
      }
      oscillator.disconnect();
    });
    this.ambient = [];
    const closing = this.context?.close();
    if (closing) void closing.catch(() => undefined);
    this.context = null;
    this.master = null;
  }
}
