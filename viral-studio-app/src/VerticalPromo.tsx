import {
  AbsoluteFill,
  Easing,
  Sequence,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const colors = {
  background: "#080910",
  surface: "#111522",
  text: "#F5F7FF",
  muted: "#9AA3B8",
  violet: "#A78BFA",
  cyan: "#58E6D1",
};

const enter = Easing.bezier(0.16, 1, 0.3, 1);

const Backdrop: React.FC<{ readonly accent: string }> = ({ accent }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        overflow: "hidden",
        backgroundColor: colors.background,
        backgroundImage: `radial-gradient(ellipse at 50% 40%, ${accent}20 0%, transparent 58%), linear-gradient(155deg, #0E1220 0%, ${colors.background} 58%, #10101C 100%)`,
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 820,
          height: 820,
          top: 220,
          left: 130,
          border: `1px solid ${accent}22`,
          borderRadius: "50%",
          scale: interpolate(frame, [0, 120], [0.94, 1.06], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          opacity: 0.7,
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage:
            "linear-gradient(#FFFFFF08 1px, transparent 1px), linear-gradient(90deg, #FFFFFF08 1px, transparent 1px)",
          backgroundSize: "96px 96px",
          maskImage:
            "linear-gradient(to bottom, transparent 4%, black 38%, transparent 92%)",
          opacity: 0.28,
        }}
      />
    </AbsoluteFill>
  );
};

const TopBar: React.FC<{ readonly section: string }> = ({ section }) => (
  <div
    style={{
      position: "absolute",
      top: 92,
      left: 84,
      right: 84,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      color: colors.muted,
      fontFamily: "Arial, Helvetica, sans-serif",
      fontSize: 22,
      fontWeight: 700,
      letterSpacing: 4,
      textTransform: "uppercase",
    }}
  >
    <span>VIRAL STUDIO</span>
    <span style={{ color: colors.violet }}>{section}</span>
  </div>
);

