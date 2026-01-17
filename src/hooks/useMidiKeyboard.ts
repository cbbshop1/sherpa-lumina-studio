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
  onNotePress?: (midiNote: number, velocity: number) => void;
  onNoteRelease?: (midiNote: number) => void;
  enabled?: boolean;
}

export const useMidiKeyboard = ({ 
  onNotePress, 
  onNoteRelease,
  enabled = true 
}: UseMidiKeyboardProps) => {
  const [midiAccess, setMidiAccess] = useState<MIDIAccess | null>(null);
  const [devices, setDevices] = useState<MidiDevice[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);
  const onNotePressRef = useRef(onNotePress);
  const onNoteReleaseRef = useRef(onNoteRelease);

  // Keep refs updated with latest callbacks
  useEffect(() => {
    onNotePressRef.current = onNotePress;
    onNoteReleaseRef.current = onNoteRelease;
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

    const [status, note, velocity] = event.data;
    const command = status & 0xF0;
    
    // Note On (0x90) with velocity > 0
    if (command === 0x90 && velocity > 0) {
      onNotePressRef.current?.(note, velocity);
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      onNoteReleaseRef.current?.(note);
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
