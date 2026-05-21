import { Midi } from '@tonejs/midi';
import type { NoteEvent } from '@/engine/tracks/Track';

/**
 * Serialises the current patterns to a standard MIDI file and triggers a
 * browser download.
 */
export function exportMidi(
  patterns:   Record<number, NoteEvent[]>,
  trackNames: string[],
  bpm:        number,
): void {
  const midi = new Midi();
  midi.header.setTempo(bpm);
  const spb = 60 / bpm; // seconds per beat

  for (let tid = 0; tid < 5; tid++) {
    const notes = patterns[tid] ?? [];
    if (notes.length === 0) continue;

    const track = midi.addTrack();
    track.name  = trackNames[tid] ?? `Track ${tid + 1}`;

    for (const n of notes) {
      track.addNote({
        midi:     n.midiNote,
        time:     n.startBeat * spb,
        duration: n.durationBeats * spb,
        velocity: n.velocity / 127,
      });
    }
  }

  const bytes   = midi.toArray();
  const blob    = new Blob([bytes], { type: 'audio/midi' });
  const url     = URL.createObjectURL(blob);
  const anchor  = document.createElement('a');
  anchor.href     = url;
  anchor.download = 'pattern.mid';
  anchor.click();
  URL.revokeObjectURL(url);
}
