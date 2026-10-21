# Sherpa Lumina Studio

Sherpa Lumina Studio is a browser-based music theory and composition workspace. It combines an interactive learning surface for chords and scales, a pitch-pipe utility for ear training, and a lightweight multi-track sequencer built on the Web Audio and Web MIDI APIs.

The app runs entirely in the browser. Chord favorites and chord progressions are saved in `localStorage`; generated MIDI and audio captures are downloaded from the client.

## Main Features

- Interactive piano for single-note playback and chord building
- MIDI keyboard support for note input, active-note highlighting, pitch bend, and sustain
- Chord recognition for selected or played notes
- Chord library with common chord qualities in every root
- Favorite chords and custom chord progressions stored locally
- Scale explorer for major, minor, pentatonic, blues, and Dorian patterns
- Circular pitch pipe with octave and volume controls
- Pitch-pipe waveform visualizer and advanced tone generator
- Five-track studio sequencer with drums, bass, keys, pad, and lead tracks
- Drum grid with built-in samples and per-row sample upload
- Piano-roll editor for melodic tracks
- Transport controls for play, stop, record, BPM, and beat position
- Track mixer controls for volume, pan, mute, solo, record arm, and instrument selection
- MIDI export to `pattern.mid`
- Audio capture export to `recording.webm`
- Undo/redo for pattern edits with `Ctrl/Cmd+Z`, `Ctrl/Cmd+Y`, and `Ctrl/Cmd+Shift+Z`

## App Routes

### `/`

The home route is the music theory workspace. It includes:

- A virtual piano with single-note and chord modes
- Instrument selection for the piano sound
- MIDI device status and MIDI device selection
- Chord recognition while building chords
- A chord library that can highlight and play chord tones
- Favorite chord saving
- A chord progression builder that plays saved progressions
- A scale explorer for visualizing scale notes by root and type

Favorites and progressions are persisted in the browser under:

- `piano-favorites`
- `piano-progressions`

### `/pitch-pipe`

The pitch-pipe route is an ear-training and tone-reference tool. It provides:

- A circular 12-note pitch pipe
- Octave selection from 2 through 6
- Volume control
- A live audio visualizer
- A chord builder with selectable root, octave, chord type, and waveform
- An advanced tone generator panel

The audio context is initialized after the first user interaction, which is required by modern browser audio policies.

### `/studio`

The studio route is the composition workspace. It provides:

- A look-ahead Web Audio scheduler driven by the transport
- A 1, 2, or 4 bar pattern length
- A 16-step drum grid for the drums track
- A click-to-toggle piano roll for melodic tracks
- Five default tracks:
  - Drums
  - Bass
  - Keys
  - Pad
  - Lead
- Track controls for instrument, volume, pan, mute, solo, and record arm
- MIDI keyboard recording into the armed track, quantized to 16th notes
- MIDI pitch bend and sustain routing to the armed track
- MIDI file export
- WebM audio capture from the master bus

Recording replaces the armed track's current pattern and can be undone.

## Browser Requirements

The app depends on browser audio APIs:

- Web Audio API for synthesis, sampling, scheduling, playback, and capture
- MediaRecorder for audio capture export
- Web MIDI API for external MIDI input

Chrome and Edge provide the best MIDI support. Browsers without Web MIDI can still use the on-screen piano, pitch pipe, chord tools, and sequencer editing.

## Tech Stack

- Vite
- React
- TypeScript
- React Router
- Zustand
- Tailwind CSS
- shadcn/ui and Radix UI primitives
- lucide-react icons
- `@tonejs/midi` for MIDI file generation

## Local Development

Install dependencies:

```sh
npm install
```

Start the development server:

```sh
npm run dev
```

Create a production build:

```sh
npm run build
```

Preview the production build locally:

```sh
npm run preview
```

Run linting:

```sh
npm run lint
```

## Project Structure

```txt
src/
  App.tsx                         Route setup and app providers
  pages/
    Index.tsx                     Music theory workspace
    PitchPipe.tsx                 Pitch-pipe route
    Studio.tsx                    Sequencer/studio route
  components/
    PianoKeyboard.tsx             Interactive piano and MIDI note display
    ChordLibrary.tsx              Chord browser and favorites entry point
    ChordProgressionBuilder.tsx   Local chord progression builder
    ScaleExplorer.tsx             Scale note explorer
    TransportBar.tsx              Studio transport and export controls
    sequencer/                    Drum grid and piano roll editors
    pitch-pipe/                   Pitch-pipe, visualizer, and tone tools
    ui/                           shadcn/ui components
  engine/
    AudioEngine.ts                Shared Web Audio context and master bus
    Transport.ts                  Playback, recording, BPM, and beat clock
    Scheduler.ts                  Look-ahead scheduling for pattern playback
    Mixer.ts                      Per-track gain, pan, mute, and solo
    AudioExporter.ts              WebM capture from the master bus
    tracks/                       Track definitions and track management
    instruments/                  Synth and sampler backends
  hooks/
    useMidiKeyboard.ts            Web MIDI input handling
    usePianoAudio.ts              Piano playback hooks
    useChordProgressions.ts       Local chord favorites/progressions
  utils/
    chordRecognition.ts           Chord detection
    exportMidi.ts                 MIDI file generation
    instrumentSynthesis.ts        Instrument definitions
    pitchPipeAudio.ts             Pitch-pipe oscillator helpers
```

## Notes

- There is no backend service in the current app.
- Studio patterns are kept in client state during the session.
- Chord favorites and chord progressions persist only in the current browser profile.
- Exported files are generated client-side and downloaded by the browser.
