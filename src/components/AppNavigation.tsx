import { Music2, Radio, Sliders } from "lucide-react";
import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";

const AppNavigation = () => {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass-effect border-b border-border">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <span className="text-xl font-bold gradient-text">Lumina</span>
          </div>

          {/* Navigation Links */}
          <div className="flex items-center gap-1">
            <NavLink
              to="/"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )
              }
            >
              <Music2 className="w-4 h-4" />
              <span>Piano & Chords</span>
            </NavLink>
            
            <NavLink
              to="/pitch-pipe"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )
              }
            >
              <Radio className="w-4 h-4" />
              <span>Pitch Pipe</span>
            </NavLink>

            <NavLink
              to="/studio"
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-primary/20 text-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )
              }
            >
              <Sliders className="w-4 h-4" />
              <span>Studio</span>
            </NavLink>
          </div>

          {/* Spacer for balance */}
          <div className="w-20" />
        </div>
      </div>
    </nav>
  );
};

export default AppNavigation;
