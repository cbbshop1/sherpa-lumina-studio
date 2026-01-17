import { Radio } from "lucide-react";

const PitchPipeHero = () => {
  return (
    <section className="relative py-16 overflow-hidden">
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
        
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Generate precise frequencies with waveform control. Perfect for tuning, ear training, and audio experimentation.
        </p>
      </div>
    </section>
  );
};

export default PitchPipeHero;
