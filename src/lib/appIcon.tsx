export function AppIconMark({ size }: { size: number }) {
  const innerWidth = Math.round(size * 0.82);
  const slot = innerWidth / 3;
  const barWidth = Math.max(1, Math.round(slot * 0.34));
  const maxBarHeight = Math.round(size * 0.34);
  const orbSize = Math.round(size * 0.155);
  const haloSize = Math.round(orbSize * 1.5);
  const fieldHeight = Math.max(1, Math.round(size * 0.028));

  const bars: { color: string; scale: number }[] = [
    { color: "#f97316", scale: 0.58 },
    { color: "#22c55e", scale: 0.8 },
    { color: "#38bdf8", scale: 1 },
  ];

  const light = ({ color, scale }: { color: string; scale: number }) => {
    const barHeight = Math.round(maxBarHeight * scale);
    return (
      <div
        style={{
          width: slot,
          height: maxBarHeight + orbSize,
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
          justifyContent: "flex-end",
        }}
      >
        <div
          style={{
            position: "relative",
            width: haloSize,
            height: haloSize,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: haloSize,
              height: haloSize,
              borderRadius: 9999,
              background: color,
              opacity: 0.3,
              mixBlendMode: "screen" as const,
            }}
          />
          <div
            style={{
              width: orbSize,
              height: orbSize,
              borderRadius: 9999,
              background: color,
              boxShadow: `0 0 ${Math.round(orbSize * 0.55)}px ${color}`,
            }}
          />
        </div>
        <div
          style={{
            marginTop: -Math.round(orbSize * 0.28),
            width: barWidth,
            height: barHeight,
            borderRadius: barWidth,
            background: "rgba(255,255,255,0.85)",
          }}
        />
      </div>
    );
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #0b3d91 0%, #0a0f1f 100%)",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column" as const,
          alignItems: "center",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            width: innerWidth,
          }}
        >
          {bars.map((bar) => light(bar))}
        </div>
        <div
          style={{
            marginTop: Math.round(size * 0.045),
            width: innerWidth,
            height: fieldHeight,
            borderRadius: fieldHeight,
            background: "rgba(255,255,255,0.22)",
          }}
        />
      </div>
    </div>
  );
}
