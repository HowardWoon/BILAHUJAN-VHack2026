<div align="center">

<br>

<pre align="center">
██████╗ ██╗██╗      █████╗ ██╗  ██╗██╗   ██╗     ██╗ █████╗ ███╗   ██╗
██╔══██╗██║██║     ██╔══██╗██║  ██║██║   ██║     ██║██╔══██╗████╗  ██║
██████╔╝██║██║     ███████║███████║██║   ██║     ██║███████║██╔██╗ ██║
██╔══██╗██║██║     ██╔══██║██╔══██║██║   ██║██   ██║██╔══██║██║╚██╗██║
██████╔╝██║███████╗██║  ██║██║  ██║╚██████╔╝╚█████╔╝██║  ██║██║ ╚████║
╚═════╝ ╚═╝╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝  ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═══╝
</pre>

**Decentralised Swarm Intelligence for Flood First Response**

<br>

### *"Every citizen a sensor. Every report a node. Every second counts."*

<br>

**🔴 [TEST THE LIVE PLATFORM → bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)**

*Built for V Hack 2026 · Universiti Sains Malaysia · Case Study 3: First Responder of the Future*

*Powered by Google Gemini 2.5 Flash · Firebase Realtime Database · MCP Architecture · Google Maps Platform · Manus Agentic AI · GitHub Copilot*

<br>

### 📊 Platform At A Glance

| Metric | Value |
|:---|:---|
| 🗺️ Pre-seeded Flood Zones | **37 zones across all 16 states** |
| 🤖 MCP Tools in Agent Registry | **7 standardised tools** |
| 🧠 AI Pipeline Passes per Image | **12 sequential passes** |
| 🌐 Malaysian States Covered | **All 16 + Federal Territories** |
| 🐝 Swarm Node Status | Live citizen nodes — active / idle / offline |
| ☁️ Firebase Plan | Spark (Free Tier) — RM 0/month at MVP |
| 🤝 Agentic AI Partner | **Manus (from Meta)** — Pro Credits powering the Command Agent |
| 💻 AI-Assisted Development | **GitHub Copilot** — via GitHub Student Developer Pack |

<br>

</div>

---

## 1) Repository Overview & Team Introduction

BILAHUJAN is a **deployed civic intelligence platform** built for **V Hack 2026** under **Case Study 3: First Responder of the Future — Decentralised Swarm Intelligence**. It directly addresses the core challenge of the case study: building a self-healing, autonomous response system that operates as a **collective brain at the edge** — functioning even when centralised infrastructure fails.

Rather than relying on a single data source or central server, BILAHUJAN reframes the entire civilian population as a **distributed sensor fleet**. Every flood report submitted by a citizen automatically becomes an active intelligence node in the swarm. The **Autonomous Command Agent** — powered by Google Gemini and a standardised **Model Context Protocol (MCP)** tool layer, with agentic workflow augmentation via **Manus (from Meta)** — orchestrates this fleet autonomously, planning missions, executing tool calls, and dispatching alerts to Malaysian authorities (JPS, NADMA, APM) with **zero human intervention**.

> This project is designed not as a hackathon demo, but as a **deployable civic infrastructure prototype** — built to the standards of a production system.

---

### 👥 Meet the Team

BILAHUJAN is built by a four-person multidisciplinary team from Universiti Sains Malaysia, each contributing a distinct domain of expertise.

| Name | Role |
|:---|:---|
| **Howard Woon Hao Zhe** | Lead Software Engineer & AI Integrator — full technical build, Gemini multi-pass pipeline, MCP tool registry, Command Agent, Firebase architecture, Google Maps integration |
| **Sanjay Mukojima Ravindran** | Front-End Engineer & UX Architect — UI design execution, mobile-first layout, human-centred design for high-stress use conditions |
| **Wong En Sheng** | Marketing Lead & Pitching Strategist — pitching materials, public-facing narrative, SDG impact framing |
| **Ng Tze Fhung** | Technical Documentation Lead & Presentation Designer — system documentation, judge-facing slides, written and visual deliverables |

---

## 2) Project Overview

### 🔴 Problem Statement

The ASEAN region — including Malaysia — faces a recurring intelligence blackout during disasters. Like the typhoon and earthquake scenario described in Case Study 3, Malaysian floods create a critical window in which centralised systems fail:

| Statistic | Figure |
|:---|:---|
| 💸 Annual economic loss from flooding | **RM 1–5 billion/year** |
| 👥 Malaysians displaced annually | **200,000+** |
| 🌊 Dec 2021 Klang Valley megaflood | **70,000+ displaced · RM 6.1B damage** |
| ⏱️ Response gap from poor data | **30–120 minutes** |
| 📡 National flood warning system | **Still relies on manual water gauge monitoring** |

