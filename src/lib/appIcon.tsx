export function AppIconMark({ size }: { size: number }) {
  const cx = size / 2;
  const bowlW = size * 0.82;
  const bowlH = size * 0.52;
  const bowlCy = size * 0.6;
  const trackW = size * 0.68;
  const trackH = size * 0.4;
  const fieldW = size * 0.54;
  const fieldH = size * 0.28;

  const a = bowlW / 2;
  const b = bowlH / 2;
  const poleDx = a * 0.62;
  const ratio = poleDx / a;
  const poleBaseY = bowlCy - b * Math.sqrt(1 - ratio * ratio);
  const poleLen = size * 0.2;
  const poleTopY = poleBaseY - poleLen;
  const poleW = Math.max(1, Math.round(size * 0.032));
  const orb = size * 0.11;
  const halo = orb * 1.7;

  const tower = (dir: -1 | 1) => {
    const x = cx + dir * poleDx;
    return (
      <>
        <div
          style={{
            position: "absolute",
            left: Math.round(x - poleW / 2),
            top: Math.round(poleTopY),
            width: poleW,
            height: Math.round(poleLen),
            borderRadius: poleW,
            background: "rgba(226,232,240,0.9)",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: Math.round(x - halo / 2),
            top: Math.round(poleTopY - halo / 2),
            width: Math.round(halo),
            height: Math.round(halo),
            borderRadius: 9999,
            background: "#fbbf24",
            opacity: 0.35,
            mixBlendMode: "screen" as const,
          }}
        />
        <div
          style={{
            position: "absolute",
            left: Math.round(x - orb / 2),
            top: Math.round(poleTopY - orb / 2),
            width: Math.round(orb),
            height: Math.round(orb),
            borderRadius: 9999,
            background: "#fde68a",
            boxShadow: `0 0 ${Math.round(orb * 0.6)}px #fbbf24`,
          }}
        />
      </>
    );
  };

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        background: "linear-gradient(135deg, #0b3d91 0%, #0a0f1f 100%)",
      }}
    >
      <div style={{ position: "relative", width: size, height: size, display: "flex" }}>
        {tower(-1)}
        {tower(1)}
        <div
          style={{
            position: "absolute",
            left: Math.round(cx - bowlW / 2),
            top: Math.round(bowlCy - bowlH / 2),
            width: Math.round(bowlW),
            height: Math.round(bowlH),
            borderRadius: 9999,
            background: "linear-gradient(180deg, #f8fafc 0%, #cbd5e1 100%)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              position: "absolute",
              width: Math.round(trackW),
              height: Math.round(trackH),
              borderRadius: 9999,
              background: "#0e1b3d",
            }}
          />
          <div
            style={{
              position: "relative",
              width: Math.round(fieldW),
              height: Math.round(fieldH),
              borderRadius: 9999,
              background: "linear-gradient(180deg, #22c55e 0%, #15803d 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div
              style={{
                position: "absolute",
                width: Math.max(1, Math.round(size * 0.014)),
                height: Math.round(fieldH * 0.86),
                background: "rgba(255,255,255,0.6)",
                opacity: 0.55,
              }}
            />
            <div
              style={{
                width: Math.round(fieldH * 0.46),
                height: Math.round(fieldH * 0.46),
                borderRadius: 9999,
                border: `${Math.max(1, Math.round(size * 0.012))}px solid rgba(255,255,255,0.6)`,
                opacity: 0.55,
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
