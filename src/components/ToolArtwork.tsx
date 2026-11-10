export default function ToolArtwork({ kind }: { kind: string }) {
  return (
    <svg
      className={`tool-art art-${kind}`}
      viewBox="0 0 300 120"
      fill="none"
      aria-hidden="true"
    >
      {kind === "chart" && (
        <>
          <path
            d="M30 24H270M30 34H270M30 44H270M30 54H270M30 64H270"
            stroke="currentColor"
            opacity=".22"
          />
          {[70, 130, 190, 250].map((x, index) => (
            <g key={x}>
              <ellipse cx={x} cy={[34, 39, 44, 29][index]} rx="8" ry="5.5" fill="currentColor" />
              <ellipse cx={x} cy={[54, 59, 59, 49][index]} rx="8" ry="5.5" fill="currentColor" opacity=".55" />
            </g>
          ))}
          <path d="M122 84V92H258V84" stroke="currentColor" strokeWidth="2" />
          <path d="M40 92H100" stroke="currentColor" strokeWidth="2" opacity=".4" />
        </>
      )}
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
      {kind === "rhythm" && (
        <>
          {/* 7/8 grouped 2+2+3: big dots for strong, smaller for lighter. */}
          {[3, 1, 2, 1, 2, 1, 1, 3, 1, 2, 1, 2, 1, 1].map((weight, i) => {
            const group = i % 7 < 2 ? 0 : i % 7 < 4 ? 1 : 2;
            const x = 34 + i * 17.5 + Math.floor(i / 7) * 8;
            return (
              <g key={i}>
                <circle
                  cx={x}
                  cy={54}
                  r={2.5 + weight * 3}
                  fill="currentColor"
                  opacity={0.3 + weight * 0.22}
                />
                <rect
                  x={x - 6}
                  y={78}
                  width="12"
                  height="12"
                  rx="3"
                  fill="currentColor"
                  opacity={group % 2 ? 0.14 : 0.28}
                />
              </g>
            );
          })}
          <path d="M25 94H280" stroke="currentColor" opacity=".2" />
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