> **The December 2021 Klang Valley flood was Malaysia's most devastating in a generation — yet coordinated digital reporting and real-time AI triage were largely absent. BILAHUJAN is built to close that gap.**

During rapid-onset flash floods, emergency response systems suffer from four structural failures:

| Failure | Description |
|:---|:---|
| **Communication Blackout** | Cell towers and internet fail in the critical first 72 hours — cloud-dependent AI becomes useless |
| **Centralised Single Points of Failure** | Standard platforms collapse when the infrastructure they depend on collapses |
| **Subjective Severity Reporting** | Civilians misjudge danger levels due to panic, shock, or lack of situational awareness |
| **Fragmented Data Sources** | JPS, MetMalaysia, NADMA, and social media are never unified — responders fly blind |

---

### 🌍 SDG Alignment

| SDG | Target | BILAHUJAN's Contribution |
|:---|:---|:---|
| **SDG 9** | 9.1 & 9.5 — Industry, Innovation & Infrastructure | Decentralised swarm architecture survives infrastructure failure (9.1). 12-pass AI pipeline + MCP architecture applied to public good as cutting-edge civic R&D (9.5) |
| **SDG 3** | 3.d — Good Health & Well-being | `detectCriticalRooftopCueViaRest()` triggers BOMBA/NADMA rescue dispatch before loss of life. Health security through hyper-local early warning |

---

### 💡 The BILAHUJAN Approach

> **BILAHUJAN reframes every citizen smartphone as an autonomous sensor node — orchestrated by an AI Command Agent via MCP — creating a self-healing swarm that operates without centralised infrastructure.**

```
CASE STUDY 3 REQUIREMENT              BILAHUJAN IMPLEMENTATION
──────────────────────                ────────────────────────
Fleet of rescue drones          →     Citizen sensor nodes (smartphones)
Disaster zone mapping           →     37 Malaysian flood zones + live reports
Thermal signature scan          →     Gemini 2.5 Flash 12-pass image analysis
MCP tool calls                  →     7 standardised tools in mcpTools.ts
Command Agent orchestrator      →     runMission() autonomous agent loop
Chain-of-Thought reasoning      →     Live terminal in GOV dashboard
Edge operation (offline-ready)  →     Firebase RTDB + hardcoded 16-state fallback
```

---

## 3) Key Features

### `01` Autonomous Command Agent *(Agentic AI)*

The heart of BILAHUJAN's Case Study 3 compliance. The Command Agent (`commandAgent.ts`) is a fully autonomous AI system that **plans, executes, and summarises** flood response missions through a standardised MCP tool registry — with **zero human involvement at any step**.

**Three-phase mission loop:**

```
Phase 1 — PLANNING (Gemini 2.0 Flash)
  Agent reads: zone count, active nodes, last mission timestamp
  Gemini generates: step sequence with explicit reasoning per tool call
  Example: "Zone KL-007 has severity 8 and 3 active nodes nearby.
            I will scan it first, then dispatch an alert to NADMA."

Phase 2 — EXECUTION (MCP Tool Loop, 800ms inter-step delay)
  Each tool call streams live to the GOV terminal
  Every result persisted to Firebase missionLogs/ in real time

Phase 3 — SUMMARY (Gemini synthesis)
  Agent synthesises all tool results into a structured mission report
  Zones actioned · alerts dispatched · authorities notified
```

> This directly satisfies the Case Study 3 requirement: *"Chain-of-Thought reasoning, where the agent explains its logic before executing the tools."*

---

### `02` MCP Tool Architecture *(7 Standardised Tools)*

All agent-to-swarm communication is handled exclusively through the MCP tool registry — no hardcoded logic, no direct database calls from the agent. This mirrors the mandatory protocol requirement from Case Study 3.

| Tool | Firebase Path | Case Study 3 Analogue |
|:---|:---|:---|
| `scan_flood_zone` | Calls `analyzeFloodImage()` | `thermal_scan()` drone tool |
| `get_zone_status` | Reads `liveZones/{zoneId}` | `get_battery_status()` |
| `update_zone_severity` | Writes to `liveZones/` | `move_to(x,y)` — repositions attention |
| `get_active_nodes` | Reads `liveReports/` + `liveZones/` | MCP real-time tool discovery |
| `dispatch_alert` | Writes to `agentAlerts/{zoneId}` | Authority notification |
| `get_system_health` | Reads `systemHeartbeat/` | System status monitoring |
| `thermal_scan` | Haversine radius spatial search | Direct `thermal_scan()` analogue |

> **The agent uses `get_active_nodes` to discover citizen nodes dynamically — it has no hardcoded drone IDs.** This satisfies the Case Study 3 requirement verbatim: *"The agent must use the MCP discovery mechanism to see which drones are active on the network."*

---

### `03` Decentralised Citizen Swarm Network

