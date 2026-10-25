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
  onSelectDevice: (deviceId: string | null) => void;
  isSupported: boolean;
  error: string | null;
  onRequestAccess?: () => Promise<boolean>;
  onPanic?: () => void;
  enabled?: boolean;
  onToggleEnabled?: () => void;
  onUnlock?: () => Promise<void>;
  audioReady?: boolean;
}

const MidiSettings = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
  isSupported,
  error,
  onRequestAccess,
  onPanic,
  enabled = true,
  onToggleEnabled,
  onUnlock,
  audioReady = true,
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
            Connect your MIDI keyboard to play any note
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="flex flex-wrap gap-2">
            {isSupported && onRequestAccess && (
              <Button onClick={() => void onRequestAccess()}>
                Connect MIDI
              </Button>
            )}
            {onPanic && (
              <Button variant="outline" onClick={onPanic}>
                All notes off
              </Button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {onToggleEnabled && (
              <Button
                variant="outline"
                aria-pressed={enabled}
                onClick={onToggleEnabled}
              >
                {enabled ? "MIDI on" : "MIDI muted"}
              </Button>
            )}
            {onUnlock && !audioReady && (
              <Button onClick={() => void onUnlock()}>Enable MIDI sound</Button>
            )}
          </div>
          {/* Browser Support Warning */}
          {!isSupported && (
            <div className="p-4 rounded-lg bg-destructive/10 border border-destructive/20">
              <p className="text-sm text-destructive">
                Your browser doesn't support Web MIDI. Try Chrome, Edge, or
                Opera.
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
                onValueChange={(value) =>
                  onSelectDevice(value === "none" ? null : value)
                }
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
                  No MIDI devices detected. Connect your keyboard, then choose
                  Connect MIDI if permission is needed.
                </p>
              )}
            </div>
          )}

          {/* Info */}
          {isSupported && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Play from any workspace:</strong> Your MIDI connection
                follows you between tools. In Studio, MIDI plays and records
                into the armed track. Escape releases all notes.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MidiSettings;
