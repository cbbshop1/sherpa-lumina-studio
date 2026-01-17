import { Radio, Waves, Settings2 } from "lucide-react";

const PitchPipeHero = () => {
  return (
    <section className="relative py-20 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-dark via-slate-darker to-slate-dark" />
      
      {/* Glow effects */}
      <div className="absolute top-1/2 left-1/3 w-64 h-64 bg-primary/15 rounded-full blur-[100px] animate-glow-pulse" />
      <div className="absolute top-1/2 right-1/3 w-64 h-64 bg-secondary/15 rounded-full blur-[100px] animate-glow-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-4xl mx-auto px-6 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-6">
          <Radio className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Precision Audio Reference</span>
        </div>
        
        <h1 className="text-5xl md:text-6xl font-bold mb-4">
          <span className="gradient-text">Pitch Pipe</span>
        </h1>
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10">
          Generate precise frequencies with waveform control. Perfect for tuning, ear training, and audio experimentation.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div className="glass-effect p-4 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center mb-3 mx-auto">
              <Radio className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Frequency Control</h3>
            <p className="text-xs text-muted-foreground">20Hz - 2000Hz range with precision dial</p>
          </div>
          
          <div className="glass-effect p-4 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-secondary/20 flex items-center justify-center mb-3 mx-auto">
              <Waves className="w-5 h-5 text-secondary" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Waveforms</h3>
            <p className="text-xs text-muted-foreground">Sine, square, triangle & sawtooth</p>
          </div>
          
          <div className="glass-effect p-4 rounded-xl">
            <div className="w-10 h-10 rounded-lg bg-accent/20 flex items-center justify-center mb-3 mx-auto">
              <Settings2 className="w-5 h-5 text-accent" />
            </div>
            <h3 className="text-sm font-semibold mb-1">Full Control</h3>
            <p className="text-xs text-muted-foreground">Filter, envelope & chord building</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default PitchPipeHero;
