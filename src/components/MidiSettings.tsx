import { Settings, Keyboard } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { MidiDevice } from "@/hooks/useMidiKeyboard";

interface MidiSettingsProps {
  devices: MidiDevice[];
  selectedDeviceId: string | null;
  octaveOffset: number;
  onSelectDevice: (deviceId: string | null) => void;
  onChangeOctaveOffset: (offset: number) => void;
  isSupported: boolean;
  error: string | null;
}

const MidiSettings = ({
  devices,
  selectedDeviceId,
  octaveOffset,
  onSelectDevice,
  onChangeOctaveOffset,
  isSupported,
  error,
}: MidiSettingsProps) => {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Keyboard className="w-4 h-4" />
          MIDI Settings
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            MIDI Keyboard Settings
          </DialogTitle>
          <DialogDescription>
            Configure your MIDI keyboard connection and preferences
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-6 py-4">
          {/* Browser Support Warning */}
          {!isSupported && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Your browser doesn't support Web MIDI. Try Chrome, Edge, or Opera.
              </p>
            </div>
          )}

          {/* Error Display */}
          {error && isSupported && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          )}

          {/* Device Selection */}
          {isSupported && (
            <div className="space-y-2">
              <Label htmlFor="midi-device">MIDI Device</Label>
              <Select
                value={selectedDeviceId || "none"}
                onValueChange={(value) => onSelectDevice(value === "none" ? null : value)}
              >
                <SelectTrigger id="midi-device">
                  <SelectValue placeholder="Select a MIDI device" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No MIDI device</SelectItem>
                  {devices.map((device) => (
                    <SelectItem key={device.id} value={device.id}>
                      {device.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {devices.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  No MIDI devices detected. Connect a MIDI keyboard and refresh the page.
                </p>
              )}
            </div>
          )}

          {/* Octave Offset */}
          {isSupported && (
            <div className="space-y-2">
              <Label htmlFor="octave-offset">Octave Offset</Label>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChangeOctaveOffset(octaveOffset - 1)}
                  disabled={octaveOffset <= -2}
                >
                  -
                </Button>
                <div className="flex-1 text-center">
                  <span className="text-lg font-semibold">
                    {octaveOffset > 0 ? '+' : ''}{octaveOffset}
                  </span>
                  <p className="text-xs text-muted-foreground">octaves</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => onChangeOctaveOffset(octaveOffset + 1)}
                  disabled={octaveOffset >= 2}
                >
                  +
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Shift MIDI notes up or down by octaves
              </p>
            </div>
          )}

          {/* Info */}
          {isSupported && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Make sure your MIDI keyboard is connected before opening this page. 
                The app listens to MIDI notes 60-72 (C4-C5).
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MidiSettings;