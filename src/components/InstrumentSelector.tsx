import { cn } from "@/lib/utils";
import { INSTRUMENTS, InstrumentType } from "@/utils/instrumentSynthesis";

interface InstrumentSelectorProps {
  selected: InstrumentType;
  onSelect: (instrument: InstrumentType) => void;
}

const InstrumentSelector = ({ selected, onSelect }: InstrumentSelectorProps) => {
  const instruments = Object.entries(INSTRUMENTS) as [InstrumentType, typeof INSTRUMENTS[InstrumentType]][];

  return (
    <div className="flex flex-wrap justify-center gap-2">
      {instruments.map(([key, config]) => (
        <button
          key={key}
          onClick={() => onSelect(key)}
          className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-full border-2 transition-all duration-200",
            "hover:scale-105 hover:shadow-md",
            selected === key
              ? "bg-primary border-primary text-primary-foreground shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
              : "bg-card border-border text-foreground hover:border-primary/50"
          )}
        >
          <span className="text-lg">{config.icon}</span>
          <span className="font-medium text-sm">{config.name}</span>
        </button>
      ))}
    </div>
  );
};

export default InstrumentSelector;
