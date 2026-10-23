import { useCallback, useEffect, useRef, useState } from "react";
import { decodeMidi } from "../lib/liveMidi";
export interface MidiDevice {
  id: string;
  name: string;
}
export const midiNoteToName = (midi: number) => {
  const note = [
    "C",
    "C#",
    "D",
    "D#",
    "E",
    "F",
    "F#",
    "G",
    "G#",
    "A",
    "A#",
    "B",
  ][midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note, octave, display: `${note}${octave}` };
};
interface MidiCallbacks {
  onNotePress?: (note: number, velocity: number) => void;
  onNoteRelease?: (note: number) => void;
  onPitchBend?: (value: number) => void;
  onCC?: (number: number, value: number) => void;
  onReset?: () => void;
  enabled?: boolean;
}
function savedDevice(): string | null {
  try {
    return localStorage.getItem("midi-selected-device");
  } catch {
    return null;
  }
}
export function useMidiKeyboard(callbacks: MidiCallbacks) {
  const enabled = callbacks.enabled !== false;
  const [isSupported] = useState(
    () => typeof navigator !== "undefined" && "requestMIDIAccess" in navigator,
  );
  const [midiAccess, setAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedDeviceId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const preference = useRef(savedDevice());
  const accessRef = useRef<MIDIAccess | null>(null);
  const latest = useRef(callbacks);
  latest.current = callbacks;
  const attempted = useRef(false);
  const pending = useRef(false);
  const alive = useRef(true);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);
  const refresh = useCallback((access: MIDIAccess) => {
    const inputs: MidiDevice[] = [];
    access.inputs.forEach((input) => {
      if (input.state === "connected")
        inputs.push({ id: input.id, name: input.name || "MIDI keyboard" });
    });
    setDevices(inputs);
    const preferred = preference.current;
    setSelectedId(
      preferred === null
        ? inputs.length === 1
          ? inputs[0].id
          : null
        : inputs.some((input) => input.id === preferred)
          ? preferred
          : null,
    );
  }, []);
  const requestMidiAccess = useCallback(async () => {
    if (!isSupported || pending.current) return false;
    attempted.current = true;
    pending.current = true;
    try {
      const access = await navigator.requestMIDIAccess({ sysex: false });
      if (!alive.current) return false;
      accessRef.current = access;
      setAccess(access);
      refresh(access);
      setError(null);
      return true;
    } catch {
      if (alive.current)
        setError("MIDI access was not granted. Use Connect MIDI to try again.");
      return false;
    } finally {
      pending.current = false;
    }
  }, [isSupported, refresh]);
  useEffect(() => {
    if (enabled && isSupported && !midiAccess && !attempted.current)
      void requestMidiAccess();
  }, [enabled, isSupported, midiAccess, requestMidiAccess]);
  useEffect(() => {
    if (!midiAccess) return;
    const update = () => refresh(midiAccess);
    midiAccess.addEventListener("statechange", update);
    return () => midiAccess.removeEventListener("statechange", update);
  }, [midiAccess, refresh]);
  useEffect(() => {
    if (!midiAccess || !selectedDeviceId || !enabled) return;
    const input = midiAccess.inputs.get(selectedDeviceId);
    if (!input) return;
    const handle = (event: MIDIMessageEvent) => {
      if (!event.data) return;
      const message = decodeMidi(event.data);
      if (!message) return;
      if (message.type === "on")
        latest.current.onNotePress?.(message.note, message.velocity);
      if (message.type === "off") latest.current.onNoteRelease?.(message.note);
      if (message.type === "bend") latest.current.onPitchBend?.(message.value);
      if (message.type === "cc")
        latest.current.onCC?.(message.number, message.value);
    };
    input.addEventListener("midimessage", handle);
    return () => {
      input.removeEventListener("midimessage", handle);
      latest.current.onReset?.();
    };
  }, [midiAccess, selectedDeviceId, enabled]);
  const selectDevice = useCallback(
    (id: string | null) => {
      latest.current.onReset?.();
      preference.current = id ?? "";
      try {
        localStorage.setItem("midi-selected-device", id ?? "");
      } catch {
        /* Device selection still works without browser storage. */
      }
      if (accessRef.current) refresh(accessRef.current);
    },
    [refresh],
  );
  return {
    isSupported,
    midiAccess,
    devices,
    selectedDeviceId,
    selectedDevice:
      devices.find((device) => device.id === selectedDeviceId) ?? null,
    error,
    selectDevice,
    requestMidiAccess,
  };
}
