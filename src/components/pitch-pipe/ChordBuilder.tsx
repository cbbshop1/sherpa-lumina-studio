import { useState, useRef, useCallback } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  createOscillatorChain,
  startOscillatorWithAttack,
  stopOscillatorWithRelease,
  getChordFrequencies,
  getNoteFrequency,
  CHORD_INTERVALS,
  type WaveformType,
  type OscillatorChain,
} from "@/utils/pitchPipeAudio";

interface ChordBuilderProps {
  audioContext: AudioContext | null;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const CHORD_TYPES = Object.keys(CHORD_INTERVALS);

const ChordBuilder = ({ audioContext }: ChordBuilderProps) => {
  const [rootNote, setRootNote] = useState("C");
  const [octave, setOctave] = useState(4);
  const [chordType, setChordType] = useState("Major");
  const [waveform, setWaveform] = useState<WaveformType>("sine");
  const [isPlaying, setIsPlaying] = useState(false);

  const oscillatorsRef = useRef<OscillatorChain[]>([]);

  const rootFrequency = getNoteFrequency(rootNote, octave);
  const chordFrequencies = getChordFrequencies(rootFrequency, chordType);
  const intervals = CHORD_INTERVALS[chordType] || [0, 4, 7];

  const getIntervalName = (semitones: number): string => {
    const names: Record<number, string> = {
      0: 'Root',
      2: 'Major 2nd',
      3: 'Minor 3rd',
      4: 'Major 3rd',
      5: 'Perfect 4th',
      6: 'Tritone',
      7: 'Perfect 5th',
      8: 'Minor 6th',
      9: 'Major 6th',
      10: 'Minor 7th',
      11: 'Major 7th',
      12: 'Octave',
    };
    return names[semitones] || `+${semitones}`;
  };

  const playChord = useCallback(() => {
    if (!audioContext) return;

    // Stop any existing sounds
    oscillatorsRef.current.forEach(({ oscillator, gainNode }) => {
      stopOscillatorWithRelease(oscillator, gainNode, 0.1, audioContext.currentTime);
    });
    oscillatorsRef.current = [];

    // Play each note with a slight delay for strum effect
    chordFrequencies.forEach((freq, index) => {
      setTimeout(() => {
        if (!audioContext) return;
        const chain = createOscillatorChain(audioContext, freq, waveform, 5000);
        startOscillatorWithAttack(chain.gainNode, chain.oscillator, 0.3, 0.05, audioContext.currentTime);
        oscillatorsRef.current.push(chain);
      }, index * 30);
    });

    setIsPlaying(true);
  }, [audioContext, chordFrequencies, waveform]);

  const stopChord = useCallback(() => {
    if (!audioContext) return;

    oscillatorsRef.current.forEach(({ oscillator, gainNode }) => {
      stopOscillatorWithRelease(oscillator, gainNode, 0.3, audioContext.currentTime);
    });
    oscillatorsRef.current = [];
    setIsPlaying(false);
  }, [audioContext]);

  return (
    <div className="glass-effect rounded-2xl p-6 space-y-6">
      <h2 className="text-xl font-semibold text-center">Chord Builder</h2>

      {/* Root note and octave */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Root Note</label>
          <Select value={rootNote} onValueChange={setRootNote}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {NOTES.map((note) => (
                <SelectItem key={note} value={note}>
                  {note}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">Octave</label>
          <Select value={octave.toString()} onValueChange={(v) => setOctave(Number(v))}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[2, 3, 4, 5, 6].map((oct) => (
                <SelectItem key={oct} value={oct.toString()}>
                  {oct}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Chord type */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Chord Type</label>
        <Select value={chordType} onValueChange={setChordType}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CHORD_TYPES.map((type) => (
              <SelectItem key={type} value={type}>
                {type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Waveform */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Waveform</label>
        <Select value={waveform} onValueChange={(v) => setWaveform(v as WaveformType)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="sine">Sine</SelectItem>
            <SelectItem value="square">Square</SelectItem>
            <SelectItem value="triangle">Triangle</SelectItem>
            <SelectItem value="sawtooth">Sawtooth</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Chord intervals display */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Chord Intervals</label>
        <div className="grid grid-cols-2 gap-2">
          {intervals.map((semitones, index) => (
            <div
              key={index}
              className="flex justify-between items-center px-3 py-2 rounded-lg bg-muted/50"
            >
              <span className="text-sm">{getIntervalName(semitones)}</span>
              <span className="text-xs text-muted-foreground">
                {chordFrequencies[index]?.toFixed(1)} Hz
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Chord name display */}
      <div className="text-center py-2">
        <span className="text-2xl font-bold gradient-text">
          {rootNote}{chordType === 'Minor' ? 'm' : chordType === 'Diminished' ? '°' : chordType === 'Augmented' ? '+' : ''}{chordType.includes('7') ? '7' : ''}
        </span>
      </div>

      {/* Play/Stop button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          variant={isPlaying ? "destructive" : "default"}
          className="w-full h-12"
          onClick={isPlaying ? stopChord : playChord}
        >
          {isPlaying ? (
            <>
              <Square className="w-5 h-5 mr-2" />
              Stop Chord
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Play {rootNote} {chordType}
            </>
          )}
        </Button>
      </div>
    </div>
  );
};

export default ChordBuilder;
