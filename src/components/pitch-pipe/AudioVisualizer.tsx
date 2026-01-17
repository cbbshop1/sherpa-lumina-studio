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
    analyser.getByteFrequencyData(dataArray);

    // Clear canvas with gradient background
    const gradient = ctx.createLinearGradient(0, 0, 0, rect.height);
    gradient.addColorStop(0, "hsla(222.2, 47%, 11%, 1)");
    gradient.addColorStop(1, "hsla(222.2, 47%, 7%, 1)");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, rect.width, rect.height);

    // Draw frequency bars
    const barWidth = rect.width / bufferLength * 2.5;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * rect.height * 0.8;
      
      // Create gradient for each bar
      const barGradient = ctx.createLinearGradient(0, rect.height - barHeight, 0, rect.height);
      const hue = 217 + (i / bufferLength) * 45; // Blue to purple gradient
      barGradient.addColorStop(0, `hsla(${hue}, 91%, 60%, 0.9)`);
      barGradient.addColorStop(1, `hsla(${hue}, 91%, 40%, 0.6)`);
      
      ctx.fillStyle = barGradient;
      ctx.fillRect(x, rect.height - barHeight, barWidth - 2, barHeight);

      // Add glow effect for active bars
      if (barHeight > 10) {
        ctx.shadowColor = `hsla(${hue}, 91%, 60%, 0.5)`;
        ctx.shadowBlur = 10;
        ctx.fillRect(x, rect.height - barHeight, barWidth - 2, barHeight);
        ctx.shadowBlur = 0;
      }

      x += barWidth;
    }

    // Draw center line
    ctx.strokeStyle = "hsla(217, 91%, 60%, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, rect.height / 2);
    ctx.lineTo(rect.width, rect.height / 2);
    ctx.stroke();

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
      <h3 className="text-sm font-medium text-muted-foreground mb-3">Frequency Spectrum</h3>
      <canvas
        ref={canvasRef}
        className="w-full h-32 rounded-lg"
        style={{ display: "block" }}
      />
      {!isActive && (
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm text-muted-foreground">Play a tone to see visualization</span>
        </div>
      )}
    </div>
  );
};

export default AudioVisualizer;
