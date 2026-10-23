# Sherpa Lumina Studio

Lumina has six focused workspaces, a warm studio theme, and a shared musical selection. Choosing a chord or scale previews its notes before playback. The piano now uses the shared bottom player, including Play, Stop, and volume, with a compact instrument menu. The sequencer retains its own transport.

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

## Piano update and The Clearing

- The piano starts without a preset chord or permanently glowing keys.
- Single notes sound while held; chord mode toggles notes and keeps the chord ready for replay.
- The bottom player stops and replays built chords using the selected piano instrument. Stop preserves the selection; Clear removes it.
- Chord names and note labels use the same contextual spelling as the chord library.
- The instrument menu offers Piano, Organ, Synth Lead, E. Piano, Strings, and Bell.
- The separate chord card below the keys has been removed. The chord readout lives in the player.
- Escape, navigation, and hiding the tab stop playback. The upper C retains its actual C5 pitch.

To build the static edition hosted inside The Clearing:

```sh
npm run build:clearing
```

Copy the contents of `dist-clearing` into the existing Clearing Site's `dist/lumina/` directory. The build includes physical entry pages for each tool so direct links and refreshes work. React Router uses the build's base path. The header links back to The Clearing's Learn room. The Clearing's Learn and Play collections both link to Lumina. The Sites source retains a copy of this app under `exhibits/lumina/`; keep that copy and its built assets together when updating.

Automated tests cover contextual spelling, exact piano registers, instrument playback and cancellation, shared volume, and saved-library compatibility. External MIDI hardware and subjective audio quality require a listening/hardware check.

## Version 0.2.2: chord toggles and scale listening

Chord cards toggle their own playback. A sounding card shows a Stop icon, while the bottom player stays synchronized. Switching cards replaces the sounding chord; Stop retains the selected chord.

Scales play as individual, scheduled notes with a light release overlap and a closing tonic. Choose ascending, descending, or up and back, and adjust the pace from 60 to 180 notes per minute. A highlight follows each note and playback ends automatically. Stop, navigation, and selection changes cancel all future notes. The scale's notes appear once, with contextual spelling and degree labels, instead of repeated panels and lists.


## Version 0.3.0: MIDI everywhere, minor scales, and visible composition

A single MIDI connection lives above the routes. On the dashboard and exploration pages it plays the selected global MIDI instrument, independently of lesson previews. In Studio it routes to the armed track for playing and recording. Velocity, sustain and pitch bend are retained; device changes, navigation, mute, All notes off and Escape release held voices and cancel pending starts. Browsers may require Enable MIDI sound after loading the page. MIDI Settings offers reconnection, device selection and mute on every tool, including Piano. The screen piano retains its glissando.

Scale choices include harmonic minor, classical melodic minor, and all seven diatonic modes (Ionian/major, Dorian, Phrygian, Lydian, Mixolydian, Aeolian/natural minor, Locrian), alongside pentatonic and blues scales. Classical melodic minor raises 6 and 7 ascending and uses natural minor descending. In Up and back, the displayed spellings change with the sounding leg. The upper tonic sounds once at the turn.

Studio opens on Keys. Each pitched track has a labeled, scrollable piano roll and a synchronized treble/bass pitch preview. Select a note in either view to edit pitch, written octave, start beat or duration. Add note and Hear note offer an alternative to grid placement. Contextual spelling follows the selected lesson; explicit sharps/flats are also available. Undo/Redo covers additions, edits and deletions. The staff is a pitch preview, not full score engraving: rests, ties across barlines, beaming and arbitrary MIDI durations are not engraved as a finished score. Patterns remain in memory during this session and can be exported as MIDI. Navigation preserves patterns and mixer settings.

Validation includes automated Web Audio and routing tests, scale formulas and classical return paths, staff placement and accidentals, grid snapping, type checking and production builds. Browser checks cover note editing, staff selection, undo, transport, navigation and responsive layouts. Physical MIDI hardware, sustain-pedal feel and subjective audio quality still need a hands-on check.

Theory references: [Open Music Theory: Minor Scales](https://viva.pressbooks.pub/openmusictheory/chapter/minor-scales/), [Diatonic Modes](https://viva.pressbooks.pub/openmusictheory/chapter/diatonic-modes/).
