'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

const ROOF = 'M 200 18 L 388 88 L 358 88 L 200 38 L 42 88 L 12 88 Z'

const PHASES = [
  { t: 1000, text: '[ Constructing pillar 01 ]' },
  { t: 2400, text: '[ Constructing pillar 02 ]' },
  { t: 3800, text: '[ Joining the crossbar ]'   },
  { t: 4700, text: '[ Setting the roof ]'        },
  { t: 5400, text: '[ Inscribing the mark ]'     },
  { t: 6500, text: '[ Household established ]'   },
]

export default function LandingPage() {
  const stageRef      = useRef<HTMLDivElement>(null)
  const loaderRef     = useRef<HTMLDivElement>(null)
  const loaderFillRef = useRef<HTMLDivElement>(null)
  const pctRef        = useRef<HTMLSpanElement>(null)
  const washRef       = useRef<HTMLDivElement>(null)
  const enteringRef   = useRef(false)
  const intervalRef   = useRef<ReturnType<typeof setInterval> | null>(null)

  /* Refs for SVG clipPath rects — animated via setAttribute / rAF */
  const plRef = useRef<SVGRectElement>(null)   // pillar-left clip
  const prRef = useRef<SVGRectElement>(null)   // pillar-right clip
  const cbRef = useRef<SVGRectElement>(null)   // crossbar clip

  const [phaseText, setPhaseText] = useState('[ Constructing pillar 01 ]')

  useEffect(() => {
    const isSkip = new URLSearchParams(location.search).get('skip') === 'true'
    if (isSkip) {
      document.body.classList.add('skip-anim')
      plRef.current?.setAttribute('height', '170')
      prRef.current?.setAttribute('height', '170')
      cbRef.current?.setAttribute('width',  '112')
      return () => { document.body.classList.remove('skip-anim') }
    }

    const timers = PHASES.map(p =>
      setTimeout(() => setPhaseText(p.text), p.t)
    )

    /* Stepped setAttribute — pillars keep chunky brick-stack feel */
    const animSteps = (
      el: SVGRectElement | null,
      attr: 'height' | 'width',
      from: number, to: number,
      dur: number, delay: number, steps: number,
    ) => {
      if (!el) return
      el.setAttribute(attr, String(from))
      setTimeout(() => {
        const stepMs = Math.round(dur / steps)
        let s = 0
        const iv = setInterval(() => {
          s++
          el.setAttribute(attr, String(Math.round(from + (to - from) * s / steps)))
          if (s >= steps) clearInterval(iv)
        }, stepMs)
      }, delay)
    }

    /* rAF + cubic-bezier solver — crossbar smooth sweep */
    const animEased = (
      el: SVGRectElement | null,
      attr: 'height' | 'width',
      from: number, to: number,
      dur: number, delay: number,
      x1: number, y1: number, x2: number, y2: number,
    ) => {
      if (!el) return
      el.setAttribute(attr, String(from))
      setTimeout(() => {
        const start = performance.now()
        const tick = (now: number) => {
          const t = Math.min((now - start) / dur, 1)
          // Newton's method: find bezier param u s.t. Bx(u) = t, then eval By(u)
          let u = t
          for (let i = 0; i < 8; i++) {
            const bx = 3*(1-u)**2*u*x1 + 3*(1-u)*u**2*x2 + u**3 - t
            const dbx = 3*(1-u)**2*x1 + 6*(1-u)*u*(x2-x1) + 3*u**2*(1-x2)
            u = Math.max(0, Math.min(1, u - bx / (dbx || 1e-6)))
          }
          const progress = 3*(1-u)**2*u*y1 + 3*(1-u)*u**2*y2 + u**3
          el.setAttribute(attr, String(Math.round(from + (to - from) * progress)))
          if (t < 1) requestAnimationFrame(tick)
          else el.setAttribute(attr, String(to))
        }
        requestAnimationFrame(tick)
      }, delay)
    }

    animSteps(plRef.current, 'height', 0, 170, 1400, 1000, 22)
    animSteps(prRef.current, 'height', 0, 170, 1400, 2400, 22)
    // crossbar: cubic-bezier(0.16, 1, 0.3, 1) — fast-start soft-land sweep
    animEased(cbRef.current, 'width', 0, 112, 900, 3800, 0.16, 1, 0.3, 1)

    return () => {
      timers.forEach(clearTimeout)
      document.body.classList.remove('skip-anim')
    }
  }, [])

  const enterHousehold = useCallback(() => {
    if (enteringRef.current) return
    enteringRef.current = true

    const stage  = stageRef.current
    const loader = loaderRef.current
    const fill   = loaderFillRef.current
    const pct    = pctRef.current
    const wash   = washRef.current
    if (!stage || !loader || !fill || !pct || !wash) return

    stage.style.transition = 'opacity 0.6s'
    stage.style.opacity    = '0.15'
    loader.classList.add('active')

    let progress = 0
    intervalRef.current = setInterval(() => {
      progress += Math.max(0.5, (100 - progress) * 0.04)
      if (progress >= 100) {
        progress = 100
        clearInterval(intervalRef.current!)
        setTimeout(() => {
          wash.classList.add('active')
          setTimeout(() => {
            console.log('[ Household entered. ]')
            // TODO: router.push('/main')
          }, 600)
        }, 400)
      }
      pct.textContent      = Math.floor(progress).toString().padStart(3, '0')
      fill.style.transform = `translateX(${-100 + progress}%)`
    }, 30)
  }, [])

  /* keyboard trigger */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' || e.key === ' ') enterHousehold()
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [enterHousehold])

  return (
    <>
      <div className="grain" aria-hidden="true" />
      <div className="grid"  aria-hidden="true" />

      <span className="corner tl" aria-hidden="true" />
      <span className="corner tr" aria-hidden="true" />
      <span className="corner bl" aria-hidden="true" />
      <span className="corner br" aria-hidden="true" />

      <div className="top-bar">
        <div className="tb-left">
          <span>Household</span>
          <span>·</span>
          <span>YVR</span>
        </div>
        <div className="tb-right">
          <span className="dot" aria-hidden="true" />
          <span>Capsule 001</span>
          <span>MMXXVI</span>
        </div>
      </div>

      <div className="stage" ref={stageRef}>
        <div className="halo" aria-hidden="true" />
        <div className="glow" aria-hidden="true" />

        {/* House — click triggers loader */}
        <div
          className="house-block"
          role="button"
          aria-label="Enter the household"
          onClick={enterHousehold}
        >
          <svg
            className="house-svg"
            viewBox="0 0 400 290"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <clipPath id="cp-pl"><rect ref={plRef} x="30"  y="100" width="116" height="0" /></clipPath>
              <clipPath id="cp-pr"><rect ref={prRef} x="254" y="100" width="116" height="0" /></clipPath>
              <clipPath id="cp-cb"><rect ref={cbRef} x="144" y="118" width="0"   height="130" /></clipPath>
            </defs>

            {/* Draft measurement marks */}
            <g className="draft">
              <line x1="12" y1="6" x2="388" y2="6" />
              <line x1="12" y1="3" x2="12"  y2="9" />
              <line x1="388" y1="3" x2="388" y2="9" />
            </g>
            <text className="draft-text" x="200" y="6" textAnchor="middle" dy="-2">400</text>

            <g className="draft">
              <line x1="2"  y1="18"  x2="2"  y2="270" />
              <line x1="-1" y1="18"  x2="5"  y2="18"  />
              <line x1="-1" y1="270" x2="5"  y2="270" />
            </g>
            <text
              className="draft-text"
              x="-5" y="144"
              textAnchor="middle"
              transform="rotate(-90 -5 144)"
            >252</text>

            <g className="draft">
              <line x1="6"   y1="100" x2="20"  y2="100" />
              <line x1="13"  y1="93"  x2="13"  y2="107" />
              <line x1="380" y1="100" x2="394" y2="100" />
              <line x1="387" y1="93"  x2="387" y2="107" />
              <line x1="6"   y1="270" x2="20"  y2="270" />
              <line x1="13"  y1="263" x2="13"  y2="277" />
              <line x1="380" y1="270" x2="394" y2="270" />
              <line x1="387" y1="263" x2="387" y2="277" />
            </g>

            <g className="draft">
              <line x1="200" y1="0"   x2="200" y2="14"  strokeDasharray="2 2" />
              <line x1="200" y1="282" x2="200" y2="290" strokeDasharray="2 2" />
            </g>

            <rect className="pillar-left"  x="30"  y="100" width="116" height="170" fill="#0a0a0a" clipPath="url(#cp-pl)" />
            <rect className="pillar-right" x="254" y="100" width="116" height="170" fill="#0a0a0a" clipPath="url(#cp-pr)" />
            <rect className="crossbar"     x="144" y="118" width="112" height="130" fill="#0a0a0a" clipPath="url(#cp-cb)" />
            <path className="roof"         d={ROOF}        fill="#0a0a0a" />
          </svg>
        </div>

        {/* Phase indicator — sibling of house-block, absolutely within stage */}
        <div className="phase">
          <span>{phaseText}</span>
        </div>

        <div className="wordmark-wrap">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/household-wordmark-white.png"
            alt="HOUSEHOLD EST. 2011"
            className="wordmark"
          />
        </div>

        {/* Enter prompt */}
        <p className="enter-prompt">click to enter</p>
      </div>

      {/* BUILDING 000% loader */}
      <div className="loader" ref={loaderRef}>
        <div className="loader-text">
          Building <span ref={pctRef}>000</span>%
        </div>
        <div className="loader-bar">
          <div className="loader-fill" ref={loaderFillRef} />
        </div>
        <div className="loader-text" style={{ color: 'var(--ash)', fontSize: '0.55rem' }}>
          Entering the Household
        </div>
      </div>

      <button className="skip-btn" onClick={enterHousehold}>[ Skip Intro ]</button>
      <div className="wash" ref={washRef} />
    </>
  )
}
