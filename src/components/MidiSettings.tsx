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
}

const MidiSettings = ({
  devices,
  selectedDeviceId,
  onSelectDevice,
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
            Connect your MIDI keyboard to play any note
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

          {/* Info */}
          {isSupported && (
            <div className="p-4 rounded-lg bg-muted/50 border border-border">
              <p className="text-xs text-muted-foreground">
                <strong>Full keyboard support:</strong> All 128 MIDI notes are now playable. 
                Notes in the C4-C5 range will also highlight on the on-screen piano.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MidiSettings;
