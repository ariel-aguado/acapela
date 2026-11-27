// Acapela's gallery of backgrounds for the moments of a service (Culto ›
// a screen's or the theme's «Fondo» › Galería). Original illustrations
// drawn here as SVG (silhouettes, light and grain), rendered at 1920×1080
// with headless Chrome and saved as WebP, with a 480×270 thumbnail for the
// picker. They are dark and calm in the middle, so white text reads on
// them; the subject sits low or on a side.
//
// Run: node scripts/culto-backgrounds.mjs  (needs Google Chrome and cwebp)
// Out: public/img/culto/fondos/<id>.webp and public/img/culto/fondos/mini/<id>.webp
// The list the app reads is app/utils/culto/backgrounds.ts: keep it in step.

import { execFileSync } from "node:child_process"
import { mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import path from "node:path"
import process from "node:process"

const OUT = path.resolve("public/img/culto/fondos")
const W = 1920
const H = 1080

// A small seeded random, so every run draws the same pictures.
function rng(seed) {
  let a = seed
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ------------------------------------------------------------ shared pieces

const defs = `
  <filter id="soft" filterUnits="userSpaceOnUse" x="-100" y="-100" width="${W + 200}" height="${H + 200}"><feGaussianBlur stdDeviation="2.5"/></filter>
  <filter id="grain" x="0" y="0" width="100%" height="100%">
    <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.07 0"/>
  </filter>
  <filter id="blur20" filterUnits="userSpaceOnUse" x="-400" y="-400" width="${W + 800}" height="${H + 800}"><feGaussianBlur stdDeviation="20"/></filter>
  <filter id="blur60" filterUnits="userSpaceOnUse" x="-400" y="-400" width="${W + 800}" height="${H + 800}"><feGaussianBlur stdDeviation="60"/></filter>
  <filter id="blur120" filterUnits="userSpaceOnUse" x="-400" y="-400" width="${W + 800}" height="${H + 800}"><feGaussianBlur stdDeviation="120"/></filter>
  <radialGradient id="vignette" cx="50%" cy="50%" r="75%">
    <stop offset="55%" stop-color="#000" stop-opacity="0"/>
    <stop offset="100%" stop-color="#000" stop-opacity="0.65"/>
  </radialGradient>`

/** Grain and vignette on top of every picture. */
const finish = `<rect width="${W}" height="${H}" fill="url(#vignette)"/><rect width="${W}" height="${H}" filter="url(#grain)"/>`

function linear(id, stops, x2 = 0, y2 = 1) {
  return `<linearGradient id="${id}" x1="0" y1="0" x2="${x2}" y2="${y2}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</linearGradient>`
}
function radial(id, stops, cx = "50%", cy = "50%", r = "50%") {
  return `<radialGradient id="${id}" cx="${cx}" cy="${cy}" r="${r}">${stops.map(([o, c, a = 1]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("")}</radialGradient>`
}
const glow = (cx, cy, r, color, opacity, blur = "blur120") => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" opacity="${opacity}" filter="url(#${blur})"/>`

function bokeh(seed, n, area, colors) {
  const r = rng(seed)
  let out = ""
  for (let i = 0; i < n; i++) {
    const x = area[0] + r() * (area[2] - area[0])
    const y = area[1] + r() * (area[3] - area[1])
    const size = 10 + r() * 40
    out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${size.toFixed(0)}" fill="${colors[i % colors.length]}" opacity="${(0.08 + r() * 0.18).toFixed(2)}" filter="url(#blur20)"/>`
  }
  return out
}

/** A stalk of wheat: a curved stem and its grains. */
function wheat(x, baseY, height, lean, color, opacity = 1) {
  const topX = x + lean
  const topY = baseY - height
  const s = height / 420
  let out = `<g opacity="${opacity}"><path d="M${x} ${baseY} Q${x + lean * 0.3} ${baseY - height * 0.6} ${topX} ${topY}" stroke="${color}" stroke-width="${(2.5 * s + 0.8).toFixed(1)}" fill="none"/>`
  const angle = Math.atan2(-height, lean) * 180 / Math.PI + 90
  for (let i = 0; i < 9; i++) {
    const gx = topX - lean * 0.045 * i
    const gy = topY + i * 13 * s
    const off = 6 * s
    out += `<ellipse cx="${(gx - off).toFixed(1)}" cy="${gy.toFixed(1)}" rx="${(4.2 * s).toFixed(1)}" ry="${(11 * s).toFixed(1)}" transform="rotate(${(angle - 28).toFixed(0)} ${(gx - off).toFixed(1)} ${gy.toFixed(1)})" fill="${color}"/>`
    out += `<ellipse cx="${(gx + off).toFixed(1)}" cy="${gy.toFixed(1)}" rx="${(4.2 * s).toFixed(1)}" ry="${(11 * s).toFixed(1)}" transform="rotate(${(angle + 28).toFixed(0)} ${(gx + off).toFixed(1)} ${gy.toFixed(1)})" fill="${color}"/>`
  }
  out += `<path d="M${topX} ${topY - 8 * s} l${(-lean * 0.08).toFixed(1)} ${(-60 * s).toFixed(1)}" stroke="${color}" stroke-width="1.2"/></g>`
  return out
}

// ------------------------------------------------------------ the scenes

const SCENES = {
  // The Lord's supper
  "cena-copa-pan": () => `
    <defs>${defs}${linear("bg", [[0, "#2c0f15"], [1, "#0b0405"]], 1, 1)}${linear("table", [[0, "#2a1209"], [1, "#0a0403"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1460, 640, 420, "#e08a3a", 0.42)}
    ${glow(1460, 700, 160, "#ffc27a", 0.35, "blur60")}
    ${bokeh(3, 18, [1050, 250, 1900, 750], ["#ffb36b", "#ff8a4a", "#ffd9a0"])}
    <rect x="0" y="868" width="${W}" height="${H - 868}" fill="url(#table)"/>
    <rect x="0" y="866" width="${W}" height="3" fill="#ff9a50" opacity="0.18"/>
    <g fill="#080303">
      <path d="M1360 600 Q1362 760 1450 778 Q1538 760 1540 600 Z"/>
      <rect x="1442" y="776" width="16" height="70"/>
      <ellipse cx="1450" cy="852" rx="78" ry="18"/>
      <ellipse cx="1665" cy="842" rx="125" ry="46"/>
    </g>
    <path d="M1362 604 Q1364 758 1450 776 Q1536 758 1538 604" fill="none" stroke="#ffb067" stroke-width="3" opacity="0.55"/>
    <path d="M1548 828 Q1665 772 1782 828" fill="none" stroke="#ffb067" stroke-width="3" opacity="0.4"/>
    <path d="M1600 812 l30 22 M1660 802 l30 26 M1720 812 l26 22" stroke="#ffb067" stroke-width="3" opacity="0.25"/>
    ${finish}`,

  "cena-trigo-uvas": () => {
    const r = rng(7)
    let stalks = ""
    for (let i = 0; i < 9; i++)
      stalks += wheat(40 + i * 34 + r() * 20, 1100, 330 + r() * 180, 60 + r() * 80, "#c99a4a", 0.42 + r() * 0.2)
    let grapes = ""
    const g = rng(11)
    const widths = [4, 5, 5, 4, 4, 3, 2, 1]
    widths.forEach((n, row) => {
      for (let k = 0; k < n; k++) {
        const cx = 1700 + (k - (n - 1) / 2) * 40 + (g() - 0.5) * 10 + row * 4
        const cy = 760 + row * 34 + (g() - 0.5) * 8
        grapes += `<circle cx="${cx.toFixed(0)}" cy="${cy.toFixed(0)}" r="${(21 + g() * 4).toFixed(0)}" fill="#4d1c3d" opacity="${(0.75 + g() * 0.2).toFixed(2)}"/><circle cx="${(cx - 7).toFixed(0)}" cy="${(cy - 8).toFixed(0)}" r="6" fill="#c58ab0" opacity="0.18"/>`
      }
    })
    return `
    <defs>${defs}${radial("bg", [[0, "#3a1530"], [1, "#0b0409"]], "50%", "45%", "80%")}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(250, 900, 360, "#d2a04e", 0.22)}
    ${glow(1760, 820, 360, "#8a3a70", 0.3)}
    ${stalks}
    <path d="M1712 744 C1650 690 1600 700 1560 650 C1625 640 1700 660 1740 735 Z" fill="#33502a" opacity="0.6"/>
    <path d="M1712 744 C1716 712 1730 690 1752 672" stroke="#5a3d22" stroke-width="6" fill="none" opacity="0.7"/>
    ${grapes}
    ${finish}`
  },

  // The offering
  "ofrenda-trigo-dorado": () => {
    const r = rng(21)
    let back = ""
    for (let i = 0; i < 160; i++)
      back += wheat(-40 + r() * (W + 80), H + 30, 160 + r() * 140, -30 + r() * 60, "#6b4214", 0.55)
    let field = ""
    for (let i = 0; i < 110; i++)
      field += wheat(-40 + r() * (W + 80), H + 60, 230 + r() * 230, -40 + r() * 80, i % 3 ? "#160d04" : "#22150a", 1)
    field = `<g filter="url(#soft)">${back}</g>${field}`
    return `
    <defs>${defs}${linear("sky", [[0, "#140d05"], [0.55, "#3d2508"], [0.82, "#a8681e"], [1, "#e2a24a"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${glow(960, 900, 420, "#ffcf6b", 0.45)}
    ${glow(960, 930, 140, "#fff0c0", 0.5, "blur60")}
    ${field}
    ${finish}`
  },

  "ofrenda-semilla": () => `
    <defs>${defs}${linear("bg", [[0, "#04120f"], [1, "#0f2d25"]])}${linear("soil", [[0, "#0a1a14"], [1, "#020806"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(960, 860, 300, "#9ddc4c", 0.22)}
    ${bokeh(5, 16, [200, 200, 1720, 760], ["#b7eb76", "#73d9ed", "#e8ffd0"])}
    <path d="M0 930 Q480 880 960 905 T1920 915 V1080 H0 Z" fill="url(#soil)"/>
    <path d="M960 905 C958 860 962 820 960 770" stroke="#8cc96a" stroke-width="7" fill="none" stroke-linecap="round"/>
    <path d="M960 800 C915 760 860 770 838 742 C880 732 935 745 960 800 Z" fill="#7ab95d"/>
    <path d="M961 785 C1000 735 1060 735 1086 705 C1040 700 985 725 961 785 Z" fill="#9ad271"/>
    <ellipse cx="960" cy="912" rx="30" ry="9" fill="#2a1a0c"/>
    ${finish}`,

  // The sermon, the Word
  "palabra-libro-luz": () => {
    let rays = ""
    for (let i = -6; i <= 6; i++)
      rays += `<path d="M960 880 L${960 + i * 170 - 70} -40 L${960 + i * 170 + 70} -40 Z" fill="url(#ray)" opacity="${(0.12 - Math.abs(i) * 0.012).toFixed(3)}"/>`
    return `
    <defs>${defs}${linear("bg", [[0, "#050a18"], [1, "#132447"]])}${linear("ray", [[0, "#cfe0ff", 0], [1, "#cfe0ff", 1]], 0, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    <g filter="url(#blur20)">${rays}</g>
    ${glow(960, 860, 300, "#9fb7ff", 0.35)}
    <path d="M560 930 Q760 860 960 900 Q1160 860 1360 930 L1360 960 Q1160 900 960 940 Q760 900 560 960 Z" fill="#070c1a"/>
    <path d="M560 930 Q760 860 960 900 Q1160 860 1360 930" fill="none" stroke="#b9cbff" stroke-width="3" opacity="0.5"/>
    <path d="M960 900 L960 940" stroke="#b9cbff" stroke-width="2" opacity="0.4"/>
    <rect x="0" y="955" width="${W}" height="${H - 955}" fill="#03060e"/>
    ${finish}`
  },

  "palabra-lampara": () => `
    <defs>${defs}${linear("bg", [[0, "#0d0b16"], [1, "#05040a"]], 1, 0)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(462, 640, 460, "#ff9a3c", 0.32)}
    ${glow(462, 680, 90, "#ffd27a", 0.7, "blur60")}
    <path d="M454 718 C434 686 448 654 462 628 C476 654 490 686 470 718 Z" fill="#ffe2a0"/>
    <path d="M458 715 C450 698 456 684 462 672 C468 684 473 698 466 715 Z" fill="#fff6d8"/>
    <path d="M170 772 C170 728 250 706 330 712 C380 716 420 724 452 716 L470 726 C440 752 400 770 350 784 C280 804 170 808 170 772 Z" fill="#0a0604"/>
    <ellipse cx="300" cy="712" rx="36" ry="9" fill="#140b06"/>
    <path d="M176 760 C130 760 122 712 160 716" stroke="#0a0604" stroke-width="13" fill="none" stroke-linecap="round"/>
    <path d="M250 812 L370 812 L350 790 L270 790 Z" fill="#0a0604"/>
    <path d="M200 726 C250 708 330 708 452 716" stroke="#ffb067" stroke-width="3" fill="none" opacity="0.45"/>
    <rect x="0" y="820" width="${W}" height="${H - 820}" fill="#040205"/>
    <rect x="0" y="818" width="760" height="3" fill="#ff9a50" opacity="0.15"/>
    ${finish}`,

  // Welcome
  "bienvenida-amanecer": () => `
    <defs>${defs}${linear("sky", [[0, "#160d2a"], [0.45, "#4a2440"], [0.72, "#b5583f"], [0.86, "#f09a55"], [1, "#f6c27a"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${glow(960, 800, 380, "#ffd08a", 0.55)}
    <circle cx="960" cy="820" r="95" fill="#ffe6b0" opacity="0.9" filter="url(#blur20)"/>
    <path d="M0 860 Q260 760 520 820 T1040 800 T1500 790 T1920 830 V1080 H0 Z" fill="#3a2036"/>
    <path d="M0 920 Q320 850 700 900 T1400 880 T1920 910 V1080 H0 Z" fill="#241426"/>
    <path d="M0 990 Q420 940 900 975 T1920 980 V1080 H0 Z" fill="#120a15"/>
    ${finish}`,

  "bienvenida-puerta": () => `
    <defs>${defs}${linear("bg", [[0, "#0d0b12"], [1, "#050407"]])}${linear("door", [[0, "#ffd99a"], [1, "#d1873f"]])}${linear("spill", [[0, "#ffc778", 0.45], [1, "#ffc778", 0]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1430, 600, 380, "#ffb35a", 0.3)}
    <rect x="1310" y="250" width="240" height="640" fill="url(#door)"/>
    <path d="M1310 250 L1250 210 L1250 930 L1310 890 Z" fill="#1a120a"/>
    <path d="M1310 890 L1550 890 L1900 1080 L1080 1080 Z" fill="url(#spill)" filter="url(#blur20)"/>
    <rect x="1300" y="240" width="260" height="660" fill="none" stroke="#2a1c10" stroke-width="18"/>
    ${finish}`,

  // Prayer
  "oracion-vela": () => `
    <defs>${defs}${radial("bg", [[0, "#2b1c3f"], [1, "#07050c"]], "50%", "70%", "75%")}${linear("wax", [[0, "#e9dcc4"], [1, "#8d7c63"]], 1, 0)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(960, 800, 420, "#ff9d42", 0.3)}
    ${glow(960, 820, 120, "#ffd889", 0.65, "blur60")}
    <rect x="928" y="870" width="64" height="230" rx="6" fill="url(#wax)"/>
    <path d="M948 868 C928 830 942 788 960 760 C978 788 992 830 972 868 Z" fill="#ffd27a"/>
    <path d="M953 866 C944 842 951 818 960 800 C969 818 976 842 967 866 Z" fill="#fff4d6"/>
    <path d="M960 870 L960 856" stroke="#2a1a10" stroke-width="3"/>
    ${finish}`,

  "oracion-estrellas": () => {
    const r = rng(31)
    let stars = ""
    for (let i = 0; i < 420; i++) {
      const s = r()
      stars += `<circle cx="${(r() * W).toFixed(0)}" cy="${(r() * 820).toFixed(0)}" r="${(0.6 + s * s * 2.4).toFixed(1)}" fill="#fff" opacity="${(0.25 + r() * 0.7).toFixed(2)}"/>`
    }
    return `
    <defs>${defs}${linear("sky", [[0, "#03040d"], [0.7, "#141238"], [1, "#2c2350"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    <path d="M-100 700 Q700 200 2020 80" stroke="#7d86d6" stroke-width="220" fill="none" opacity="0.12" filter="url(#blur60)"/>
    ${stars}
    ${(() => {
      const m = rng(37)
      let y = 860
      let d = `M0 ${y}`
      for (let x = 40; x <= W; x += 40) {
        y = Math.max(720, Math.min(930, y + (m() - 0.5) * 70))
        d += ` L${x} ${y.toFixed(0)}`
      }
      return `<path d="${d} V1080 H0 Z" fill="#06060f"/>`
    })()}
    ${finish}`
  },

  // Notices
  "anuncios-geometrico": () => `
    <defs>${defs}${linear("bg", [[0, "#2a2163"], [1, "#120d2c"]], 1, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(300, 220, 380, "#715de3", 0.55)}
    ${glow(1700, 900, 420, "#3cc2de", 0.28)}
    ${glow(1600, 180, 220, "#ff8730", 0.22)}
    <g fill="none" stroke="#baaef3" stroke-width="3" opacity="0.18">
      <rect x="1380" y="120" width="420" height="420" rx="90" transform="rotate(14 1590 330)"/>
      <rect x="1460" y="200" width="420" height="420" rx="90" transform="rotate(26 1670 410)"/>
      <circle cx="220" cy="900" r="180"/>
      <circle cx="220" cy="900" r="260"/>
    </g>
    ${finish}`,

  "anuncios-lineas": () => {
    let lines = ""
    for (let i = 0; i < 22; i++) {
      const y = 620 + i * 18
      lines += `<path d="M-50 ${y} C 400 ${y - 180 + i * 6}, 900 ${y + 160 - i * 4}, 1350 ${y - 60} S 1800 ${y - 200 + i * 5}, 1980 ${y - 120}" stroke="#73d9ed" stroke-width="2" fill="none" opacity="${(0.06 + i * 0.008).toFixed(3)}"/>`
    }
    return `
    <defs>${defs}${linear("bg", [[0, "#071820"], [1, "#0f3140"]], 0.6, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1500, 700, 420, "#1fa6c4", 0.25)}
    ${lines}
    ${finish}`
  },

  // Farewell
  "despedida-atardecer": () => `
    <defs>${defs}${linear("sky", [[0, "#1d0f2b"], [0.5, "#5a2541"], [0.78, "#c25a3b"], [1, "#f2a253"]])}${linear("sea", [[0, "#3a1c2c"], [1, "#0b0610"]])}${linear("streak", [[0, "#ffd08a", 0.7], [1, "#ffd08a", 0]])}</defs>
    <rect width="${W}" height="720" fill="url(#sky)"/>
    ${glow(960, 700, 360, "#ffc070", 0.55)}
    <circle cx="960" cy="720" r="110" fill="#ffe3a8" opacity="0.92"/>
    <rect x="0" y="720" width="${W}" height="${H - 720}" fill="url(#sea)"/>
    <path d="M880 722 L1040 722 L1120 1080 L800 1080 Z" fill="url(#streak)" opacity="0.5" filter="url(#blur20)"/>
    <g stroke="#ffd59a" stroke-width="3" opacity="0.35">
      <path d="M900 760 h120 M880 800 h160 M860 850 h200 M840 910 h240"/>
    </g>
    ${finish}`,

  "despedida-camino": () => `
    <defs>${defs}${linear("sky", [[0, "#0f1530"], [0.6, "#3b3058"], [1, "#a06070"]])}${linear("road", [[0, "#6a5060"], [1, "#1a1218"]])}</defs>
    <rect width="${W}" height="740" fill="url(#sky)"/>
    ${glow(960, 720, 320, "#f0a070", 0.35)}
    <path d="M0 700 Q480 650 960 720 T1920 690 V1080 H0 Z" fill="#120c14"/>
    <path d="M948 722 L972 722 L1420 1080 L500 1080 Z" fill="url(#road)"/>
    <path d="M960 740 L960 1080" stroke="#f0d7a0" stroke-width="6" stroke-dasharray="40 50" opacity="0.35"/>
    ${finish}`,

  // A reading
  "lectura-pergamino": () => `
    <defs>${defs}
      <filter id="paper"><feTurbulence type="fractalNoise" baseFrequency="0.004" numOctaves="4" seed="4"/><feColorMatrix type="matrix" values="0 0 0 0 0.42  0 0 0 0 0.30  0 0 0 0 0.17  0 0 0 0.28 0"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#140f0a"/>
    <rect width="${W}" height="${H}" filter="url(#paper)"/>
    ${glow(960, 540, 600, "#6b4a2a", 0.25)}
    ${finish}`,

  // For any screen
  "general-suave": () => `
    <defs>${defs}${linear("bg", [[0, "#1c1832"], [1, "#0c0a17"]], 1, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1500, 300, 500, "#4e37bc", 0.35)}
    ${glow(300, 900, 420, "#1d6b86", 0.25)}
    ${finish}`,
}

// ------------------------------------------------------------ light scenes
// For dark text: luminous and calm in the middle, the subject in soft ink at
// an edge. The app knows them as light (app/utils/culto/backgrounds.ts).

const finishLight = `<rect width="${W}" height="${H}" fill="url(#vignetteLight)"/><rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.6"/>`
const defsLight = `${defs}
  <radialGradient id="vignetteLight" cx="50%" cy="50%" r="80%">
    <stop offset="60%" stop-color="#5a4a30" stop-opacity="0"/>
    <stop offset="100%" stop-color="#5a4a30" stop-opacity="0.16"/>
  </radialGradient>`

Object.assign(SCENES, {
  "claro-cena-lino": () => `
    <defs>${defsLight}${linear("bg", [[0, "#fbf6ec"], [1, "#efe3cc"]], 1, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1500, 300, 420, "#ffffff", 0.7)}
    <g fill="none" stroke="#9c7440" stroke-width="5" opacity="0.7" stroke-linecap="round">
      <path d="M1480 650 Q1482 790 1560 806 Q1638 790 1640 650 Z"/>
      <path d="M1560 806 V880 M1490 892 Q1560 872 1630 892"/>
      <ellipse cx="1760" cy="870" rx="115" ry="42"/>
      <path d="M1690 858 l26 18 M1745 850 l28 22 M1800 858 l24 18"/>
    </g>
    <rect x="0" y="928" width="${W}" height="${H - 928}" fill="#e6d6b8" opacity="0.6"/>
    ${finishLight}`,

  "claro-ofrenda-trigal": () => {
    const r = rng(41)
    let field = ""
    for (let i = 0; i < 130; i++)
      field += wheat(-40 + r() * (W + 80), H + 60, 200 + r() * 220, -40 + r() * 80, i % 3 ? "#d9b06a" : "#c99a4f", 0.75)
    return `
    <defs>${defsLight}${linear("sky", [[0, "#fdfaf2"], [0.7, "#f8ecd2"], [1, "#f1d9a6"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${glow(960, 760, 420, "#fff6dc", 0.8)}
    ${field}
    ${finishLight}`
  },

  "claro-palabra-pagina": () => `
    <defs>${defsLight}
      <filter id="paperLight"><feTurbulence type="fractalNoise" baseFrequency="0.006" numOctaves="4" seed="9"/><feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.45  0 0 0 0 0.3  0 0 0 0.12 0"/></filter>
    </defs>
    <rect width="${W}" height="${H}" fill="#f7f1e4"/>
    <rect width="${W}" height="${H}" filter="url(#paperLight)"/>
    <path d="M560 960 Q760 900 960 935 Q1160 900 1360 960" fill="none" stroke="#8c6c3e" stroke-width="5" opacity="0.7"/>
    <path d="M960 935 L960 975" stroke="#8c6c3e" stroke-width="4" opacity="0.6"/>
    <path d="M600 990 Q780 940 960 970 Q1140 940 1320 990" fill="none" stroke="#8c6c3e" stroke-width="4" opacity="0.5"/>
    ${finishLight}`,

  "claro-bienvenida-manana": () => `
    <defs>${defsLight}${linear("sky", [[0, "#eef4fb"], [0.6, "#fbefe4"], [1, "#fde2c8"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${glow(1450, 760, 360, "#fff3d6", 0.9)}
    <path d="M0 880 Q300 800 620 850 T1280 830 T1920 860 V1080 H0 Z" fill="#e6d3e6" opacity="0.8"/>
    <path d="M0 950 Q420 890 880 930 T1920 940 V1080 H0 Z" fill="#d9c2dc" opacity="0.8"/>
    <path d="M0 1010 Q520 975 1000 1000 T1920 1005 V1080 H0 Z" fill="#cbb1d0"/>
    ${finishLight}`,

  "claro-oracion-nubes": () => `
    <defs>${defsLight}${linear("sky", [[0, "#f1eefb"], [1, "#e4ddf5"]])}</defs>
    <rect width="${W}" height="${H}" fill="url(#sky)"/>
    ${glow(380, 260, 260, "#ffffff", 0.9, "blur60")}
    ${glow(620, 300, 220, "#ffffff", 0.8, "blur60")}
    ${glow(1500, 860, 300, "#ffffff", 0.9, "blur60")}
    ${glow(1760, 820, 220, "#ffffff", 0.8, "blur60")}
    ${glow(960, 120, 300, "#fff4dc", 0.6)}
    ${finishLight}`,

  "claro-anuncios-formas": () => `
    <defs>${defsLight}${linear("bg", [[0, "#ffffff"], [1, "#f4f2fe"]], 1, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(260, 200, 300, "#d7cff9", 0.8)}
    ${glow(1700, 920, 340, "#d5f4fa", 0.9)}
    ${glow(1650, 160, 200, "#ffe9d4", 0.9)}
    <g fill="none" stroke="#9583ea" stroke-width="3" opacity="0.25">
      <rect x="1400" y="120" width="380" height="380" rx="80" transform="rotate(14 1590 310)"/>
      <circle cx="220" cy="900" r="170"/>
    </g>
    ${finishLight}`,

  "claro-despedida-mar": () => `
    <defs>${defsLight}${linear("sky", [[0, "#fbf3ee"], [0.6, "#fbe2d2"], [1, "#f7cdb3"]])}${linear("sea", [[0, "#dfe8f0"], [1, "#cfdbe6"]])}</defs>
    <rect width="${W}" height="740" fill="url(#sky)"/>
    ${glow(960, 720, 300, "#fff1d8", 0.9)}
    <circle cx="960" cy="740" r="90" fill="#fff3dd" opacity="0.95"/>
    <rect x="0" y="740" width="${W}" height="${H - 740}" fill="url(#sea)"/>
    <g stroke="#ffffff" stroke-width="3" opacity="0.7"><path d="M880 780 h160 M860 830 h200 M840 890 h240"/></g>
    ${finishLight}`,

  "claro-suave": () => `
    <defs>${defsLight}${linear("bg", [[0, "#fbfaf7"], [1, "#f1efe8"]], 1, 1)}</defs>
    <rect width="${W}" height="${H}" fill="url(#bg)"/>
    ${glow(1500, 260, 420, "#efe8ff", 0.8)}
    ${glow(300, 900, 380, "#e6f4f6", 0.8)}
    ${finishLight}`,
})

// ------------------------------------------------------------ rendering

const only = process.argv.slice(2)
const work = mkdtempSync(path.join(tmpdir(), "acapela-fondos-"))
mkdirSync(path.join(OUT, "mini"), { recursive: true })
for (const [id, draw] of Object.entries(SCENES)) {
  if (only.length && !only.includes(id))
    continue
  const html = path.join(work, `${id}.html`)
  const png = path.join(work, `${id}.png`)
  writeFileSync(html, `<!doctype html><html><body style="margin:0;background:#000"><svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">${draw()}</svg></body></html>`)
  execFileSync("/usr/bin/google-chrome", ["--headless=new", "--disable-gpu", "--no-sandbox", "--hide-scrollbars", `--window-size=${W},${H}`, `--screenshot=${png}`, `file://${html}`], { stdio: "ignore" })
  execFileSync("cwebp", ["-quiet", "-q", "78", "-m", "6", png, "-o", path.join(OUT, `${id}.webp`)])
  execFileSync("cwebp", ["-quiet", "-q", "70", "-m", "6", "-resize", "480", "270", png, "-o", path.join(OUT, "mini", `${id}.webp`)])
  const kb = n => `${Math.round(statSync(n).size / 1024)} KB`
  console.log(`${id.padEnd(24)} ${kb(path.join(OUT, `${id}.webp`)).padStart(7)}  mini ${kb(path.join(OUT, "mini", `${id}.webp`))}`)
}
rmSync(work, { recursive: true, force: true })
