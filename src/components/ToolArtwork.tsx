export default function ToolArtwork({ kind }: { kind: string }) {
  return (
    <svg
      className={`tool-art art-${kind}`}
      viewBox="0 0 300 120"
      fill="none"
      aria-hidden="true"
    >
      {kind === "piano" && (
        <>
          <path
            d="M20 78H280M20 58H280M20 38H280"
            stroke="currentColor"
            opacity=".16"
          />
          <path
            d="M116 73V26L162 18V64"
            stroke="currentColor"
            strokeWidth="3"
          />
          <ellipse cx="106" cy="76" rx="12" ry="8" fill="currentColor" />
          <ellipse cx="152" cy="66" rx="12" ry="8" fill="currentColor" />
          <circle cx="216" cy="50" r="28" stroke="currentColor" opacity=".3" />
          <path d="M200 50H232M216 34V66" stroke="currentColor" />
        </>
      )}
      {kind === "chords" && (
        <>
          <path d="M65 70L150 28L235 70" stroke="currentColor" opacity=".5" />
          <path d="M65 70H235" stroke="currentColor" opacity=".2" />
          {[65, 150, 235].map((x, i) => (
            <g key={x}>
              <circle
                cx={x}
                cy={i === 1 ? 28 : 70}
                r="21"
                fill="currentColor"
                opacity=".13"
              />
              <text
                x={x}
                y={i === 1 ? 33 : 75}
                fill="currentColor"
                textAnchor="middle"
                fontFamily="monospace"
                fontSize="14"
              >
                {["1", "3", "5"][i]}
              </text>
            </g>
          ))}
        </>
      )}
      {kind === "scales" && (
        <>
          {[0, 1, 2, 3, 4, 5, 6].map((i) => (
            <g key={i}>
              <path
                d={`M${40 + i * 35} 92V${70 - i * 8}`}
                stroke="currentColor"
                opacity=".2"
              />
              <circle
                cx={40 + i * 35}
                cy={70 - i * 8}
                r="9"
                fill="currentColor"
                opacity={0.3 + i * 0.1}
              />
            </g>
          ))}
          <path
            d="M40 70L75 62L110 54L145 46L180 38L215 30L250 22"
            stroke="currentColor"
            opacity=".3"
          />
        </>
      )}
      {kind === "progressions" && (
        <>
          {[0, 1, 2, 3].map((i) => (
            <g key={i}>
              <rect
                x={26 + i * 66}
                y={32 + (i % 2) * 12}
                width="52"
                height="48"
                rx="9"
                stroke="currentColor"
                fill="currentColor"
                fillOpacity={i === 0 ? 0.16 : 0.04}
                opacity={i === 0 ? 1 : 0.55}
              />
              <text
                x={52 + i * 66}
                y={61 + (i % 2) * 12}
                fill="currentColor"
                textAnchor="middle"
                fontFamily="Georgia"
                fontSize="20"
              >
                {["I", "IV", "V", "I"][i]}
              </text>
            </g>
          ))}
        </>
      )}
      {kind === "pitch" && (
        <>
          <circle cx="109" cy="56" r="38" stroke="currentColor" opacity=".4" />
          <circle cx="109" cy="56" r="24" stroke="currentColor" opacity=".2" />
          <text
            x="109"
            y="61"
            textAnchor="middle"
            fill="currentColor"
            fontFamily="monospace"
            fontSize="15"
          >
            440
          </text>
          <path
            d="M178 55C188 22 198 22 208 55S228 88 238 55S258 22 268 55"
            stroke="currentColor"
            strokeWidth="2"
          />
        </>
      )}
      {kind === "studio" && (
        <>
          {Array.from({ length: 24 }, (_, i) => (
            <rect
              key={i}
              x={27 + i * 10.5}
              y={86 - (12 + Math.sin(i * 0.7) ** 2 * 56)}
              width="5"
              height={12 + Math.sin(i * 0.7) ** 2 * 56}
              rx="2"
              fill="currentColor"
              opacity={0.25 + i / 40}
            />
          ))}
          <path d="M25 94H280" stroke="currentColor" opacity=".2" />
        </>
      )}
    </svg>
  );
}
