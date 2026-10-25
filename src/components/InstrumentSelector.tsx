import { INSTRUMENTS, type InstrumentType } from "@/utils/instrumentSynthesis";
interface InstrumentSelectorProps {
  selected: InstrumentType;
  onSelect: (instrument: InstrumentType) => void;
  ariaLabel?: string;
}
export default function InstrumentSelector({
  selected,
  onSelect,
  ariaLabel = "Piano instrument",
}: InstrumentSelectorProps) {
  return (
    <label className="piano-instrument">
      <span className="studio-eyebrow">INSTRUMENT</span>
      <select
        aria-label={ariaLabel}
        value={selected}
        onChange={(event) => onSelect(event.target.value as InstrumentType)}
      >
        {Object.entries(INSTRUMENTS).map(([id, instrument]) => (
          <option key={id} value={id}>
            {instrument.name}
          </option>
        ))}
      </select>
    </label>
  );
}
