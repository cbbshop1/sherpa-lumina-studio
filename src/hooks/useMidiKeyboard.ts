import { useState, useEffect, useCallback, useRef } from 'react';

// MIDI note to piano note mapping (C4=60 to C5=72)
const midiNoteToPiano: Record<number, string> = {
  60: 'C',   // C4
  61: 'C#',
  62: 'D',
  63: 'D#',
  64: 'E',
  65: 'F',
  66: 'F#',
  67: 'G',
  68: 'G#',
  69: 'A',
  70: 'A#',
  71: 'B',
  72: 'C2',  // C5
};

export interface MidiDevice {
  id: string;
  name: string;
}

interface UseMidiKeyboardProps {
  onNotePress?: (note: string, velocity: number) => void;
  onNoteRelease?: (note: string) => void;
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
  const [octaveOffset, setOctaveOffset] = useState(0); // -2 to +2
  
  const midiAccessRef = useRef<MIDIAccess | null>(null);

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

  // Handle MIDI messages
  const handleMidiMessage = useCallback((event: MIDIMessageEvent) => {
    if (!enabled) return;

    const [status, note, velocity] = event.data;
    const command = status & 0xF0;
    
    // Note On (0x90)
    if (command === 0x90 && velocity > 0) {
      // Apply octave offset
      const adjustedNote = note + (octaveOffset * 12);
      const pianoNote = midiNoteToPiano[adjustedNote];
      
      if (pianoNote && onNotePress) {
        onNotePress(pianoNote, velocity);
      }
    }
    // Note Off (0x80) or Note On with velocity 0
    else if (command === 0x80 || (command === 0x90 && velocity === 0)) {
      const adjustedNote = note + (octaveOffset * 12);
      const pianoNote = midiNoteToPiano[adjustedNote];
      
      if (pianoNote && onNoteRelease) {
        onNoteRelease(pianoNote);
      }
    }
  }, [enabled, octaveOffset, onNotePress, onNoteRelease]);

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

  const changeOctaveOffset = useCallback((offset: number) => {
    const clampedOffset = Math.max(-2, Math.min(2, offset));
    setOctaveOffset(clampedOffset);
    localStorage.setItem('midi-octave-offset', clampedOffset.toString());
  }, []);

  // Load saved settings
  useEffect(() => {
    const savedDevice = localStorage.getItem('midi-selected-device');
    const savedOffset = localStorage.getItem('midi-octave-offset');
    
    if (savedDevice) {
      setSelectedDeviceId(savedDevice);
    }
    if (savedOffset) {
      setOctaveOffset(parseInt(savedOffset));
    }
  }, []);

  return {
    isSupported,
    midiAccess,
    devices,
    selectedDeviceId,
    selectedDevice: devices.find(d => d.id === selectedDeviceId) || null,
    error,
    octaveOffset,
    requestMidiAccess,
    selectDevice,
    changeOctaveOffset,
  };
};