const SceneOne: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Backdrop accent={colors.violet} />
      <TopBar section="01 / 03" />
      <div
        style={{
          position: "absolute",
          top: 515,
          left: 90,
          right: 90,
          opacity: interpolate(frame, [0, 12], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 18], ["0px 42px", "0px 0px"], {
            easing: enter,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            color: colors.violet,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 25,
            fontWeight: 700,
            letterSpacing: 6,
            marginBottom: 34,
            textTransform: "uppercase",
          }}
        >
          Una idea puede cambiarlo todo
        </div>
        <div
          style={{
            color: colors.text,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 96,
            fontWeight: 900,
            letterSpacing: -4,
            lineHeight: 1.04,
            scale: interpolate(frame, [0, fps], [0.9, 1], {
              easing: enter,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          TU CONTENIDO
          <br />
          MERECE
          <br />
          <span style={{ color: colors.violet }}>DESTACAR.</span>
        </div>
        <div
          style={{
            width: interpolate(frame, [14, 38], [0, 270], {
              easing: enter,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            height: 5,
            marginTop: 42,
            borderRadius: 99,
            background: `linear-gradient(90deg, ${colors.violet}, ${colors.cyan})`,
            boxShadow: `0 0 35px ${colors.violet}88`,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 132,
          left: 90,
          color: colors.muted,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 24,
          letterSpacing: 2,
          opacity: interpolate(frame, [45, 65], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        DEJA DE PUBLICAR AL AZAR
      </div>
    </AbsoluteFill>
  );
};

type ProcessCardProps = {
  readonly frame: number;
  readonly index: number;
  readonly step: string;
  readonly title: string;
  readonly description: string;
  readonly accent: string;
};

const ProcessCard: React.FC<ProcessCardProps> = ({
  frame,
  index,
  step,
  title,
  description,
  accent,
}) => (
  <div
    style={{
      position: "relative",
      display: "flex",
      alignItems: "center",
      gap: 30,
      width: 850,
      minHeight: 218,
      padding: "30px 38px",
      boxSizing: "border-box",
      border: `1px solid ${accent}55`,
      borderRadius: 28,
      background: `linear-gradient(115deg, ${colors.surface}F2, #0B0D16F2)`,
      boxShadow: `0 24px 70px #00000055, inset 0 1px 0 ${accent}22`,
      opacity: interpolate(frame, [18 + index * 12, 38 + index * 12], [0, 1], {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      }),
      translate: interpolate(
        frame,
        [18 + index * 12, 42 + index * 12],
        ["72px 0px", "0px 0px"],
        {
          easing: enter,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      ),
      scale: interpolate(
        frame,
        [18 + index * 12, 42 + index * 12],
        [0.96, 1],
        {
          easing: enter,
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        },
      ),
    }}
  >
    <div
      style={{
        display: "grid",
        placeItems: "center",
        flex: "0 0 88px",
        width: 88,
        height: 88,
        borderRadius: 24,
        color: accent,
        backgroundColor: `${accent}18`,
        border: `1px solid ${accent}44`,
        fontFamily: "Arial, Helvetica, sans-serif",
        fontSize: 28,
        fontWeight: 800,
      }}
    >
      {step}
    </div>
    <div>
      <div
        style={{
          color: colors.text,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 38,
          fontWeight: 800,
          marginBottom: 12,
        }}
      >
        {title}
      </div>
      <div
        style={{
          color: colors.muted,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 24,
          lineHeight: 1.4,
        }}
      >
        {description}
      </div>
    </div>
  </div>
);

const SceneTwo: React.FC = () => {
  const frame = useCurrentFrame();
  const steps = [
    {
      step: "01",
      title: "Encuentra la idea",
      description: "Define qué quieres contar y a quién.",
      accent: colors.violet,
    },
    {
      step: "02",
      title: "Crea con intención",
      description: "Convierte tu mensaje en una historia visual.",
      accent: colors.cyan,
    },
    {
      step: "03",
      title: "Publica y conecta",
      description: "Comparte algo que la gente quiera recordar.",
      accent: "#FFB86B",
    },
  ];

  return (
    <AbsoluteFill>
      <Backdrop accent={colors.cyan} />
      <TopBar section="02 / 03" />
      <div
        style={{
          position: "absolute",
          top: 265,
          left: 90,
          right: 90,
          color: colors.text,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 62,
          fontWeight: 900,
          letterSpacing: -2,
          lineHeight: 1.08,
          opacity: interpolate(frame, [0, 18], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 20], ["0px 28px", "0px 0px"], {
            easing: enter,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        DE LA IDEA
        <br />
        AL <span style={{ color: colors.cyan }}>IMPACTO.</span>
      </div>
      <div
        style={{
          position: "absolute",
          top: 635,
          left: 115,
          display: "flex",
          flexDirection: "column",
          gap: 30,
        }}
      >
        {steps.map((item, index) => (
          <ProcessCard key={item.step} frame={frame} index={index} {...item} />
        ))}
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 124,
          left: 90,
          right: 90,
          display: "flex",
          justifyContent: "space-between",
          color: colors.muted,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 20,
          letterSpacing: 3,
          textTransform: "uppercase",
          opacity: interpolate(frame, [98, 125], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <span>Una historia</span>
        <span style={{ color: colors.cyan }}>Con propósito</span>
      </div>
    </AbsoluteFill>
  );
};

const SceneThree: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Backdrop accent={colors.violet} />
      <TopBar section="03 / 03" />
      <div
        style={{
          position: "absolute",
          top: 390,
          left: 130,
          width: 820,
          height: 820,
          borderRadius: "50%",
          border: `1px solid ${colors.violet}44`,
          boxShadow: `0 0 100px ${colors.violet}18, inset 0 0 100px ${colors.violet}10`,
          scale: interpolate(frame, [0, fps], [0.72, 1], {
            easing: enter,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          opacity: interpolate(frame, [0, 15], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      />
      <div
        style={{
          position: "absolute",
          top: 615,
          left: 70,
          right: 70,
          textAlign: "center",
          opacity: interpolate(frame, [10, 30], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
          translate: interpolate(frame, [0, 34], ["0px 55px", "0px 0px"], {
            easing: enter,
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        <div
          style={{
            color: colors.text,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 79,
            fontWeight: 900,
            letterSpacing: -3,
            lineHeight: 1.05,
          }}
        >
          TU PRÓXIMA
          <br />
          GRAN IDEA
          <br />
          <span style={{ color: colors.violet }}>EMPIEZA HOY.</span>
        </div>
        <div
          style={{
            marginTop: 44,
            color: colors.muted,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 26,
            letterSpacing: 2,
          }}
        >
          Haz que cada historia cuente.
        </div>
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minWidth: 350,
            height: 78,
            marginTop: 52,
            padding: "0 34px",
            borderRadius: 999,
            color: "#090A11",
            background: `linear-gradient(100deg, ${colors.violet}, ${colors.cyan})`,
            boxShadow: `0 12px 50px ${colors.violet}44`,
            fontFamily: "Arial, Helvetica, sans-serif",
            fontSize: 23,
            fontWeight: 900,
            letterSpacing: 3,
            opacity: interpolate(frame, [fps, fps + 18], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
            scale: interpolate(frame, [fps, fps + 18], [0.9, 1], {
              easing: enter,
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            }),
          }}
        >
          VAMOS A CREAR
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 104,
          left: 0,
          right: 0,
          color: colors.muted,
          fontFamily: "Arial, Helvetica, sans-serif",
          fontSize: 19,
          letterSpacing: 5,
          textAlign: "center",
          opacity: interpolate(frame, [fps + 20, fps + 40], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          }),
        }}
      >
        VIRAL STUDIO
      </div>
    </AbsoluteFill>
  );
};

export const VerticalPromo: React.FC = () => {
  const { fps } = useVideoConfig();

  return (
    <AbsoluteFill>
      <Sequence durationInFrames={4 * fps}>
        <SceneOne />
      </Sequence>
      <Sequence from={4 * fps} durationInFrames={5 * fps}>
        <SceneTwo />
      </Sequence>
      <Sequence from={9 * fps} durationInFrames={6 * fps}>
        <SceneThree />
      </Sequence>
    </AbsoluteFill>
  );
};
