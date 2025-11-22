import { Gem, Music2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-dark via-slate-darker to-slate-dark" />
      
      {/* Glow effects */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-primary/20 rounded-full blur-[128px] animate-glow-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-primary/20 rounded-full blur-[128px] animate-glow-pulse" style={{ animationDelay: '1s' }} />
      
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect mb-8 animate-slide-up">
          <Gem className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-muted-foreground">Master Music Theory</span>
        </div>
        
        <h1 className="text-6xl md:text-8xl font-bold mb-6 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <span className="gradient-text">Lumina</span>
          <br />
          <span className="text-foreground">Music Theory</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-muted-foreground max-w-3xl mx-auto mb-12 animate-slide-up" style={{ animationDelay: '0.2s' }}>
          Learn scales, chords, and progressions through interactive visualizations. 
          From beginner to advanced, master music theory at your own pace.
        </p>
        
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '0.3s' }}>
          <Button size="lg" className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-8 py-6 text-lg rounded-xl glow-blue transition-all hover:scale-105">
            <Music2 className="w-5 h-5 mr-2" />
            Start Learning
          </Button>
          <Button size="lg" variant="outline" className="border-border bg-card/50 hover:bg-card text-foreground font-semibold px-8 py-6 text-lg rounded-xl backdrop-blur-sm transition-all hover:scale-105">
            <Zap className="w-5 h-5 mr-2" />
            Explore Features
          </Button>
        </div>
        
        <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-6 animate-slide-up" style={{ animationDelay: '0.4s' }}>
          <div className="glass-effect p-6 rounded-2xl hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center mb-4 mx-auto">
              <Music2 className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Interactive Piano</h3>
            <p className="text-sm text-muted-foreground">Play and visualize notes on a virtual keyboard</p>
          </div>
          
          <div className="glass-effect p-6 rounded-2xl hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-secondary/20 flex items-center justify-center mb-4 mx-auto">
              <Zap className="w-6 h-6 text-secondary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Scale Explorer</h3>
            <p className="text-sm text-muted-foreground">Discover scales and their patterns visually</p>
          </div>
          
          <div className="glass-effect p-6 rounded-2xl hover:scale-105 transition-transform duration-300">
            <div className="w-12 h-12 rounded-xl bg-accent/20 flex items-center justify-center mb-4 mx-auto">
              <Gem className="w-6 h-6 text-accent" />
            </div>
            <h3 className="text-lg font-semibold mb-2">Chord Builder</h3>
            <p className="text-sm text-muted-foreground">Build and understand chord progressions</p>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