Every citizen report becomes a typed `SwarmNode` in the distributed sensor fleet — **zero additional infrastructure required**. The swarm is self-scaling: more disasters → more reports → larger fleet → better coverage.

| Status | Threshold | Agent Behaviour |
|:---:|:---|:---|
| 🟢 **ACTIVE** | Last seen < 5 minutes | Highest priority — agent scans these zones first |
| 🟡 **IDLE** | Last seen 5–10 minutes | Secondary evidence — used to corroborate active nodes |
| 🔴 **OFFLINE** | Last seen > 10 minutes | Historical reference — visible in GOV dashboard node grid |

Network health score = `(active / total) × 100%` — displayed live in GOV dashboard.

---

### `04` FloodVision AI Pipeline *(12-Pass Analysis)*

Every citizen image passes through **12 sequential AI passes** using `gemini-2.5-flash` via REST. Each pass has a specific purpose — preventing both dangerous false negatives and disruptive false positives simultaneously.

| Pass | Name | Purpose |
|:---:|:---|:---|
| 1 | Guideline Classification | Reject non-flood images at the gate — no further API calls wasted |
| 2 | Primary Analysis | Full 16-field structured extraction with physical depth anchors |
| 3 | False Negative Recovery | Multi-stage recovery if primary rejects a real flood image |
| 4 | Low-Score Reassessment | Re-evaluate score ≤ 3 for missed severe cues |
| 5 | Rooftop Cue Detection | Detect `bumbung rumah`, `atas bumbung`, rooftop rescue |
| 6 | Severity Calibration | Physical anchor calibration: ankle → knee → bonnet → roof |
| 7 | Scene Context | Identify normal waterbodies with no flood danger |
| 8 | Professional Regrade | Final reassessment if score still ≤ 3 |
| 9 | Score Merge | `max(primary, calibration, formula floor)` |
| 10 | Critical Override | Rooftop cue always beats scene cap — safety is absolute |
| 11 | Scene Context Cap | Normal waterbody + no danger + confidence ≥ 60 → cap at NORMAL (2) |
| 12 | Guardrails + Consistency | Hard floor rules + anti-over-scoring for static waterbodies |

For every image, Gemini returns **16 validated structured fields** — depth estimate, risk score, passability per vehicle class, hazard detection, water current, event type, and ISO 8601 timestamps. Zero free-form responses.

---

### `05` Severity Scoring — Physical Anchor Model

A proprietary **10-level severity calibration rubric** anchors every depth estimate to physical reference objects visible in the image — mirroring what professional flood risk engineers use in the field:

| Score | Level | Physical Anchor | Hard Floor Rule |
|:---:|:---|:---|:---|
| 1–2 | 🟢 NORMAL | Dry or damp surface, normal waterbody | River/canal/sea → cap at 2 |
| 3–4 | 🟡 MINOR | Ankle-deep, < 0.2m | Depth ≥ 0.2m → floor 4 |
| 5–6 | 🟠 MODERATE | Knee-deep, 0.2–0.5m | Flooded road → floor 5 |
| **7–8** | 🔴 SEVERE | Waist/car bonnet, 0.5–1.2m | **Car bonnet submerged → min 7** |
| **9–10** | 🆘 CRITICAL | Car roof / house roof / rooftop rescue | **Rooftop rescue → min 9 (unbypassable)** |

**Dual-direction guardrails** — most AI systems only prevent one type of error. BILAHUJAN prevents both:

```
❌  Standard AI:   Only prevents false negatives (misses real floods)
✅  BILAHUJAN:     Prevents false negatives AND false positives simultaneously

Anti-false-negative → inferMinimumRiskScore() + enforceSeverityGuardrails()
Anti-false-positive → enforceProfessionalConsistency() + applySceneContextCap()
Critical override   → applyCriticalVisualOverride() — always beats scene cap
```

---

### `06` Live Multi-Source Weather Intelligence

The Alert Menu uses **Gemini 2.0 Flash + Google Search grounding** to pull real-time conditions from MetMalaysia, JPS, Google Weather, and live news across all 16 Malaysian states — creating an always-current intelligence layer independent of citizen submissions.

| Source | Data Retrieved |
|:---|:---|
| MetMalaysia | Rainfall warnings, storm advisories, weather forecasts |
| JPS (Jabatan Pengairan dan Saliran) | Water level readings, flood gate status, river alerts |
| Google Weather | Hourly conditions, precipitation data |
| Live news & social media | Eyewitness reports, road closure updates |

---

### `07` Real-Time Evacuation Centre Discovery

When a user opens any flood alert, **Google Maps Places API** finds the nearest verified evacuation-suitable locations within 10km — community halls, public shelters, and schools — sorted by real geographic proximity using the **Haversine formula** and navigable with one tap.

