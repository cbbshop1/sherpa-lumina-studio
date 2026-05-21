import { useState, useEffect, useCallback, useRef } from 'react';

export interface MidiDevice {
  id: string;
  name: string;
}

// Helper to convert MIDI note number to note name and octave
export const midiNoteToName = (midiNote: number): { note: string; octave: number; display: string } => {
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const octave = Math.floor(midiNote / 12) - 1;
  const noteIndex = midiNote % 12;
  const note = noteNames[noteIndex];
  return { note, octave, display: `${note}${octave}` };
};

interface UseMidiKeyboardProps {
  onNotePress?:   (midiNote: number, velocity: number) => void;
  onNoteRelease?: (midiNote: number) => void;
  /** Pitch bend value in semitones, range ±2 (matches N-32 default ±2 semitone range). */
  onPitchBend?:   (semitones: number) => void;
  /** Raw MIDI CC message: cc number (0-127) and value (0-127). */
  onCC?:          (cc: number, value: number) => void;
  enabled?: boolean;
}

export const useMidiKeyboard = ({
  onNotePress,
  onNoteRelease,
  onPitchBend,
  onCC,
  enabled = true
}: UseMidiKeyboardProps) => {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const onNotePressRef   = useRef(onNotePress);
  const onNoteReleaseRef = useRef(onNoteRelease);
  const onPitchBendRef   = useRef(onPitchBend);
  const onCCRef          = useRef(onCC);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onNotePressRef.current   = onNotePress;
    onNoteReleaseRef.current = onNoteRelease;
    onPitchBendRef.current   = onPitchBend;
    onCCRef.current          = onCC;
  });

  // Check browser support
  useEffect(() => {
    setIsSupported('requestMIDIAccess' in navigator);
  }, []);

  // Request MIDI access
  const requestMidiAccess = useCallback(async () => {
    if (!isSupported) {
      setError('Web MIDI is not supported in this browser. Try Chrome, Edge, or Opera.');
      return false;
    }

    try {
      const access = await navigator.requestMIDIAccess();
      midiAccessRef.current = access;
      setMidiAccess(access);
      setError(null);
      
      // Get initial devices
      updateDeviceList(access);
      
      // Listen for device changes
      access.onstatechange = () => updateDeviceList(access);
      
      return true;
    } catch (err) {
      setError('MIDI access denied. Please grant permission to use MIDI devices.');
      return false;
    }
  }, [isSupported]);

  // Update device list
  const updateDeviceList = (access: MIDIAccess) => {
    const inputs: MidiDevice[] = [];
    access.inputs.forEach((input) => {
      inputs.push({
        id: input.id,
        name: input.name || 'Unknown Device'
      });
    });
    setDevices(inputs);
    
    // Auto-select if only one device and none selected
    if (inputs.length === 1 && !selectedDeviceId) {
      setSelectedDeviceId(inputs[0].id);
    }
  };

  // Handle MIDI messages - use refs to always get latest callbacks
  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    if (!enabled) return;

    const data    = event.data;
    const status  = data[0];
    const command = status & 0xF0;

    // Note On (0x90) with velocity > 0
    if (command === 0x90 && data[2] > 0) {
      onNotePressRef.current?.(data[1], data[2]);
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (command === 0x80 || (command === 0x90 && data[2] === 0)) {
      onNoteReleaseRef.current?.(data[1]);
    }
    // Pitch bend (0xE0) — 14-bit value, centre = 8192, range ±2 semitones
    else if (command === 0xE0) {
      const raw      = ((data[2] << 7) | data[1]) - 8192;
      const semitones = (raw / 8192) * 2;
      onPitchBendRef.current?.(semitones);
    }
    // Control change (0xB0)
    else if (command === 0xB0) {
      onCCRef.current?.(data[1], data[2]);
    }
  }, [enabled]);

  // Connect to selected device
  useEffect(() => {
    if (!midiAccess || !selectedDeviceId) return;

    const input = midiAccess.inputs.get(selectedDeviceId);
    if (input) {
      input.onmidimessage = handleMidiMessage;
      
      return () => {
        input.onmidimessage = null;
      };
    }
  }, [midiAccess, selectedDeviceId, handleMidiMessage]);

  // Auto-request MIDI access on mount if supported
  useEffect(() => {
    if (isSupported && enabled && !midiAccess) {
      requestMidiAccess();
    }
  }, [isSupported, enabled, midiAccess, requestMidiAccess]);

  const selectDevice = useCallback((deviceId: string | null) => {
    setSelectedDeviceId(deviceId);
    
    // Save to localStorage
    if (deviceId) {
      localStorage.setItem('midi-selected-device', deviceId);
    } else {
      localStorage.removeItem('midi-selected-device');
    }
  }, []);

  // Load saved settings
  useEffect(() => {
    const savedDevice = localStorage.getItem('midi-selected-device');
    
    if (savedDevice) {
      setSelectedDeviceId(savedDevice);
    }
  }, []);

  return {
    isSupported,
    midiAccess,
    devices,
    selectedDeviceId,
    selectedDevice: devices.find(d => d.id === selectedDeviceId) || null,
    error,
    requestMidiAccess,
    selectDevice,
  };
};
