// Instrument synthesis definitions and functions

export type InstrumentType = 'piano' | 'organ' | 'synth' | 'epiano' | 'strings' | 'bell';

export interface InstrumentConfig {
  name: string;
  icon: string;
  description: string;
}

export const INSTRUMENTS: Record<InstrumentType, InstrumentConfig> = {
  piano: { name: 'Piano', icon: '🎹', description: 'Classic piano sound' },
  organ: { name: 'Organ', icon: '🎛️', description: 'Full drawbar organ' },
  synth: { name: 'Synth Lead', icon: '🎸', description: 'Bright electronic lead' },
  epiano: { name: 'E. Piano', icon: '🎤', description: 'Warm Rhodes-style' },
  strings: { name: 'Strings', icon: '🎻', description: 'Lush string pad' },
  bell: { name: 'Bell', icon: '🔔', description: 'Metallic vibraphone' },
};

interface OscillatorSet {
  oscillators: OscillatorNode[];
  gainNode: GainNode;
  filterNode?: BiquadFilterNode;
}

// Create instrument-specific oscillator chain.
// `destination` lets callers (e.g. SynthBackend) route audio through the mixer
// instead of directly to audioContext.destination.
// `startTime` enables sample-accurate envelope scheduling for sequenced notes.
export function createInstrumentNote(
  audioContext: AudioContext,
  frequency: number,
  instrument: InstrumentType,
  isSustained: boolean = false,
  destination?: AudioNode,
  startTime?: number,
): OscillatorSet {
  const dest = destination ?? audioContext.destination;
  const masterGain = audioContext.createGain();
  masterGain.connect(dest);

  const now = startTime ?? audioContext.currentTime;
  const oscillators: OscillatorNode[] = [];
  let filterNode: BiquadFilterNode | undefined;

  switch (instrument) {
    case 'piano': {
      // Layered sines with harmonics for piano-like tone
      const fundamentalOsc = audioContext.createOscillator();
      const secondHarmonic = audioContext.createOscillator();
      const thirdHarmonic = audioContext.createOscillator();
      
      const fundGain = audioContext.createGain();
      const secGain = audioContext.createGain();
      const thirdGain = audioContext.createGain();
      
      fundamentalOsc.type = 'sine';
      fundamentalOsc.frequency.value = frequency;
      fundGain.gain.value = 0.5;
      
      secondHarmonic.type = 'sine';
      secondHarmonic.frequency.value = frequency * 2;
      secGain.gain.value = 0.15;
      
      thirdHarmonic.type = 'sine';
      thirdHarmonic.frequency.value = frequency * 3;
      thirdGain.gain.value = 0.05;
      
      fundamentalOsc.connect(fundGain);
      secondHarmonic.connect(secGain);
      thirdHarmonic.connect(thirdGain);
      
      fundGain.connect(masterGain);
      secGain.connect(masterGain);
      thirdGain.connect(masterGain);
      
      oscillators.push(fundamentalOsc, secondHarmonic, thirdHarmonic);
      
      // ADSR for piano
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.6, now + 0.01);
      masterGain.gain.linearRampToValueAtTime(isSustained ? 0.35 : 0.3, now + 0.12);
      if (!isSustained) {
        masterGain.gain.linearRampToValueAtTime(0, now + 0.5);
      }
      break;
    }
    
    case 'organ': {
      // Additive synthesis - drawbar-style organ
      const harmonics = [1, 2, 3, 4, 6, 8];
      const levels = [0.4, 0.3, 0.2, 0.15, 0.1, 0.08];
      
      harmonics.forEach((harmonic, i) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sine';
        osc.frequency.value = frequency * harmonic;
        gain.gain.value = levels[i];
        
        osc.connect(gain);
        gain.connect(masterGain);
        oscillators.push(osc);
      });
      
      // Organ envelope - instant attack, sustained
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.45, now + 0.005);
      break;
    }
    
    case 'synth': {
      // Sawtooth with lowpass filter
      const sawOsc = audioContext.createOscillator();
      filterNode = audioContext.createBiquadFilter();
      
      sawOsc.type = 'sawtooth';
      sawOsc.frequency.value = frequency;
      
      filterNode.type = 'lowpass';
      filterNode.frequency.value = Math.min(frequency * 6, 8000);
      filterNode.Q.value = 2;
      
      sawOsc.connect(filterNode);
      filterNode.connect(masterGain);
      oscillators.push(sawOsc);
      
      // Punchy synth envelope
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.01);
      masterGain.gain.linearRampToValueAtTime(isSustained ? 0.4 : 0.35, now + 0.08);
      if (!isSustained) {
        masterGain.gain.linearRampToValueAtTime(0, now + 0.4);
      }
      
      // Filter envelope
      filterNode.frequency.setValueAtTime(Math.min(frequency * 8, 12000), now);
      filterNode.frequency.linearRampToValueAtTime(Math.min(frequency * 4, 6000), now + 0.2);
      break;
    }
    
    case 'epiano': {
      // FM synthesis for Rhodes-style electric piano
      const carrier = audioContext.createOscillator();
      const modulator = audioContext.createOscillator();
      const modGain = audioContext.createGain();
      
      carrier.type = 'sine';
      carrier.frequency.value = frequency;
      
      modulator.type = 'sine';
      modulator.frequency.value = frequency * 2; // 2:1 ratio
      
      // Modulation depth based on frequency (less mod at higher frequencies)
      const modDepth = Math.max(50, 200 - frequency * 0.1);
      modGain.gain.value = modDepth;
      
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(masterGain);
      
      oscillators.push(carrier, modulator);
      
      // Warm E.Piano envelope
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.008);
      masterGain.gain.linearRampToValueAtTime(isSustained ? 0.3 : 0.25, now + 0.15);
      if (!isSustained) {
        masterGain.gain.linearRampToValueAtTime(0, now + 0.8);
      }
      
      // FM modulation decay
      modGain.gain.setValueAtTime(modDepth, now);
      modGain.gain.linearRampToValueAtTime(modDepth * 0.3, now + 0.3);
      break;
    }
    
    case 'strings': {
      // Detuned sawtooth layers for lush strings
      const detuneAmounts = [-7, -3, 0, 3, 7];
      
      detuneAmounts.forEach((detune) => {
        const osc = audioContext.createOscillator();
        const gain = audioContext.createGain();
        
        osc.type = 'sawtooth';
        osc.frequency.value = frequency;
        osc.detune.value = detune;
        gain.gain.value = 0.12;
        
        osc.connect(gain);
        gain.connect(masterGain);
        oscillators.push(osc);
      });
      
      // Lowpass filter for warmth
      filterNode = audioContext.createBiquadFilter();
      filterNode.type = 'lowpass';
      filterNode.frequency.value = Math.min(frequency * 3, 4000);
      filterNode.Q.value = 0.5;
      
      masterGain.disconnect();
      masterGain.connect(filterNode);
      filterNode.connect(dest);
      
      // Slow attack for strings
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.45, now + 0.3);
      break;
    }
    
    case 'bell': {
      // FM synthesis with high modulation for metallic bell tone
      const carrier = audioContext.createOscillator();
      const modulator = audioContext.createOscillator();
      const modGain = audioContext.createGain();
      
      carrier.type = 'sine';
      carrier.frequency.value = frequency;
      
      // Inharmonic ratio for bell-like timbre
      modulator.type = 'sine';
      modulator.frequency.value = frequency * 3.5;
      
      modGain.gain.value = frequency * 0.8; // High modulation index
      
      modulator.connect(modGain);
      modGain.connect(carrier.frequency);
      carrier.connect(masterGain);
      
      oscillators.push(carrier, modulator);
      
      // Bell envelope - quick attack, long decay
      masterGain.gain.setValueAtTime(0, now);
      masterGain.gain.linearRampToValueAtTime(0.5, now + 0.003);
      masterGain.gain.exponentialRampToValueAtTime(isSustained ? 0.25 : 0.2, now + 0.3);
      if (!isSustained) {
        masterGain.gain.exponentialRampToValueAtTime(0.001, now + 2);
      }
      break;
    }
  }

  return { oscillators, gainNode: masterGain, filterNode };
}

// Get release time based on instrument type
export function getInstrumentReleaseTime(instrument: InstrumentType): number {
  switch (instrument) {
    case 'piano': return 0.4;
    case 'organ': return 0.1;
    case 'synth': return 0.3;
    case 'epiano': return 0.5;
    case 'strings': return 0.8;
    case 'bell': return 1.0;
    default: return 0.5;
  }
}

// Get auto-stop time for single note mode
export function getInstrumentAutoStopTime(instrument: InstrumentType): number {
  switch (instrument) {
    case 'piano': return 0.5;
    case 'organ': return 0.4;
    case 'synth': return 0.5;
    case 'epiano': return 0.8;
    case 'strings': return 0.6;
    case 'bell': return 2.0;
    default: return 0.5;
  }
}
