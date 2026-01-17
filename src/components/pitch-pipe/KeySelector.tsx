import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp } from "lucide-react";
import { getNoteFrequency } from "@/utils/pitchPipeAudio";

interface KeySelectorProps {
  selectedNote: string;
  selectedOctave: number;
  onNoteChange: (note: string) => void;
  onOctaveChange: (octave: number) => void;
  onFrequencyChange: (frequency: number) => void;
}

const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const KeySelector = ({
  selectedNote,
  selectedOctave,
  onNoteChange,
  onOctaveChange,
  onFrequencyChange,
}: KeySelectorProps) => {
  const handleNoteSelect = (note: string) => {
    onNoteChange(note);
    onFrequencyChange(getNoteFrequency(note, selectedOctave));
  };

  const handleOctaveChange = (delta: number) => {
    const newOctave = Math.max(0, Math.min(8, selectedOctave + delta));
    onOctaveChange(newOctave);
    onFrequencyChange(getNoteFrequency(selectedNote, newOctave));
  };

  const currentFrequency = getNoteFrequency(selectedNote, selectedOctave);

  return (
    <div className="glass-effect rounded-2xl p-6 space-y-4">
      <h2 className="text-xl font-semibold text-center">Quick Note Select</h2>

      {/* Note buttons */}
      <div className="grid grid-cols-4 gap-2">
        {NOTES.map((note) => (
          <Button
            key={note}
            variant={selectedNote === note ? "default" : "outline"}
            className={`h-12 font-bold ${
              note.includes('#') 
                ? 'bg-slate-800 border-slate-700 hover:bg-slate-700' 
                : ''
            } ${selectedNote === note ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}
            onClick={() => handleNoteSelect(note)}
          >
            {note}
          </Button>
        ))}
      </div>

      {/* Octave selector */}
      <div className="flex items-center justify-center gap-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleOctaveChange(-1)}
          disabled={selectedOctave <= 0}
        >
          <ChevronDown className="w-4 h-4" />
        </Button>
        
        <div className="text-center min-w-[100px]">
          <div className="text-3xl font-bold">{selectedOctave}</div>
          <div className="text-xs text-muted-foreground">Octave</div>
        </div>
        
        <Button
          variant="outline"
          size="icon"
          onClick={() => handleOctaveChange(1)}
          disabled={selectedOctave >= 8}
        >
          <ChevronUp className="w-4 h-4" />
        </Button>
      </div>

      {/* Frequency display */}
      <div className="text-center pt-2 border-t border-border">
        <div className="text-lg font-semibold gradient-text">
          {selectedNote}{selectedOctave}
        </div>
        <div className="text-sm text-muted-foreground">
          {currentFrequency.toFixed(2)} Hz
        </div>
      </div>
    </div>
  );
};

export default KeySelector;
