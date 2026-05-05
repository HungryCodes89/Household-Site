'use client'

import styles from './HouseSVG.module.css'

const ROOF = 'M 30 130 L 200 40 L 370 130 L 360 145 L 200 60 L 40 145 Z'
const BODY =
  'M 40 170 L 160 170 L 160 195 L 240 195 L 240 170 L 360 170' +
  ' L 360 270 L 335 270 L 335 320 L 360 320 L 360 410' +
  ' L 240 410 L 240 365 L 160 365 L 160 410 L 40 410' +
  ' L 40 320 L 65 320 L 65 270 L 40 270 Z'

interface Props {
  skip?: boolean
}

export default function HouseSVG({ skip = false }: Props) {
  return (
    <div className={`${styles.wrap} ${skip ? styles.skip : ''}`}>
      <div className={styles.glow} aria-hidden="true" />

      <svg
        viewBox="0 0 400 460"
        xmlns="http://www.w3.org/2000/svg"
        className={styles.svg}
        aria-label="HOUSEHOLD house logo"
      >
        <defs>
          <clipPath id="bloom">
            <circle cx="200" cy="240" r={skip ? 320 : 0}>
              {!skip && (
                <animate
                  attributeName="r"
                  values="0;320"
                  dur="0.85s"
                  begin="3s"
                  fill="freeze"
                />
              )}
            </circle>
          </clipPath>
        </defs>

        {/* Measurement marks — drafting layer */}
        <g
          className={styles.marks}
          stroke="var(--draft)"
          fill="none"
          strokeWidth="0.5"
          fontFamily="var(--font-mono)"
          fontSize="7"
        >
          {/* Horizontal dimension line at top */}
          <line x1="30" y1="14" x2="370" y2="14" strokeDasharray="3 2" />
          <line x1="30" y1="10" x2="30" y2="18" />
          <line x1="370" y1="10" x2="370" y2="18" />
          <polyline points="38,11 30,14 38,17" />
          <polyline points="362,11 370,14 362,17" />
          <text x="200" y="11" textAnchor="middle" fill="var(--draft)" stroke="none" letterSpacing="1">340</text>
          {/* Mid ticks */}
          <line x1="100" y1="11" x2="100" y2="17" />
          <line x1="200" y1="10" x2="200" y2="18" />
          <line x1="300" y1="11" x2="300" y2="17" />

          {/* Vertical dimension line on left */}
          <line x1="13" y1="40" x2="13" y2="410" strokeDasharray="3 2" />
          <line x1="9"  y1="40" x2="17" y2="40" />
          <line x1="9"  y1="410" x2="17" y2="410" />
          <polyline points="10,48 13,40 16,48" />
          <polyline points="10,402 13,410 16,402" />
          <text
            x="13" y="235"
            textAnchor="middle"
            fill="var(--draft)"
            stroke="none"
            letterSpacing="1"
            transform="rotate(-90 13 235)"
          >
            370
          </text>

          {/* Crosshair at roof peak */}
          <line x1="193" y1="40" x2="207" y2="40" />
          <line x1="200" y1="33" x2="200" y2="47" />

          {/* Crosshairs at body bottom corners */}
          <line x1="33" y1="410" x2="47" y2="410" />
          <line x1="40"  y1="403" x2="40"  y2="417" />
          <line x1="353" y1="410" x2="367" y2="410" />
          <line x1="360" y1="403" x2="360" y2="417" />

          {/* Horizontal baseline guide */}
          <line x1="30" y1="428" x2="370" y2="428" strokeDasharray="1 4" strokeWidth="0.3" />
        </g>

        {/* Stroke layer — drawn by CSS animation */}
        <path
          d={ROOF}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className={styles.roofStroke}
        />
        <path
          d={BODY}
          fill="none"
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength="1"
          className={styles.bodyStroke}
        />

        {/* Fill layer — blooms in via radial clip */}
        <g clipPath="url(#bloom)" className={styles.fillLayer}>
          <path d={ROOF} fill="var(--ink)" />
          <path d={BODY} fill="var(--ink)" />
        </g>
      </svg>
    </div>
  )
}
