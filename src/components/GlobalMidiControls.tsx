import { useLocation } from "react-router-dom";
import { useMidiSession } from "../context/MidiSession";
import { useStudioSession } from "../context/StudioSession";
import { useStudioStore } from "../store/studioStore";
import { midiNoteToName } from "../hooks/useMidiKeyboard";
import { formatNote } from "../lib/noteSelection";
import MidiSettings from "./MidiSettings";
import InstrumentSelector from "./InstrumentSelector";

export default function GlobalMidiControls() {
  const midi = useMidiSession();
  const session = useStudioSession();
  const { pathname } = useLocation();
  const path = pathname.replace(/\/+$/, "");
  const armed = useStudioStore(
    (state) => state.tracks.find((track) => track.recordArm)?.name,
  );
  if (path === "/piano") return null;
  return (
    <div className="global-midi-strip" aria-label="MIDI keyboard controls">
      <div className="global-midi-inner">
        <span className="midi-device-status">
          <i className={midi.selectedDevice ? "connected" : ""} />
          {midi.selectedDevice?.name || "MIDI keyboard"}
        </span>
        {path === "/studio" ? (
          <span className="midi-routing">
            Playing → {armed || "arm a track"}
          </span>
        ) : (
          <InstrumentSelector
            selected={session.instrument}
            onSelect={session.setInstrument}
            ariaLabel="MIDI instrument"
          />
        )}
        <span className="midi-held-notes" aria-label="Held MIDI notes">
          {midi.activeNotes
            .map((note) => formatNote(midiNoteToName(note).display))
            .join(" · ")}
        </span>
        <button
          className="midi-mute"
          aria-pressed={midi.enabled}
          onClick={midi.toggleEnabled}
        >
          {midi.enabled ? "MIDI on" : "MIDI muted"}
        </button>
        {midi.enabled && !midi.audioReady && (
          <button onClick={() => void midi.unlock()}>Enable MIDI sound</button>
        )}
        <button onClick={midi.panic} aria-label="All MIDI notes off">
          All notes off
        </button>
        <MidiSettings
          devices={midi.devices}
          selectedDeviceId={midi.selectedDeviceId}
          onSelectDevice={midi.selectDevice}
          isSupported={midi.isSupported}
          error={midi.error || midi.audioError || null}
          onRequestAccess={midi.requestMidiAccess}
          onPanic={midi.panic}
          enabled={midi.enabled}
          onToggleEnabled={midi.toggleEnabled}
          onUnlock={midi.unlock}
          audioReady={midi.audioReady}
        />
      </div>
    </div>
  );
}
