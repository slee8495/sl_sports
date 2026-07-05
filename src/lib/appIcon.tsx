export function AppIconMark({ size }: { size: number }) {
  const circleSize = Math.round(size * 0.52);
  const inner = Math.round(size * 0.82);

  const circle = (color: string, style: Record<string, number | string>) => (
    <div
      style={{
        position: "absolute",
        width: circleSize,
        height: circleSize,
        borderRadius: 9999,
        background: color,
        opacity: 0.9,
        mixBlendMode: "screen" as const,
        ...style,
      }}
    />
  );

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
      <div style={{ position: "relative", width: inner, height: inner, display: "flex" }}>
        {circle("#f97316", { top: 0, left: 0 })}
        {circle("#22c55e", { top: 0, right: 0 })}
        {circle("#38bdf8", { bottom: 0, left: inner / 2 - circleSize / 2 })}
      </div>
    </div>
  );
}