> No hardcoded addresses. No static lists. Every result is a verified real-world location, recalculated live for every alert in every part of Malaysia.

---

### `08` Government Intelligence Dashboard

The GOV tab is a judge-facing command centre demonstrating the full system capability end-to-end:

- 📊 **Key Metrics** — Total incidents, avg severity, affected areas, drainage efficiency
- 🗺️ **Location Analytics** — All hotspots ranked by severity and incident count across all 16 states
- 🏗️ **Infrastructure Insights** — Critical zones (severity ≥ 8), maintenance needed, avg response time
- 🐝 **Swarm Intelligence Panel** — Live node grid with active/idle/offline status badges, network health score
- 🤖 **Command Agent Terminal** — Full chain-of-thought live terminal, Run Mission button, mission history
- 📡 **MCP Tool Activity Feed** — Last 5 tool calls with timestamps and results from `missionLogs/`
- 📥 **Official Export** — Download CSV report with timestamp in filename

---

## 4) System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BILAHUJAN Swarm Architecture                        │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            Autonomous Command Agent (Gemini 2.0 Flash)            │   │
│  │  Phase 1: Mission Planning (Chain-of-Thought)                     │   │
│  │  Phase 2: MCP Tool Execution (7 tools · 800ms inter-step)         │   │
│  │  Phase 3: Mission Summary + Firebase Persistence                  │   │
│  └──────────────────┬───────────────────────────────────────────────┘   │
│                     │  Model Context Protocol (MCP)                      │
│      ┌──────────────┼──────────────────────┐                            │
│      │              │                       │                            │
│  scan_flood_zone  get_zone_status   update_zone_severity                 │
│  get_active_nodes dispatch_alert    get_system_health                    │
│                        thermal_scan (Haversine geo)                      │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            Decentralised Citizen Swarm Network                    │   │
│  │   NODE-001 ◉  NODE-002 ◉  NODE-003 ◎  NODE-004 ○  NODE-N ◉     │   │
│  │   (Every flood report = an active intelligence node)              │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌─────────────────┐  ┌──────────────────────┐  ┌──────────────────┐   │
│  │  Firebase RTDB  │  │  Gemini 2.5 Flash     │  │ Google Maps API  │   │
│  │  (live state)   │  │  (12-pass pipeline)   │  │  (37 zones)      │   │
│  └─────────────────┘  └──────────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 5) Full Data Pipeline — Citizen to Authority

| Step | What Happens |
|:---:|:---|
| **1** | Citizen opens BILAHUJAN app → taps Scan Near Me on MapScreen |
| **2** | CameraScreen captures photo → `analyzeFloodImage()` triggers 12-pass Gemini pipeline |
| **3** | ResultScreen displays: severity score, depth, passability per vehicle type, AI directive |
| **4** | "Upload to Alert Zone" → `saveUserReport()` → Firebase RTDB `liveReports/` |
| **5** | Citizen node becomes **ACTIVE** in swarm network — agent can now discover it |
| **6** | Command Agent detects new node via `get_active_nodes` MCP tool |
| **7** | Agent plans mission: `scan_flood_zone` → `update_zone_severity` → `dispatch_alert` |
| **8** | `agentAlerts/{zoneId}` written → JPS / NADMA / APM notified |
| **9** | GOV dashboard auto-updates: analytics, infrastructure insights, MCP activity feed |
| **10** | `systemHeartbeat` updated every 60 seconds — 24/7 uptime monitoring |

> **Zero manual intervention at any step.** Input: citizen photo + GPS. Output: authority alert dispatched, zone updated, mission logged — all within 60 seconds.

---

## 6) AI Implementation Details

### 🤖 Two Models, Four Modalities

| Model | Transport | Use Case | Key Config |
|:---|:---:|:---|:---|
| `gemini-2.5-flash` | REST + AbortController | Image analysis — all 12 passes | `temp: 0.1` · `thinkingBudget: 0` · 35s timeout |
| `gemini-2.5-flash` | SDK fallback | Image analysis — SDK fallback only | `temp: 0.1` · `timeout: 35s` |
| `gemini-2.0-flash` | SDK + Google Search | State/town weather · location risk | `temp: 0.1` · `maxTokens: 250–1200` |
| `gemini-2.0-flash` | SDK only | Agent planning · audio · mission summary | `temp: 0.1` · `maxTokens: 150–2000` |

> **Key optimisation:** `thinkingBudget: 0` is set on all image analysis passes to eliminate reasoning overhead and achieve sub-35-second response times — critical for emergency triage.

---

### 🔄 Image Analysis Fallback Chain

