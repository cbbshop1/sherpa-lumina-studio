import { useEffect, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useStudioStore } from '@/store/studioStore';
import type { Transport } from '@/engine/Transport';

// ─── Drum row definitions ─────────────────────────────────────────────────────

const DRUM_ROWS = [
  { label: 'Kick',  midiNote: 36 },
  { label: 'Snare', midiNote: 38 },
  { label: 'Clap',  midiNote: 39 },
  { label: 'HH',    midiNote: 42 },
  { label: 'OHH',   midiNote: 46 },
  { label: 'Tom 1', midiNote: 50 },
  { label: 'Tom 2', midiNote: 47 },
  { label: 'Ride',  midiNote: 51 },
] as const;

const TOTAL_STEPS = 16;

interface DrumGridProps {
  trackId: number;
  transport: Transport;
}

const DrumGrid = ({ trackId, transport }: DrumGridProps) => {
  const patterns          = useStudioStore(s => s.patterns);
  const patternLengthBars = useStudioStore(s => s.patternLengthBars);
  const toggleDrumStep    = useStudioStore(s => s.toggleDrumStep);
  const drumSampleNames   = useStudioStore(s => s.drumSampleNames);
  const loadDrumSample    = useStudioStore(s => s.loadDrumSample);

  const [activeStep, setActiveStep] = useState(-1);

  // One hidden file-input ref per drum row, keyed by midiNote
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  // Subscribe to Transport for playhead position (direct sub, not Zustand)
  useEffect(() => {
    const unsub = transport.subscribe(({ currentBeat, playState: ps }) => {
      if (ps === 'stopped') {
        setActiveStep(-1);
        return;
      }
      if (currentBeat !== undefined) {
        const patternBeats = patternLengthBars * 4;
        const posInPattern = ((currentBeat % patternBeats) + patternBeats) % patternBeats;
        const beatsPerStep = patternBeats / TOTAL_STEPS;
        setActiveStep(Math.floor(posInPattern / beatsPerStep) % TOTAL_STEPS);
      }
    });
    return unsub;
  }, [transport, patternLengthBars]);

  const beatsPerStep = (patternLengthBars * 4) / TOTAL_STEPS;

  function isStepOn(midiNote: number, stepIndex: number): boolean {
    const startBeat = stepIndex * beatsPerStep;
    return (patterns[trackId] ?? []).some(
      n => n.midiNote === midiNote && Math.abs(n.startBeat - startBeat) < 0.001,
    );
  }

  function handleFileChange(midiNote: number, e: React.ChangeEvent<HTMLInputElement>): void {
    const file = e.target.files?.[0];
    if (!file) return;
    loadDrumSample(midiNote, file);
    // Reset input so the same file can be re-selected later if needed
    e.target.value = '';
  }

  function truncateName(name: string, max = 9): string {
    if (name === 'Built-in') return '';
    return name.length > max ? name.slice(0, max - 1) + '…' : name;
  }

  return (
    <div className="p-3 select-none">
      {/* Step index header */}
      <div className="flex gap-px mb-1 pl-[5.5rem]">
        {Array.from({ length: TOTAL_STEPS }, (_, i) => (
          <div
            key={i}
            className={cn(
              'flex-1 text-center text-[9px] font-mono text-muted-foreground',
              i % 4 === 0 && 'text-primary/70',
            )}
          >
            {i % 4 === 0 ? i / 4 + 1 : '·'}
          </div>
        ))}
      </div>

      {/* Drum rows */}
      {DRUM_ROWS.map(row => {
        const sampleName = drumSampleNames[row.midiNote];
        const displayName = truncateName(sampleName ?? 'Built-in');
        return (
          <div key={row.midiNote} className="flex items-center gap-1 mb-1">
            {/* Row label + upload */}
            <div className="w-20 shrink-0 flex items-center gap-1 justify-end pr-1">
              <div className="flex flex-col items-end leading-none">
                <span className="text-xs text-muted-foreground">{row.label}</span>
                {displayName && (
                  <span className="text-[9px] text-primary/60 font-mono truncate max-w-[4.5rem]">
                    {displayName}
                  </span>
                )}
              </div>
              {/* Hidden file input */}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                ref={el => { fileInputRefs.current[row.midiNote] = el; }}
                onChange={e => handleFileChange(row.midiNote, e)}
              />
              {/* Upload button */}
              <button
                onClick={() => fileInputRefs.current[row.midiNote]?.click()}
                title={`Load sample for ${row.label}`}
                className={cn(
                  'w-5 h-5 flex items-center justify-center rounded transition-colors shrink-0',
                  sampleName
                    ? 'text-primary/80 hover:text-primary'
                    : 'text-muted-foreground/50 hover:text-muted-foreground',
                )}
              >
                <Upload className="w-3 h-3" />
              </button>
            </div>

            {/* Steps — grouped in sets of 4 for visual beat grouping */}
            <div className="flex flex-1 gap-px">
              {Array.from({ length: TOTAL_STEPS }, (_, step) => {
                const on   = isStepOn(row.midiNote, step);
                const beat = Math.floor(step / 4);
                return (
                  <button
                    key={step}
                    onClick={() => toggleDrumStep(trackId, row.midiNote, step, TOTAL_STEPS)}
                    className={cn(
                      'flex-1 h-7 rounded-sm border transition-colors',
                      !on && beat % 2 === 0 && 'bg-muted/50 border-border hover:bg-muted',
                      !on && beat % 2 !== 0 && 'bg-muted/30 border-border/60 hover:bg-muted',
                      on  && 'bg-primary border-primary shadow-sm',
                      activeStep === step && 'ring-1 ring-primary/60 ring-offset-1 ring-offset-card',
                    )}
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DrumGrid;
