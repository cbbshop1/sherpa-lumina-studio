import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  ROOT_SPELLINGS,
  SCALE_FORMULAS,
  pitchClass,
  spellIntervals,
} from "../lib/musicNotation";
import { NOTE_NAMES, formatNote } from "../lib/noteSelection";

const scales = SCALE_FORMULAS;
const allNotes = ROOT_SPELLINGS;

const ScaleExplorer = ({
  initialRoot = "C",
  initialScale,
  onScaleSelect,
}: {
  initialRoot?: string;
  initialScale?: string;
  onScaleSelect?: (notes: string[], name: string) => void;
}) => {
  const [selectedScale, setSelectedScale] = useState<keyof typeof scales>(
    () =>
      (Object.keys(scales).find(
        (name) => name.toLowerCase() === initialScale,
      ) as keyof typeof scales) || "Major",
  );
  const [rootNote, setRootNote] = useState(
    allNotes.includes(initialRoot) ? initialRoot : "C",
  );

  useEffect(() => {
    const rootIndex = pitchClass(rootNote);
    onScaleSelect?.(
      scales[selectedScale].intervals.map(
        (interval) => NOTE_NAMES[(rootIndex + interval) % 12],
      ),
      `${rootNote} ${selectedScale.toLowerCase()}`,
    );
  }, [rootNote, selectedScale, onScaleSelect]);

  const formula = scales[selectedScale];
  const scaleNotes = spellIntervals(
    rootNote,
    formula.intervals,
    formula.degrees,
  ).map(formatNote);

  return (
    <section className="py-20 px-6 bg-slate-darker">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-bold mb-4">
            Scale <span className="gradient-text">Explorer</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Discover different scales and their unique patterns
          </p>
        </div>

        <div className="glass-effect p-8 rounded-3xl">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <label className="block text-sm font-semibold mb-3">
                Root Note
              </label>
              <div className="grid grid-cols-6 gap-2">
                {allNotes.map((note) => (
                  <Button
                    key={formatNote(note)}
                    onClick={() => setRootNote(note)}
                    variant={rootNote === note ? "default" : "outline"}
                    className={cn(
                      "font-semibold transition-all",
                      rootNote === note && "glow-blue",
                    )}
                  >
                    {formatNote(note)}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold mb-3">
                Scale Type
              </label>
              <div className="grid grid-cols-2 gap-2">
                {Object.keys(scales).map((scale) => (
                  <Button
                    key={scale}
                    onClick={() =>
                      setSelectedScale(scale as keyof typeof scales)
                    }
                    variant={selectedScale === scale ? "default" : "outline"}
                    className={cn(
                      "font-semibold transition-all",
                      selectedScale === scale && "glow-purple",
                    )}
                  >
                    {scale}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-card border border-border">
            <h3 className="text-lg font-semibold mb-4 text-center">
              {formatNote(rootNote)} {selectedScale} Scale
            </h3>
            <div className="flex flex-wrap justify-center gap-3">
              {scaleNotes.map((note, index) => (
                <div
                  key={index}
                  className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary to-secondary flex items-center justify-center font-bold text-xl shadow-lg glow-blue animate-slide-up"
                  style={{ animationDelay: `${index * 0.1}s` }}
                >
                  {formatNote(note)}
                </div>
              ))}
            </div>
            <p className="text-center mt-6 text-sm text-muted-foreground">
              Notes: {scaleNotes.join(" - ")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ScaleExplorer;
