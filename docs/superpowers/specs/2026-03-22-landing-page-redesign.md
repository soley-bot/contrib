# Landing Page Redesign — Storyboard Spec

**Date:** 2026-03-22
**Status:** Approved storyboard, pending implementation

## Context

The current landing page follows a generic SaaS template (hero + feature grid + how-it-works + footer). It could be any product. The brand narrative already has a powerful 5-beat story arc — the landing page should BE that story, not list features.

## Approach: Empathy-First Horizontal Scroll Narrative

Instead of a vertical scrolling page with sections, the landing page uses **horizontal scroll-snap** to tell Contrib's story as a storyboard. Each "slide" is one beat of the brand narrative.

### Structure

- **Horizontal scroll-snap** (left-right swipe/scroll)
- **2-column layout on desktop** (text left, visual right) — stacks vertically on mobile
- **Progress dots** at bottom with slide counter (1/6)
- **Arrow navigation** on desktop (left/right), hidden on mobile
- **Keyboard navigation** (arrow keys)
- **Swipe hint** on first slide, disappears after first interaction
- **Each slide transitions in** when it becomes active (text fades up with stagger, visuals slide in)

### Navigation

- Fixed nav bar: Logo + "Log in" + "Sign up free" button
- Progress dots: clickable, shows current slide number

---

## Slides

### Slide 1 — Beat 01: "The same thing happens"
**Label:** Every semester
**Title:** The same thing happens.
**Body:** A group of students gets assigned a project. Four people work. One doesn't. The deadline comes — and everyone gets the same grade.
**Visual:** Chat mockup (Dara doing all the work, others ghosting) + verdict box "Everyone gets B+. Same grade."
**Illustration:** Overwhelmed student (Storyset/Freepik)
**Background:** Dark (#0F172A)
**Animation:** Chat bubbles appear one by one with staggered delay, verdict fades in last

### Slide 2 — Beat 02: "Teachers know. They just can't see."
**Label:** The real problem
**Title:** Teachers know. They just can't see.
**Body:** Peer evaluation forms exist — but they're filled out at the end, from memory, under social pressure. The form becomes a formality.
**Visual:** Peer evaluation form showing everyone scoring 4-5 + "FORMALITY" watermark stamp
**Illustration:** Classroom scene (Storyset/Freepik)
**Background:** Warm gray (#FAFAF9)
**Animation:** Form slides in, stamp fades in with delay

### Slide 3 — Beat 03: "Make effort visible — while it's happening."
**Label:** The shift
**Title:** Make effort visible — while it's happening.
**Body:** Students log tasks and review each other inside Contrib. Teachers get a live Contribution Record for every group.
**Visual:** Contrib UI mockup — task list with assignees + contribution bars (Dara 47%, Sokha 28%, Rith 15%, Maly 10%)
**Illustration:** Devices/dashboard (Storyset/Freepik)
**Background:** White
**Animation:** Task rows slide in one by one, contribution bars animate from 0% to final value

### Slide 4 — Beat 04: "The grade reflects the work."
**Label:** The result
**Title:** The grade reflects the work.
**Body:** The student who carried the group gets recognized. The teacher grades with evidence, not instinct.
**Visual:** Grade cards — Dara: A, Sokha: B+, Rith: C+, Maly: C
**Illustration:** Student with A grade (Storyset/Freepik)
**Background:** Off-white (#F8FAFF)
**Animation:** Grade cards pop up with staggered scale animation

### Slide 5 — Beat 05: "No tool was built for this."
**Label:** Why now. Why Cambodia.
**Title:** No tool was built for this.
**Body:** Cambodia's higher education is growing fast — but fair group assessment hasn't kept up. Contrib gives universities the tool to do what they always intended.
**Visual:** Stats — 237K students, 189 institutions, 0 tools built for this
**Illustration:** Webinar/online education (Storyset/Freepik)
**Background:** Dark (#0F172A)
**Animation:** Stat numbers animate in with staggered delay

### Slide 6 — CTA
**Title:** Your work. On record.
**Subtitle:** Free for students. Always.
**Button:** Get started — it's free
**Note:** No credit card. No setup. Just start.
**Background:** White

---

## Illustrations

All from Storyset/Freepik (free, customizable SVGs with built-in CSS animations).
Files saved at `contrib/public/illustrations/`.

| Beat | File | Storyset Name |
|------|------|--------------|
| 01 | `beat-01-overwhelmed.svg` | "Overwhelmed" |
| 02 | `beat-02-classroom.svg` | "Classroom" |
| 03 | `beat-03-devices.svg` | "Devices" |
| 04 | `beat-04-grades.svg` | "Grades" |
| 05 | `beat-05-webinar.svg` | "Webinar" |

### Illustration Treatment: Subtle Background

Illustrations are used as **subtle backgrounds**, not inline images. Research-backed values:

| Property | Value | Source |
|----------|-------|--------|
| **Opacity** | 8-15% (10% default) | Industry standard for line art backgrounds |
| **Size** | 90% of slide width, max 700px | Tailwind UI uses 80-120% with overflow hidden |
| **Position** | `absolute; right: -10%; bottom: -10%` | Bottom-right offset, partially off-screen |
| **Z-index** | 0 (content at z-index 1) | Behind all foreground content |
| **Dark slides** | `filter: invert(1) brightness(2)` at 10-15% | Inverts to white ghost on dark backgrounds |
| **Light slides** | Direct SVG at 8-12% opacity | Brand blue tint shows through |
| **Transition** | `opacity 1s ease 0.2s` | Fades in when slide becomes active |

Customize accent colors to `#1A56E8` on Storyset before downloading.

## Colors (Brand-Only)

- Dark slides: #0F172A background, white text, #93B4FF accents
- Light slides: white or #F8FAFF background, #0F172A text
- Brand blue: #1A56E8 (labels, buttons, UI accents)
- Muted text: #64748B
- Faint text: #94A3B8
- Status green: #16A34A (done tasks, good grades)
- Status amber: #D97706 (in-progress, lower grades)
- NO teal, NO gradients, NO deep shadows

## Typography

- Plus Jakarta Sans (all weights)
- Titles: 800 weight, clamp(26px, 3.5vw, 42px)
- Body: 400 weight, 15px
- Labels: 700 weight, 10px, uppercase, letter-spacing 2px

## Responsive

- **Desktop (>768px):** 2-column layout (text + visual side by side), arrow navigation visible
- **Mobile (<768px):** Single column (stacked), arrows hidden, swipe to navigate

## Prototype

Interactive prototype at `.superpowers/brainstorm/968-1774186209/storyboard-v3.html`

## Scope — What's NOT in this spec

- Login/signup page copy updates (separate task)
- Actual Storyset SVG integration (requires downloading + customizing accent colors)
- Footer redesign
- SEO meta tags / OG images