```
Primary:   gemini-2.5-flash REST API (35s AbortController timeout)
    ↓ [REST fails]
Secondary: gemini-2.5-flash SDK (35s withTimeout)
    ↓ [SDK returns structured .parsed object]
           → normalizeFloodAnalysisResult() → finalizeParsedResult()
    ↓ [SDK returns raw text]
           → parseFloodAnalysisText() → finalizeParsedResult()
    ↓ [all above fail]
           → recoverFloodFalseNegative() → enforceSeverityGuardrails()
           → harmonizeMetricsWithSeverity() → cached and returned
```

---

### 📊 Data Strategy & Engineering

BILAHUJAN implements a **robust, layered data strategy** with preprocessing, cleaning, fallback handling, and bias prevention:

| Layer | Strategy |
|:---|:---|
| **Noise filtering** | `isValidLocationName()` strips weather strings ("Cloudy", "Rainy") from location analytics — prevents metadata bleeding into hotspot names |
| **Bias prevention** | `isNaturalSceneNoUrban` detection prevents rivers/canals from inflating severity averages |
| **Severity floor** | Avg calculations exclude zones with severity < 2 — weather-fallback zones with no real flood data are filtered |
| **Intelligent cache** | `riskScore > 3` cache hits still re-run critical cue detection + scene context + calibration — cached results always reflect latest safety signals |
| **Fallback chain** | Tier 1: live API + Google Search → Tier 2: AI knowledge base (no quota) → Tier 3: hardcoded seed towns (16 states, 100% uptime) |
| **Rate limiting** | 4-second cooldown · 10-minute analysis cache · 3-second non-blocking Firebase lookup |

**Pre-seeded ground truth data:** `historicalFloodData.ts` contains **28 real Malaysian flood records** seeded across all 16 states, severity range 5–10, timestamps 1–25 days ago.

---

## 7) Validated Test Cases

> Every test case below is verifiable on the live platform at [bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)

| Scenario | Expected Output | Result |
|:---|:---:|:---:|
| Ankle-deep puddle on road | 3–4 MINOR | ✅ |
| Knee-deep urban flooding | 5–6 MODERATE | ✅ |
| Waist / car bonnet level | 7–8 SEVERE | ✅ |
| Car partially submerged | 7–8 SEVERE | ✅ |
| Car fully submerged | 9 CRITICAL | ✅ |
| People stranded on rooftop | ≥ 9 CRITICAL (forced) | ✅ |
| Normal river, no flood danger | 1–2 NORMAL (capped) | ✅ |
| Selfie / food / indoor photo | Rejected at pass 1 | ✅ |
| Heavy rain ambient audio | MODERATE–HIGH risk | ✅ |
| Quiet indoor audio | NONE risk | ✅ |

---

## 8) Overview of Technologies Used

### 🟦 Google Technologies

| Technology | Role in BILAHUJAN |
|:---|:---|
| **Gemini 2.5 Flash** | 12-pass flood image analysis pipeline — primary model for all visual passes via REST |
| **Gemini 2.0 Flash** | Agent mission planning, chain-of-thought reasoning, audio analysis, state/town weather |
| **Google Search Grounding** | Real-time MetMalaysia, JPS, Google Weather data for all 16 states |
| **Maps JavaScript API** | Real-time dual-layer flood zone visualisation — state circles + fine-grained polygons |
| **Places API** | Automatic discovery of nearest verified evacuation centres per alert zone |
| **Geocoding API** | 3-layer Malaysian location validation (text → coordinates → place type) |
| **Firebase Realtime Database** | Live cross-user flood zone synchronisation, swarm node registry, agent mission logs |
| **Firebase Firestore** | Historical analytics, verified citizen reports, analysis results |
| **Firebase Hosting** | Global CDN deployment — zero infrastructure maintenance |

---

### 🔧 Supporting Stack

| Tool | Version | Purpose |
|:---|:---:|:---|
| React + TypeScript | 18 | Type-safe component-driven single-page application |
| Vite | 6 | Sub-4-second production builds with hot module replacement |
| Tailwind CSS | 3 | Consistent utility-first UI — mobile-first, tested at 390px |
| @google/genai SDK | 1.29 | Official Gemini client with `responseSchema` JSON enforcement |
| @react-google-maps/api | 2.20 | Type-safe React bindings for all Google Maps components |

---

### 🤝 Manus Agentic AI — Pro Credits Integration

BILAHUJAN leverages **Manus Pro Credits** (from Meta) as an agentic reasoning layer that complements the Gemini-powered Command Agent — demonstrating true **multi-platform agentic orchestration** in a real emergency response context.

