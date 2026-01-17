import { useState, useRef, useCallback, useEffect } from "react";
import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
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
  updateOscillatorFrequency,
  updateFilterCutoff,
  updateGain,
  frequencyToNote,
  type WaveformType,
  type OscillatorChain,
} from "@/utils/pitchPipeAudio";

interface ToneGeneratorProps {
  audioContext: AudioContext | null;
  onAnalyserConnect?: (analyser: AnalyserNode) => void;
}

const ToneGenerator = ({ audioContext, onAnalyserConnect }: ToneGeneratorProps) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [frequency, setFrequency] = useState(440);
  const [waveform, setWaveform] = useState<WaveformType>("sine");
  const [volume, setVolume] = useState(0.5);
  const [filterCutoff, setFilterCutoff] = useState(2000);
  const [attackTime, setAttackTime] = useState(0.1);
  const [releaseTime, setReleaseTime] = useState(0.3);

  const oscillatorChainRef = useRef<OscillatorChain | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const noteInfo = frequencyToNote(frequency);

  // Create analyser and connect to parent
  useEffect(() => {
    if (audioContext && onAnalyserConnect) {
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      onAnalyserConnect(analyser);
    }
  }, [audioContext, onAnalyserConnect]);

  const startTone = useCallback(() => {
    if (!audioContext) return;

    const chain = createOscillatorChain(audioContext, frequency, waveform, filterCutoff);
    
    // Connect to analyser if available
    if (analyserRef.current) {
      chain.gainNode.connect(analyserRef.current);
    }

    startOscillatorWithAttack(chain.gainNode, chain.oscillator, volume, attackTime, audioContext.currentTime);
    oscillatorChainRef.current = chain;
    setIsPlaying(true);
  }, [audioContext, frequency, waveform, volume, filterCutoff, attackTime]);

  const stopTone = useCallback(() => {
    if (!audioContext || !oscillatorChainRef.current) return;

    const { oscillator, gainNode } = oscillatorChainRef.current;
    stopOscillatorWithRelease(oscillator, gainNode, releaseTime, audioContext.currentTime);
    oscillatorChainRef.current = null;
    setIsPlaying(false);
  }, [audioContext, releaseTime]);

  // Update parameters in real-time when playing
  useEffect(() => {
    if (isPlaying && oscillatorChainRef.current && audioContext) {
      updateOscillatorFrequency(oscillatorChainRef.current.oscillator, frequency, audioContext.currentTime);
    }
  }, [frequency, isPlaying, audioContext]);

  useEffect(() => {
    if (isPlaying && oscillatorChainRef.current && audioContext) {
      updateFilterCutoff(oscillatorChainRef.current.filter, filterCutoff, audioContext.currentTime);
    }
  }, [filterCutoff, isPlaying, audioContext]);

  useEffect(() => {
    if (isPlaying && oscillatorChainRef.current && audioContext) {
      updateGain(oscillatorChainRef.current.gainNode, volume, audioContext.currentTime);
    }
  }, [volume, isPlaying, audioContext]);

  // Restart oscillator when waveform changes
  useEffect(() => {
    if (isPlaying && audioContext) {
      stopTone();
      setTimeout(() => startTone(), 50);
    }
  }, [waveform]);

  // Handle frequency dial interaction
  const handleDialInteraction = (e: React.MouseEvent<SVGSVGElement> | React.TouchEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const getPosition = (event: MouseEvent | TouchEvent) => {
      const clientX = 'touches' in event ? event.touches[0].clientX : event.clientX;
      const clientY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      return { x: clientX - rect.left, y: clientY - rect.top };
    };

    const updateFrequency = (event: MouseEvent | TouchEvent) => {
      const { x, y } = getPosition(event);
      const angle = Math.atan2(y - centerY, x - centerX);
      // Map angle (-PI to PI) to frequency (20 to 2000 Hz) logarithmically
      const normalizedAngle = (angle + Math.PI) / (2 * Math.PI);
      const minFreq = 20;
      const maxFreq = 2000;
      const newFreq = minFreq * Math.pow(maxFreq / minFreq, normalizedAngle);
      setFrequency(Math.round(newFreq));
    };

    const handleMove = (event: MouseEvent | TouchEvent) => {
      updateFrequency(event);
    };

    const handleUp = () => {
      document.removeEventListener('mousemove', handleMove);
      document.removeEventListener('mouseup', handleUp);
      document.removeEventListener('touchmove', handleMove);
      document.removeEventListener('touchend', handleUp);
    };

    document.addEventListener('mousemove', handleMove);
    document.addEventListener('mouseup', handleUp);
    document.addEventListener('touchmove', handleMove);
    document.addEventListener('touchend', handleUp);

    updateFrequency(e.nativeEvent);
  };

  // Calculate dial rotation based on frequency
  const getDialRotation = () => {
    const minFreq = 20;
    const maxFreq = 2000;
    const normalizedFreq = Math.log(frequency / minFreq) / Math.log(maxFreq / minFreq);
    return normalizedFreq * 360 - 180;
  };

  return (
    <div className="glass-effect rounded-2xl p-6 space-y-6">
      <h2 className="text-xl font-semibold text-center">Tone Generator</h2>

      {/* Circular Frequency Dial */}
      <div className="flex flex-col items-center gap-4">
        <svg
          width="200"
          height="200"
          viewBox="0 0 200 200"
          className="cursor-pointer select-none"
          onMouseDown={handleDialInteraction}
          onTouchStart={handleDialInteraction}
        >
          {/* Outer ring */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="4"
          />
          {/* Gradient arc */}
          <circle
            cx="100"
            cy="100"
            r="90"
            fill="none"
            stroke="url(#dialGradient)"
            strokeWidth="4"
            strokeDasharray="565.48"
            strokeDashoffset={565.48 * (1 - (Math.log(frequency / 20) / Math.log(2000 / 20)))}
            strokeLinecap="round"
            transform="rotate(-90 100 100)"
          />
          {/* Center circle */}
          <circle
            cx="100"
            cy="100"
            r="60"
            fill="hsl(var(--card))"
            stroke="hsl(var(--border))"
            strokeWidth="2"
          />
          {/* Indicator needle */}
          <line
            x1="100"
            y1="100"
            x2="100"
            y2="20"
            stroke="hsl(var(--primary))"
            strokeWidth="3"
            strokeLinecap="round"
            transform={`rotate(${getDialRotation()} 100 100)`}
          />
          {/* Center dot */}
          <circle
            cx="100"
            cy="100"
            r="8"
            fill={isPlaying ? "hsl(var(--primary))" : "hsl(var(--muted))"}
            className="transition-colors duration-200"
          />
          {/* Gradient definition */}
          <defs>
            <linearGradient id="dialGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--secondary))" />
            </linearGradient>
          </defs>
        </svg>

        {/* Frequency display */}
        <div className="text-center">
          <div className="text-4xl font-bold gradient-text">{frequency} Hz</div>
          <div className="text-sm text-muted-foreground">
            {noteInfo.note}{noteInfo.octave} {noteInfo.cents !== 0 && `(${noteInfo.cents > 0 ? '+' : ''}${noteInfo.cents}¢)`}
          </div>
        </div>
      </div>

      {/* Play/Stop Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          variant={isPlaying ? "destructive" : "default"}
          className="w-32 h-12"
          onClick={isPlaying ? stopTone : startTone}
        >
          {isPlaying ? (
            <>
              <Square className="w-5 h-5 mr-2" />
              Stop
            </>
          ) : (
            <>
              <Play className="w-5 h-5 mr-2" />
              Play
            </>
          )}
        </Button>
      </div>

      {/* Waveform Selection */}
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

      {/* Volume Slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-muted-foreground">Volume</label>
          <span className="text-sm text-muted-foreground">{Math.round(volume * 100)}%</span>
        </div>
        <Slider
          value={[volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={([v]) => setVolume(v)}
        />
      </div>

      {/* Filter Cutoff Slider */}
      <div className="space-y-2">
        <div className="flex justify-between">
          <label className="text-sm font-medium text-muted-foreground">Filter Cutoff</label>
          <span className="text-sm text-muted-foreground">{filterCutoff} Hz</span>
        </div>
        <Slider
          value={[filterCutoff]}
          min={100}
          max={10000}
          step={100}
          onValueChange={([v]) => setFilterCutoff(v)}
        />
      </div>

      {/* Attack/Release */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-muted-foreground">Attack</label>
            <span className="text-sm text-muted-foreground">{attackTime.toFixed(2)}s</span>
          </div>
          <Slider
            value={[attackTime]}
            min={0.01}
            max={1}
            step={0.01}
            onValueChange={([v]) => setAttackTime(v)}
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-sm font-medium text-muted-foreground">Release</label>
            <span className="text-sm text-muted-foreground">{releaseTime.toFixed(2)}s</span>
          </div>
          <Slider
            value={[releaseTime]}
            min={0.01}
            max={2}
            step={0.01}
            onValueChange={([v]) => setReleaseTime(v)}
          />
        </div>
      </div>

      {/* Frequency Input */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-muted-foreground">Precise Frequency</label>
        <input
          type="number"
          value={frequency}
          onChange={(e) => setFrequency(Math.max(20, Math.min(2000, Number(e.target.value))))}
          className="w-full px-3 py-2 rounded-lg bg-muted border border-border text-foreground"
          min={20}
          max={2000}
        />
      </div>
    </div>
  );
};

export default ToneGenerator;
