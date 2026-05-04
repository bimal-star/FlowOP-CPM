/** FlowOP timeline column — green #2d6a4f, amber #d4a017, grey #64748b */

const GREEN = '#2d6a4f'
const AMBER = '#d4a017'
const GREY = '#64748b'
const WHITE = '#ffffff'
const DESC = '#94a3b8'
const LINE = 'rgba(255,255,255,0.22)'

const VB_W = 520
const CARD_W = VB_W * 0.7
const CARD_X = 74

const LX = 32
const R = 14

function StepGroup({
  delaySec,
  cy,
  fill,
  n,
  title,
  desc,
  titleY,
  descY,
}: {
  delaySec: number
  cy: number
  fill: string
  n: number
  title: string
  desc: string
  titleY: number
  descY: number
}) {
  return (
    <g
      className="login-timeline-node"
      style={{ animationDelay: `${delaySec}s` }}
    >
      <circle cx={LX} cy={cy} r={R} fill={fill} />
      <text
        x={LX}
        y={cy + 4}
        textAnchor="middle"
        fill={WHITE}
        fontSize={11}
        fontWeight={700}
        fontFamily="system-ui, Segoe UI, sans-serif"
      >
        {n}
      </text>
      <text
        x={74}
        y={titleY}
        fill={WHITE}
        fontSize={13}
        fontWeight={700}
        fontFamily="system-ui, Segoe UI, sans-serif"
      >
        {title}
      </text>
      <text
        x={74}
        y={descY}
        fill={DESC}
        fontSize={11}
        fontWeight={400}
        fontFamily="system-ui, Segoe UI, sans-serif"
      >
        {desc}
      </text>
    </g>
  )
}

type CardProps = {
  y: number
  delaySec: number
  accent: string
  bg: string
  left: string
  right: string
}

const CARD_H = 24

function TaskCard({ y, delaySec, accent, bg, left, right }: CardProps) {
  const midY = y + 15
  const rightX = CARD_X + CARD_W - 6
  const textX = CARD_X + 9
  return (
    <g
      className="login-timeline-node"
      style={{ animationDelay: `${delaySec}s` }}
    >
      <rect
        x={CARD_X}
        y={y}
        width={CARD_W}
        height={CARD_H}
        rx={4}
        fill={bg}
      />
      <rect x={CARD_X} y={y} width={3} height={CARD_H} fill={accent} />
      <text
        x={textX}
        y={midY}
        fill={WHITE}
        fontSize={10}
        fontFamily="system-ui, Segoe UI, sans-serif"
        fontWeight={500}
      >
        {left}
      </text>
      <text
        x={rightX}
        y={midY}
        textAnchor="end"
        fill={WHITE}
        fontSize={10}
        fontFamily="system-ui, Segoe UI, sans-serif"
        opacity={0.85}
      >
        {right}
      </text>
    </g>
  )
}

/** Timeline; centre spacing 1–3 and 4–5 is 64px; solid vertical spine */
export function LoginTimelineSvg() {
  const VB_H = 438

  return (
    <svg
      className="block h-auto max-h-full w-full min-h-0"
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      <g className="login-timeline-node" style={{ animationDelay: '0s' }}>
        <line
          x1={LX}
          y1={10}
          x2={LX}
          y2={432}
          stroke={LINE}
          strokeWidth={1.5}
        />
      </g>

      <StepGroup
        delaySec={0}
        cy={40}
        fill={GREEN}
        n={1}
        title="Capture"
        desc="Log every enquiry the moment it arrives"
        titleY={36}
        descY={56}
      />

      <StepGroup
        delaySec={0.2}
        cy={104}
        fill={GREEN}
        n={2}
        title="Track"
        desc="Move conversations through your pipeline"
        titleY={100}
        descY={120}
      />

      <StepGroup
        delaySec={0.4}
        cy={168}
        fill={AMBER}
        n={3}
        title="Act"
        desc="Manage follow-ups so nothing goes cold"
        titleY={164}
        descY={184}
      />

      <TaskCard
        y={198}
        delaySec={0.6}
        accent={AMBER}
        bg="rgba(212, 160, 23, 0.18)"
        left="Send discovery call follow up"
        right="Due today"
      />

      <TaskCard
        y={228}
        delaySec={0.8}
        accent={GREEN}
        bg="rgba(45, 106, 79, 0.22)"
        left="Chase proposal if no response"
        right="In 3 days"
      />

      <TaskCard
        y={258}
        delaySec={1}
        accent={GREY}
        bg="rgba(100, 116, 139, 0.2)"
        left="Final check before closing"
        right="In 2 weeks"
      />

      <g className="login-timeline-node" style={{ animationDelay: '1.2s' }}>
        <text
          x={74}
          y={292}
          fill={GREY}
          fontSize={9}
          fontFamily="system-ui, Segoe UI, sans-serif"
        >
          + follow-ups can be added at any stage
        </text>
      </g>

      <StepGroup
        delaySec={1.4}
        cy={346}
        fill={GREEN}
        n={4}
        title="Communicate"
        desc="Send consistent responses from templates"
        titleY={342}
        descY={362}
      />

      <StepGroup
        delaySec={1.6}
        cy={410}
        fill={GREEN}
        n={5}
        title="Win"
        desc="Convert enquiries into paying clients"
        titleY={406}
        descY={426}
      />
    </svg>
  )
}