| Role | How Manus Is Used in BILAHUJAN |
|:---|:---|
| **Agentic workflow design** | Manus assisted in architecting the 3-phase autonomous mission loop (Plan → Execute → Summarise) with production-grade reasoning patterns |
| **MCP strategy validation** | Manus evaluated and refined the 7-tool MCP registry design — validating tool boundaries, discovery logic, and agent–tool interface contracts |
| **Chain-of-Thought prompt engineering** | Manus-guided prompt design ensures the Command Agent explains its reasoning step-by-step before each tool call — a mandatory Case Study 3 requirement |
| **Multi-agent scenario planning** | Manus modelled swarm expansion scenarios: how the system behaves when 10, 100, or 10,000 citizen nodes are simultaneously active |
| **Stress-test adversarial cases** | Manus generated adversarial test cases (conflicting node reports, offline zones, partial tool failures) used to harden the agent's fallback logic |

> **Why this matters for V Hack judging:** The Case Study 3 track explicitly evaluates *Agentic AI* capability. Using Manus Pro Credits — a production-grade agentic AI platform from Meta — demonstrates that BILAHUJAN is not a one-model hackathon project, but a **multi-platform agentic system** built with industry-standard tools.

```
BILAHUJAN Agentic Stack:
  Gemini 2.0 Flash   →  Mission planning · Chain-of-Thought · Tool execution
  Manus (Meta)       →  Agentic workflow design · MCP validation · Adversarial testing
  Firebase RTDB      →  Persistent state · Real-time swarm data
  MCP Tool Registry  →  7 standardised tools · Agent-to-swarm interface
```

---

### 💻 GitHub Copilot — AI-Assisted Development

BILAHUJAN was built with **GitHub Copilot** (accessed via the **GitHub Student Developer Pack**) as an AI pair programmer throughout the entire development lifecycle — directly contributing to the production-grade code quality that the judging criterion *Technical Feasibility & Scalability* evaluates.

| Area | How GitHub Copilot Contributed |
|:---|:---|
| **TypeScript type safety** | Copilot auto-completed complex TypeScript interfaces (`FloodAnalysisResult`, `SwarmNode`, `MCPTool`, `MissionLog`) — ensuring full type coverage across all 7 services |
| **Gemini pipeline boilerplate** | Accelerated writing of repetitive REST fetch + AbortController + JSON parse patterns across all 12 analysis passes — reducing human error in critical safety code |
| **Firebase query patterns** | Copilot suggested correct `ref()`, `get()`, `set()`, `onValue()` patterns for each of the 8 RTDB paths — keeping the data layer consistent throughout |
| **MCP tool registry structure** | Assisted in scaffolding the `MCPTool[]` registry type and the `getToolByName()` resolver — maintaining uniform tool interface contracts |
| **Test case generation** | Generated the adversarial edge cases used in the validated test suite (9 scenarios across image, audio, and rejection paths) |
| **Tailwind CSS class suggestions** | Inline suggestions for responsive utility classes kept the mobile-first UI consistent at 390px without manual lookup |

> **Why this matters for V Hack judging:** GitHub Copilot is not just a convenience tool — it is evidence of **developer best practices**. Using Copilot via the GitHub Student Developer Pack demonstrates that the team builds with industry-standard AI-assisted workflows, producing cleaner, more consistent, and more maintainable code under hackathon time pressure.

```
BILAHUJAN Development Stack:
  GitHub Copilot     →  AI pair programmer · TypeScript safety · consistent patterns
  Manus (Meta)       →  Agentic architecture design · MCP validation
  Gemini 2.0 Flash   →  Mission planning · Chain-of-Thought · Tool execution
  Gemini 2.5 Flash   →  12-pass image analysis pipeline
  Firebase RTDB      →  Persistent state · Real-time swarm data
```

---

## 9) Firebase Database Structure

```
Firebase Realtime Database:
├── liveZones/{zoneId}          ← 37 pre-seeded zones + live citizen reports
├── liveReports/{reportId}      ← citizen flood submissions (= swarm nodes)
├── missionLogs/{missionId}     ← agent chain-of-thought history + results
├── agentStatus/                ← { isRunning, totalMissionsRun, lastMission }
├── agentAlerts/{zoneId}        ← dispatched alerts to JPS / NADMA / APM
├── sensorNodes/{nodeId}        ← swarm network node registry
├── analysisCache/{hash}        ← Gemini result cache (DJB2 hash, 10-min TTL)
└── systemHeartbeat/status      ← 24/7 health monitoring (60s intervals)

Firestore Collections:
├── floodZones                  ← historical zone documents
├── reports                     ← verified citizen reports
├── analysisResults             ← Gemini 16-field outputs
├── systemLogs                  ← activity audit trail
└── audioAnalysis               ← audio risk assessments
```

---

## 10) Challenges Faced

