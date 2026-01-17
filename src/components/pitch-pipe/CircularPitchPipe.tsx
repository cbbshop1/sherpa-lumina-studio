import { useState, useRef, useCallback, useEffect } from "react";
import { Volume2, ChevronUp, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import {
  createOscillatorChain,
  startOscillatorWithAttack,
  stopOscillatorWithRelease,
  getNoteFrequency,
  type OscillatorChain,
} from "@/utils/pitchPipeAudio";

interface CircularPitchPipeProps {
  audioContext: AudioContext | null;
  onAnalyserConnect?: (analyser: AnalyserNode) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const CircularPitchPipe = ({ audioContext, onAnalyserConnect }: CircularPitchPipeProps) => {
  const [activeNote, setActiveNote] = useState<string | null>(null);
  const [octave, setOctave] = useState(4);
  const [volume, setVolume] = useState(0.5);
  
  const oscillatorChainRef = useRef<OscillatorChain | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  // Create analyser on mount
  useEffect(() => {
    if (audioContext && onAnalyserConnect) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyserRef.current = analyser;
      onAnalyserConnect(analyser);
    }
  }, [audioContext, onAnalyserConnect]);

  const playNote = useCallback((note: string) => {
    if (!audioContext) return;

    // Stop any currently playing note
    if (oscillatorChainRef.current) {
      const { oscillator, gainNode } = oscillatorChainRef.current;
      stopOscillatorWithRelease(oscillator, gainNode, 0.05, audioContext.currentTime);
    }

    const frequency = getNoteFrequency(note, octave);
    const chain = createOscillatorChain(audioContext, frequency, "sine", 10000);
    
    // Connect to analyser
    if (analyserRef.current) {
      chain.gainNode.connect(analyserRef.current);
    }

    startOscillatorWithAttack(chain.gainNode, chain.oscillator, volume, 0.02, audioContext.currentTime);
    oscillatorChainRef.current = chain;
    setActiveNote(note);
  }, [audioContext, octave, volume]);

  const stopNote = useCallback(() => {
    if (!audioContext || !oscillatorChainRef.current) return;

    const { oscillator, gainNode } = oscillatorChainRef.current;
    stopOscillatorWithRelease(oscillator, gainNode, 0.1, audioContext.currentTime);
    oscillatorChainRef.current = null;
    setActiveNote(null);
  }, [audioContext]);

  const handleNoteInteraction = (note: string, isStart: boolean) => {
    if (isStart) {
      playNote(note);
    } else {
      stopNote();
    }
  };

  // Calculate position for each note around the circle
  const getNotePosition = (index: number, radius: number) => {
    // Start from top (C at 12 o'clock) and go clockwise
    const angle = (index * 30 - 90) * (Math.PI / 180);
    return {
      x: 150 + radius * Math.cos(angle),
      y: 150 + radius * Math.sin(angle),
    };
  };

  const activeFrequency = activeNote ? getNoteFrequency(activeNote, octave) : null;

  return (
    <div className="glass-effect rounded-2xl p-6 space-y-6">
      <h2 className="text-xl font-semibold text-center">Pitch Pipe</h2>

      {/* Circular Pitch Pipe */}
      <div className="flex justify-center">
        <svg
          width="300"
          height="300"
          viewBox="0 0 300 300"
          className="select-none"
        >
          {/* Outer decorative ring */}
          <circle
            cx="150"
            cy="150"
            r="140"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          
          {/* Main pitch pipe body */}
          <circle
            cx="150"
            cy="150"
            r="130"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="3"
          />

          {/* Inner ring for visual depth */}
          <circle
            cx="150"
            cy="150"
            r="70"
            fill="hsl(var(--background))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />

          {/* Note buttons around the circumference */}
          {NOTES.map((note, index) => {
            const pos = getNotePosition(index, 100);
            const isActive = activeNote === note;
            const isSharp = note.includes('#');
            
            return (
              <g key={note}>
                {/* Note button circle */}
                <circle
                  cx={pos.x}
                  cy={pos.y}
                  r={isSharp ? 18 : 22}
                  fill={isActive ? "hsl(var(--primary))" : isSharp ? "hsl(var(--muted))" : "hsl(var(--secondary))"}
                  stroke={isActive ? "hsl(var(--primary))" : "hsl(var(--border))"}
                  strokeWidth="2"
                  className="cursor-pointer transition-all duration-100 hover:brightness-110"
                  onMouseDown={() => handleNoteInteraction(note, true)}
                  onMouseUp={() => handleNoteInteraction(note, false)}
                  onMouseLeave={() => activeNote === note && stopNote()}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    handleNoteInteraction(note, true);
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    handleNoteInteraction(note, false);
                  }}
                />
                {/* Note label */}
                <text
                  x={pos.x}
                  y={pos.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  fill={isActive ? "hsl(var(--primary-foreground))" : "hsl(var(--foreground))"}
                  fontSize={isSharp ? "11" : "14"}
                  fontWeight="bold"
                  className="pointer-events-none select-none"
                >
                  {note}
                </text>
              </g>
            );
          })}

          {/* Center display */}
          <text
            x="150"
            y="140"
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(var(--foreground))"
            fontSize="28"
            fontWeight="bold"
            className="select-none"
          >
            {activeNote ? `${activeNote}${octave}` : `—`}
          </text>
          <text
            x="150"
            y="170"
            textAnchor="middle"
            dominantBaseline="central"
            fill="hsl(var(--muted-foreground))"
            fontSize="14"
            className="select-none"
          >
            {activeFrequency ? `${activeFrequency.toFixed(1)} Hz` : "Tap a note"}
          </text>
        </svg>
      </div>

      {/* Octave Control */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOctave(Math.max(2, octave - 1))}
          disabled={octave <= 2}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        
        <div className="text-center min-w-[80px]">
          <div className="text-2xl font-bold">{octave}</div>
          <div className="text-xs text-muted-foreground">Octave</div>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => setOctave(Math.min(6, octave + 1))}
          disabled={octave >= 6}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      {/* Volume Control */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <label className="text-sm font-medium text-muted-foreground">Volume</label>
          <span className="text-sm text-muted-foreground ml-auto">{Math.round(volume * 100)}%</span>
        </div>
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setVolume(v)}
        />
      </div>
    </div>
  );
};

export default CircularPitchPipe;
