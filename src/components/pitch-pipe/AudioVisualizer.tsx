import { useRef, useEffect, useCallback } from "react";

interface AudioVisualizerProps {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const AudioVisualizer = ({ analyser, isActive }: AudioVisualizerProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);

  const draw = useCallback(() => {
    if (!canvasRef.current || !analyser) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size for retina displays
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    
    // Use time domain data for waveform (oscilloscope style)
    analyser.getByteTimeDomainData(dataArray);

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, "hsla(222.2, 47%, 11%, 1)");
    gradient.addColorStop(1, "hsla(222.2, 47%, 7%, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw center line
    ctx.strokeStyle = "hsla(217, 91%, 60%, 0.15)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();

    // Draw waveform
    ctx.lineWidth = 2;
    
    // Create gradient for the waveform line
    const waveGradient = ctx.createLinearGradient(0, 0, rect.width, 0);
    waveGradient.addColorStop(0, "hsla(217, 91%, 60%, 0.9)");
    waveGradient.addColorStop(0.5, "hsla(280, 91%, 65%, 0.9)");
    waveGradient.addColorStop(1, "hsla(217, 91%, 60%, 0.9)");
    ctx.strokeStyle = waveGradient;

    ctx.beginPath();

    const sliceWidth = rect.width / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      // Convert byte data (0-255) to normalized value (0-1)
      const v = dataArray[i] / 255.0;
      const y = v * rect.height;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }

      x += sliceWidth;
    }

    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();

    // Add glow effect
    ctx.shadowColor = "hsla(217, 91%, 60%, 0.5)";
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0;

    animationRef.current = requestAnimationFrame(draw);
  }, [analyser]);

  useEffect(() => {
    if (isActive && analyser) {
      draw();
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive, analyser, draw]);

  return (
    <div className="glass-effect rounded-2xl p-4">
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Waveform</h3>
      <div className="relative">
        <canvas
          ref={canvasRef}
          className="w-full h-32 rounded-lg"
          style={{ display: "block" }}
        />
        {!isActive && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-muted-foreground">Play a tone to see waveform</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default AudioVisualizer;