| Challenge | Root Cause | Solution |
|:---|:---|:---|
| Agent only checking `liveReports` | `get_active_nodes` tool missed pre-seeded zones | Updated tool to query both `liveReports/` and `liveZones/` — agent now sees all 54 zones |
| Avg severity pulled down to ~1.9 | Weather-fallback zones with severity=1 inflating average | Added `severity >= 2` filter in `getFloodStatistics()` before averaging |
| KL showing "—" as top hotspot | `locationName` null/undefined → not falling back to `state` field | `getLocationAnalytics()` now falls back to `state` when `locationName` is absent |
| Terminal horizontal scrollbar | Long chain-of-thought lines overflowing container | Added `overflow-x: hidden` + `word-break: break-word` to terminal wrapper |
| Some states showing "Cloudy" as hotspot | Weather condition strings passing `isValidLocationName()` check | Strengthened filter with weather keyword blacklist |
| Debug badges visible in production | Node grid rendering `unix-ms:number` diagnostic badges | Removed all debug badge code from `nodeDiscovery.ts` and `GovernmentDashboard.tsx` |
| Command Agent reporting no high-severity zones | Agent only scanned `liveReports` not `liveZones` | Fixed `get_active_nodes` + `thermal_scan` to read from `liveZones/` as primary source |
| Gemini model name invalid | Model referenced incorrectly in fallback path | Corrected to `gemini-2.5-flash` across all call sites with validated key check |

---

## 11) Installation & Setup

**Prerequisites:** Node.js v18+ · Firebase CLI (`npm install -g firebase-tools`)

```bash
# Clone the repository
git clone https://github.com/HowardWoon/FEI-BILAHUJAN.git
cd FEI-BILAHUJAN

# Switch to V Hack branch
git checkout vhack-2026

# Install dependencies
npm install
```

Create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

