import { INSTRUMENTS, type InstrumentType } from "@/utils/instrumentSynthesis";
interface InstrumentSelectorProps {
  selected: InstrumentType;
  onSelect: (instrument: InstrumentType) => void;
}
export default function InstrumentSelector({
  selected,
  onSelect,
}: InstrumentSelectorProps) {
  return (
    <label className="piano-instrument">
      <span className="studio-eyebrow">INSTRUMENT</span>
      <select
        aria-label="Piano instrument"
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
