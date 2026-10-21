# Sherpa Lumina Studio

Version 0.2.0 introduces a dashboard with six focused workspaces, a warm studio theme, and a shared musical selection. Choosing a chord or scale previews its notes immediately; playback is a separate action. Your selection follows you between learning tools. The existing piano and sequencer retain their own instrument engines.

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

The home route is a dashboard of cards linking to Piano, Chord Library, Scale Explorer, Progressions, Pitch & Tone, and Studio. Each card opens a workspace instead of scrolling to a section on one long page.

### `/piano`, `/chords`, `/scales`, `/progressions`

These focused learning workspaces include:

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

The pitch-pipe route has three views: Pitch Pipe, See the Sound, and Tone Generator. It provides:

- A circular 12-note pitch pipe
- Octave selection from 2 through 6
- A shared playback and volume bar
- Waveform and logarithmic frequency spectrum views
- The current chord or scale carried from the learning workspaces
- Sine, triangle, square, and sawtooth voices with brightness, attack, and release controls
- An exact-frequency tone generator (20 Hz through 16 kHz)

Use `/pitch-pipe?view=waveform` to open the sound visualization directly. Playback stops on navigation, Escape, or when the page is hidden. Selection remains visible when playback stops. The shared preview never resumes automatically.

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

Run TypeScript checks and the audio/storage regression tests (Node.js 22.6 or newer for the tests):

```sh
npm run typecheck
npm test
```

The automated audio tests use a controlled Web Audio mock. They verify voice ownership, scheduling, cancellation, gain normalization, and analyser routing. They do not confirm speaker output or physical MIDI behavior.

## Versioning

Use a `codex/` feature branch for changes, commit a coherent working state, and push the branch before ending a work session. Review the pull request before updating `main`; a GitHub branch and a deployed website are separate states. The October 2026 remodel preserves the prior local MIDI/sequencer work and the pre-existing piano edits in separate commits before the dashboard commit.

See `docs/remodel-2026-10-21.md` for the review scope and verification record.

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