> ⚠️ **Never commit `.env` to Git.** It is already listed in `.gitignore`. Google automatically scans public repos and **instantly revokes** any API key it detects. Get a free Gemini key at [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The `VITE_` prefix is required — Vite only exposes variables with this prefix to the browser bundle.

```bash
# Start local development server
npm run dev

# Deploy to V Hack Firebase
npm run build
firebase use vhack
firebase deploy --only hosting
```

**Firebase alias commands:**
```bash
firebase use vhack      # → switch to V Hack project (bilahujan-vhack.web.app)
firebase use kitahack   # → switch to KitaHack project (DO NOT DEPLOY HERE)
```

**🌐 V Hack Live Site:** https://bilahujan-vhack.web.app

---

## 12) Future Roadmap

| Phase | Feature | Technology | Impact |
|:---:|:---|:---|:---|
| **1** | Progressive Web App | Service Workers + Web Push | Install from browser · push alerts when app is closed |
| **2** | 🔑 Full Offline Swarm Mode | TensorFlow Lite + IndexedDB | AI flood detection with **zero internet** — functional when cell towers fail |
| **3** | Predictive Flood Pathing | Google Elevation API + topographic modelling | Warn downstream communities **before water physically arrives** |
| **4** | Physical Drone Integration | MCP + real drone SDK | Extend the same MCP tool layer to control actual hardware |
| **5** | National Authority Command Centre | Firebase + NADMA API | Full loop: Citizen → AI → Government → Live rescue dispatch |
| **6** | Manus Multi-Agent Swarm | Manus + MCP + Gemini | Deploy Manus as a parallel orchestrator — multiple specialised sub-agents (triage, routing, logistics) coordinate under a single swarm brain |

> **Phase 2 is the most critical:** the Case Study 3 scenario assumes infrastructure failure. On-device TensorFlow Lite would make BILAHUJAN's swarm fully functional with **zero internet** — operating exactly when it is most needed.

---

## 13) Judging Criteria Coverage

### Technical — 50%

| Criterion | Coverage | Weight |
|:---|:---|:---:|
| **AI Implementation Strategy & Configuration** | Two models · four modalities · 12-pass pipeline · `thinkingBudget: 0` · per-pass temperature + token tuning · **Manus-validated agentic architecture** | 10% |
| **Data Strategy & Engineering** | MetMalaysia/JPS live grounding · bias filters · `isValidLocationName()` · 3-tier fallback · 28 seeded records · 10-min intelligent cache | 10% |
| **Model Performance & Validation** | Physical-anchor severity scale · 10 validated test cases · hard floor rules table · dual-direction guardrails | 10% |
| **System Integration** | Full 10-step citizen→agent→authority pipeline · zero manual intervention · real-time Firebase listeners · MCP tool layer | 10% |
| **Technical Feasibility & Scalability** | 16/16 features operational · full TypeScript · modular services · production error handling matrix · 5-phase ASEAN roadmap · **GitHub Copilot-assisted development (Student Developer Pack)** | 10% |

### Business — 40%

| Criterion | Coverage | Weight |
|:---|:---|:---:|
| **Market Potential & Demand** | 32M Malaysian users · 160+ local councils · RM5B+ insurance market · 5-stream revenue model · ASEAN expansion | 10% |
| **Impact & Social Value** | SDG 9.1 + 9.5 + 3.d mapped · 200,000+ Malaysians protected · Malay-language cue detection · rooftop rescue trigger | 10% |
| **Sustainability** | RM0/month at MVP · no model retraining · modular prompt versioning · hardcoded seed for 100% offline uptime | 10% |
| **Innovation & Creativity** | Citizens-as-drones model · physical anchor scoring · dual guardrails (unique) · intelligent cache validation · MCP as emergency standard · **Gemini + Manus multi-platform agentic stack** | 10% |

---

## 14) Full Feature Delivery Checklist

> Every item below is **live and testable** at [bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)

| Feature | Status |
|:---|:---:|
| Autonomous Command Agent — 3-phase mission loop | ✅ |
| MCP tool registry — 7 standardised tools | ✅ |
| Chain-of-Thought live terminal in GOV dashboard | ✅ |
| Decentralised citizen swarm network with node classification | ✅ |
| Gemini 2.5 Flash 12-pass image analysis pipeline | ✅ |
| Physical-anchor severity rubric with hard floor rules | ✅ |
| 16-field structured JSON output per analysis | ✅ |
| Dual-direction guardrails (false positive + false negative) | ✅ |
| Image rejection gate (non-flood images blocked with reason) | ✅ |
| Audio environment flood risk scanning | ✅ |
| Live weather intelligence via Google Search grounding | ✅ |
| 37 pre-seeded flood zones across all 16 states | ✅ |
| Dual-layer map (state circles + fine-grained polygons) | ✅ |
| Real-time evacuation centre discovery via Places API | ✅ |
| Haversine distance sorting of evacuation centres | ✅ |
| 3-layer Malaysian location validation | ✅ |
| Structured 5-step flood report with authority notification | ✅ |
| Mandatory 4-condition submission gate | ✅ |
| Government analytics dashboard — full analytics + MCP feed | ✅ |
| CSV export with timestamp filename | ✅ |
| Firebase 24/7 monitoring + 60s heartbeat | ✅ |
| Historical flood data seeded — 28 records across 16 states | ✅ |
| Hardcoded 16-state fallback — 100% offline uptime guarantee | ✅ |
| Malay-language flood cue detection in prompts | ✅ |
| Manus Pro Credits — agentic workflow design + MCP validation + adversarial testing | ✅ |
| GitHub Copilot (Student Developer Pack) — AI-assisted TypeScript, Firebase, MCP development | ✅ |
| Mobile-first — tested at 390px viewport | ✅ |

---

## 15) Commercial Viability

All collected data is **fully anonymized** and **privacy-compliant**. The anonymized dataset has direct commercial value:

| Buyer | What They Receive | Why It Has Value |
|:---|:---|:---|
| 🏛️ Government (JPS, NADMA, APM) | Verified real-time intelligence · time-series zone exports | Emergency preparedness and resource allocation |
| 🏦 Insurance Companies | Flood risk scores by postcode · historical incident frequency | Accurate property and vehicle insurance premium calculation |
| 🏗️ Property Developers | Zone heatmaps · drainage performance scores | Site selection, risk disclosure, infrastructure planning |
| 🏙️ Urban Planners & Councils | Drainage efficiency · critical zones · historical trends | Infrastructure investment prioritisation |
| 🔬 Academic & Research | Anonymized hydrology datasets | Publication-quality data at a fraction of traditional sensor cost |

```
Every citizen report simultaneously:
    improves public safety  AND  grows the commercial data asset
                    ↑________________________↑
                         compounds with every new user
```

---

## 16) Acknowledgements

- **V Hack 2026 & Universiti Sains Malaysia** — for the platform and the opportunity
- **Google** — for Gemini, Firebase, Google Maps Platform, and the @google/genai SDK
- **Manus (from Meta)** — for Pro Credits that powered the agentic architecture design, MCP validation, and adversarial stress-testing of the Command Agent
- **GitHub** — for the Student Developer Pack and GitHub Copilot, which accelerated development velocity and enforced code consistency across 7 service modules under hackathon time pressure
- **NADMA, JPS, APM, BOMBA** — whose real-world emergency response domains shaped every design decision
- **The people of Kelantan, Terengganu, and the Klang Valley** — whose annual experiences with flooding are the human reality behind every line of code

---

<div align="center">

<br>

**SDG 9** · Industry, Innovation & Infrastructure &nbsp;|&nbsp; **SDG 3** · Good Health & Well-being

<br>

*BILAHUJAN is dedicated to every Malaysian family that has lost property, safety, or loved ones to floodwater —*

*and to the emergency responders who work through the storm to reach them.*

<br>

**© 2026 FEI Team · Built for V Hack 2026 · Universiti Sains Malaysia**

<br>

**[🌐 bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)**

<br>

</div>
