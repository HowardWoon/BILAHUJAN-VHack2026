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
| 🌐 Malaysian States Covered | **All 16 + 3 Federal Territories (KL, Putrajaya, Labuan)** |
| 🏙️ Towns Pre-seeded for Monitoring | **150+ towns across all states** |
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

| Name | Role |
|:---|:---|
| **Howard Woon Hao Zhe** | Lead Software Engineer & AI Integrator — full technical build, Gemini multi-pass pipeline, MCP tool registry, Command Agent, Firebase architecture, Google Maps integration |
| **Sanjay Mukojima Ravindran** | Front-End Engineer & UX Architect — UI design execution, mobile-first layout, human-centred design for high-stress use conditions |
| **Wong En Sheng** | Marketing Lead & Pitching Strategist — pitching materials, public-facing narrative, SDG impact framing |
| **Ng Tze Fhung** | Technical Documentation Lead & Presentation Designer — system documentation, judge-facing slides, written and visual deliverables |

---

## 2) Project Overview

### 🔴 Problem Statement

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
| **Communication Blackout** | Cell towers and internet fail in the critical first 72 hours |
| **Centralised Single Points of Failure** | Standard platforms collapse when infrastructure collapses |
| **Subjective Severity Reporting** | Civilians misjudge danger levels due to panic or shock |
| **Fragmented Data Sources** | JPS, MetMalaysia, NADMA, and social media are never unified |

---

### 🌍 SDG Alignment

| SDG | Target | BILAHUJAN's Contribution |
|:---|:---|:---|
| **SDG 9** | 9.1 & 9.5 — Industry, Innovation & Infrastructure | Decentralised swarm architecture survives infrastructure failure. 12-pass AI pipeline + MCP architecture applied to public good as cutting-edge civic R&D |
| **SDG 3** | 3.d — Good Health & Well-being | `detectCriticalRooftopCueViaRest()` triggers BOMBA/NADMA rescue dispatch before loss of life |

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

## 3) Tech Stack Proof — Firebase Live Data

> The following screenshots prove real Firebase Realtime Database usage — not mocked data.

### Firebase Console — Realtime Database (liveZones)
![Firebase RTDB](docs/firebase/firebase-rtdb-live.png)
*Live liveZones/ with real citizen-uploaded severity scores*

### Firebase Console — liveReports
![Firebase Reports](docs/firebase/firebase-reports.png)
*Real citizen flood reports with reportId, state, locationName, severity*

### Firebase Console — missionLogs
![Firebase Missions](docs/firebase/firebase-missionlogs.png)
*Autonomous agent mission logs with chain-of-thought steps*

### Firebase Console — agentAlerts
![Firebase Alerts](docs/firebase/firebase-agentalerts.png)
*Authority alerts dispatched by Command Agent to JPS/NADMA/APM*

### Firebase Console — systemHeartbeat
![Firebase Heartbeat](docs/firebase/firebase-heartbeat.png)
*24/7 system health monitoring — 60-second intervals*

### Firebase Hosting — Live Deployment
![Firebase Hosting](docs/firebase/firebase-hosting.png)
*bilahujan-vhack.web.app — active deployment on Firebase Spark plan*

---

## 4) Key Features

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

All agent-to-swarm communication is handled exclusively through the MCP tool registry — no hardcoded logic, no direct database calls from the agent.

| Tool | Firebase Path | Case Study 3 Analogue |
|:---|:---|:---|
| `scan_flood_zone` | Calls `analyzeFloodImage()` | `thermal_scan()` drone tool |
| `get_zone_status` | Reads `liveZones/{zoneId}` | `get_battery_status()` |
| `update_zone_severity` | Writes to `liveZones/` | `move_to(x,y)` — repositions attention |
| `get_active_nodes` | Reads `liveReports/` + `liveZones/` | MCP real-time tool discovery |
| `dispatch_alert` | Writes to `agentAlerts/{zoneId}` | Authority notification |
| `get_system_health` | Reads `systemHeartbeat/` | System status monitoring |
| `thermal_scan` | Haversine radius spatial search | Direct `thermal_scan()` analogue |

> **The agent uses `get_active_nodes` to discover citizen nodes dynamically** — satisfying the Case Study 3 requirement verbatim: *"The agent must use the MCP discovery mechanism to see which drones are active on the network."*

---

### `03` Decentralised Citizen Swarm Network

Every citizen report becomes a typed `SwarmNode` in the distributed sensor fleet — **zero additional infrastructure required**.

| Status | Threshold | Agent Behaviour |
|:---:|:---|:---|
| 🟢 **ACTIVE** | Last seen < 5 minutes | Highest priority — agent scans these zones first |
| 🟡 **IDLE** | Last seen 5–10 minutes | Secondary evidence — used to corroborate active nodes |
| 🔴 **OFFLINE** | Last seen > 10 minutes | Historical reference — visible in GOV dashboard node grid |

Network health score = `(active / total) × 100%` — displayed live in GOV dashboard.

---

### `04` FloodVision AI Pipeline *(12-Pass Analysis)*

Every citizen image passes through **12 sequential AI passes** using `gemini-2.5-flash` via REST.

| Pass | Name | Purpose |
|:---:|:---|:---|
| 1 | Guideline Classification | Reject non-flood images at the gate |
| 2 | Primary Analysis | Full 16-field structured extraction with physical depth anchors |
| 3 | False Negative Recovery | Recovery if primary rejects a real flood image |
| 4 | Low-Score Reassessment | Re-evaluate score ≤ 3 for missed severe cues |
| 5 | Rooftop Cue Detection | Detect `bumbung rumah`, `atas bumbung`, rooftop rescue |
| 6 | Severity Calibration | Physical anchor calibration: ankle → knee → bonnet → roof |
| 7 | Scene Context | Identify normal waterbodies with no flood danger |
| 8 | Professional Regrade | Final reassessment if score still ≤ 3 |
| 9 | Score Merge | `max(primary, calibration, formula floor)` |
| 10 | Critical Override | Rooftop cue always beats scene cap — safety is absolute |
| 11 | Scene Context Cap | Normal waterbody + no danger → cap at NORMAL (2) |
| 12 | Guardrails + Consistency | Hard floor rules + anti-over-scoring for static waterbodies |

---

### `05` Severity Scoring — Physical Anchor Model & Single Source of Truth

All severity label functions are defined **once** in `src/utils/floodCalculations.ts` and imported by every screen — zero local overrides allowed.

| Score | Level | Physical Anchor | Hard Floor Rule |
|:---:|:---|:---|:---|
| 1–2 | 🟢 NORMAL | Dry or damp surface · normal waterbody | River/canal/sea → cap at 2 |
| 3–4 | 🟡 MINOR | Ankle-deep · < 0.2m | Depth ≥ 0.2m → floor 4 |
| 5–6 | 🟠 MODERATE | Knee-deep · 0.2–0.5m | Flooded road → floor 5 |
| 7–8 | 🔴 SEVERE | Waist/car bonnet · 0.5–1.3m | **Car bonnet submerged → min 7** |
| 9 | 🆘 CRITICAL | Car roof / rooftop rescue · > 1.3m | **Rooftop rescue → min 9 (unbypassable)** |
| 10 | ☠️ CATASTROPHIC | Buildings submerged · > 3m | Complete submersion → 10 |

**Gemini receives this physical reference table in every image analysis prompt** — anchoring its score to real physical measurements visible in the image, not generic severity estimates.

**Dual-direction guardrails:**

```
❌  Standard AI:   Only prevents false negatives (misses real floods)
✅  BILAHUJAN:     Prevents false negatives AND false positives simultaneously

Anti-false-negative → inferMinimumRiskScore() + enforceSeverityGuardrails()
Anti-false-positive → enforceProfessionalConsistency() + applySceneContextCap()
Critical override   → applyCriticalVisualOverride() — always beats scene cap
```

---

### `06` Real-Time Location Intelligence — All 16 States + 3 Federal Territories

BILAHUJAN implements a **3-priority location normalization pipeline** ensuring every flood report stores a clean `"Town, State"` formatted location name.

```
Priority 1: Google Geocoding address_components (locality + admin_level_1)
Priority 2: MALAYSIA_TOWNS dictionary scan (150+ towns, all 16 states)
Priority 3: String cleaning + building name filter + postcode removal
```

**Federal Territory special handling:**

| Territory | Problem | Solution |
|:---|:---|:---|
| Kuala Lumpur | `"Kuala Lumpur, Kuala Lumpur"` duplicate | `resolveKLDistrict()` → KL_DISTRICT_MAP (25 districts) |
| Putrajaya | `"Putrajaya, Putrajaya"` duplicate | `PUTRAJAYA_PRECINCT_MAP` (Presint 1–20) |
| Labuan | `"Labuan, Labuan"` duplicate | `LABUAN_DISTRICT_MAP` → `"Labuan Town"` |

**Building name filter** removes institution names from location display:
```
"Kolej Kediaman Tun Ahmad Zaidi, KL" → "Titiwangsa, Kuala Lumpur"
"Kompleks Sukan Aquatik, Putrajaya"  → "Presint 4, Putrajaya"
"R95X+X8 Bahau, Negeri Sembilan"     → "Bahau, Negeri Sembilan"
```

---

### `07` Multi-Source Statistical Data Pipeline

All statistics are derived from **real-time Firebase data** using validated statistical formulas — never hardcoded.

| Formula | Used In | Description |
|:---|:---|:---|
| **Weighted Composite Severity** | Zone upload | `0.50×Gemini + 0.25×rainfall + 0.15×historical + 0.10×reportDensity` |
| **State Severity** | AlertsScreen | `Math.max(...realZones.filter(state))` |
| **Drainage Efficiency** | GOV Dashboard | `100 - (avgBlockage × affectedRatio)` |
| **Avg Response Time** | GOV Dashboard | `mean(dispatchedAt - firstReportedAt)` in minutes |
| **AI Confidence** | ZoneDetailScreen | `0.40×Gemini + 0.30×agreement + 0.30×historicalMatch` |
| **Report Density** | Zone severity | `min(10, reportsLast30min × 2)` |

**`isRealZone()` filter** — exported from `floodCalculations.ts` and applied in every screen and service. Only zones with `source: 'user'`, `isWeatherFallbackZone: false`, and `severity >= 2` count as real incidents. Baseline/seed zones never inflate analytics.

---

### `08` Alert Menu — Dark Theme UI with Full Zone Detail

**Navigation flow:**
```
AlertsScreen (16 state cards, real-time severity from isRealZone() filter)
  → tap state card
  → AlertDetailScreen (all towns per state, ACTIVE FLOOD ZONES vs MONITORED LOCATIONS)
    → tap "View More →" on any town card
      → ZoneDetailScreen (full AI analysis, map, evacuation centres)
```

**ZoneDetailScreen — 5 sections:**
1. **Hero banner** — severity color + risk label (`severityToRiskLabel()`) + AI peak prediction
2. **Time row** — START / END formatted as DD/MM/YYYY h:mm:ss am/pm
3. **Stats row** — Drainage % · Rainfall mm/hr · AI Confidence % (all formula-derived)
4. **Gemini AI Analysis** — full-width Google Maps Static thumbnail + visual analysis + historical context
5. **AI Recommendation** — nearest evacuation centres (Places API, 10km radius, Haversine sorted)

---

### `09` Evacuation Centre Discovery — Select Then Go

Users **tap to select** an evacuation centre first, then tap **Go →** to open Google Maps directions.

**Multi-tier search fallback (no empty results ever):**
```
Step 1: "dewan orang ramai" radius 10km
Step 2: "community hall" radius 15km
Step 3: "sekolah kebangsaan" radius 20km  ← schools = official evacuation centres in Malaysia
Step 4: "masjid OR surau" radius 20km     ← mosques = gazetted emergency shelters
Step 5: "Call NADMA: 03-8064 2400"        ← if all searches fail
```

---

### `10` Live Multi-Source Weather Intelligence

The Alert Menu uses **Gemini 2.0 Flash + Google Search grounding** to pull real-time conditions from MetMalaysia, JPS, Google Weather, and live news across all 16 Malaysian states.

| Source | Data Retrieved |
|:---|:---|
| MetMalaysia | Rainfall warnings, storm advisories, weather forecasts |
| JPS (Jabatan Pengairan dan Saliran) | Water level readings, flood gate status, river alerts |
| Google Weather | Hourly conditions, precipitation data |
| Live news & social media | Eyewitness reports, road closure updates |

---

### `11` Government Intelligence Dashboard

- 📊 **Key Metrics** — Total incidents, avg severity, affected areas, drainage efficiency (all `isRealZone()` filtered)
- 🗺️ **Location Analytics** — All hotspots in `"Town, State"` format, ranked by avg severity
- 🏗️ **Infrastructure Insights** — Critical zones ≥ 8, maintenance zones ≥ 65% blockage, avg response time
- 🐝 **Swarm Intelligence Panel** — Live node grid with active/idle/offline status, network health score
- 🤖 **Command Agent Terminal** — Full chain-of-thought live terminal, Run Mission button, mission history
- 📡 **MCP Tool Activity Feed** — Last 5 tool calls with timestamps and results from `missionLogs/`
- 📥 **Official Export** — Download CSV report with timestamp in filename

---

## 5) System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      BILAHUJAN Swarm Architecture                       │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            Autonomous Command Agent (Gemini 2.0 Flash)           │   │
│  │  Phase 1: Mission Planning (Chain-of-Thought)                    │   │
│  │  Phase 2: MCP Tool Execution (7 tools · 800ms inter-step)        │   │
│  │  Phase 3: Mission Summary + Firebase Persistence                 │   │
│  └──────────────────┬───────────────────────────────────────────────┘   │
│                     │  Model Context Protocol (MCP)                     │
│      ┌──────────────┼──────────────────────┐                            │
│      │              │                      │                            │
│  scan_flood_zone  get_zone_status   update_zone_severity                │
│  get_active_nodes dispatch_alert    get_system_health                   │
│                   thermal_scan (Haversine geo)                          │
│                                                                         │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │            Decentralised Citizen Swarm Network                   │   │
│  │   NODE-001 ◉  NODE-002 ◉  NODE-003 ◎  NODE-004 ○  NODE-N ◉     │   │
│  │   (Every flood report = an active intelligence node)             │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────┐  ┌──────────────────────┐  ┌──────────────────┐    │
│  │  Firebase RTDB  │  │  Gemini 2.5 Flash    │  │ Google Maps API  │    │
│  │  (live state)   │  │  (12-pass pipeline)  │  │  (37 zones)      │    │
│  └─────────────────┘  └──────────────────────┘  └──────────────────┘    │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 6) Full Data Pipeline — Citizen to Authority

| Step | What Happens |
|:---:|:---|
| **1** | Citizen opens BILAHUJAN → searches location or uses GPS on MapScreen |
| **2** | `SelectedLocation` object created — passed through MapScreen → CameraScreen → ResultScreen |
| **3** | CameraScreen / ReportScreen captures photo → `analyzeFloodImage()` triggers 12-pass Gemini pipeline |
| **4** | ResultScreen displays: severity score, depth, passability per vehicle type, AI directive |
| **5** | "Upload to Alert Zone" → writes to `liveZones/` with **real Gemini score** (never hardcoded) |
| **6** | Location normalized to `"Town, State"` via `normalizeToTownState()` before Firebase write |
| **7** | AlertsScreen auto-updates via Firebase `onValue()` listener — no polling, no setInterval |
| **8** | Command Agent detects new node via `get_active_nodes` MCP tool |
| **9** | Agent: `scan_flood_zone` → `update_zone_severity` → `dispatch_alert` |
| **10** | `agentAlerts/{zoneId}` written → JPS / NADMA / APM notified |

> **Zero manual intervention at any step. Input: citizen photo + location. Output: authority alert dispatched within 60 seconds.**

---

## 7) Challenges Faced & Resolved

| Challenge | Root Cause | Solution |
|:---|:---|:---|
| Severity always showing 5 after upload | `?? 5` hardcoded fallback in ResultScreen | Removed all `?? 5` defaults — `geminiSeverity` extracted from all possible field names |
| ZoneDetailScreen showing wrong label (MODERATE for Level 7) | Local severity→label mapping contradicted Gemini result | Single source of truth in `floodCalculations.ts` — all screens import from there |
| All states showing CRITICAL from seed data | Baseline zones had severity 9 from old seeding | `resetBaselineSeverities()` resets all baseline zones to severity 1 |
| Location showing state name only (e.g. "Selangor") | `normalizeToTownState()` not receiving geocode components | Enhanced with `MALAYSIA_TOWNS` dictionary scan + `getMainTown()` capital fallback |
| `"Kuala Lumpur, Kuala Lumpur"` duplicate | KL locality === KL state in Google Geocoding | `resolveKLDistrict()` + `KL_DISTRICT_MAP` — scans for actual district |
| Putrajaya / Labuan same duplicate issue | Same Federal Territory locality = state name | `PUTRAJAYA_PRECINCT_MAP` + `LABUAN_DISTRICT_MAP` + `FEDERAL_TERRITORIES` Set |
| Building names in location (e.g. Kolej Kediaman) | GPS too precise → returns POI name | `isBuildingName()` filter skips institution names when extracting town from geocode |
| Searched location ignored — GPS used in ResultScreen | ReportScreen/CameraScreen re-geocoding from device GPS | `SelectedLocation` object passed through full MapScreen → Camera → Result → Firebase chain |
| ReportScreen map not moving to searched location | `setMapCenter()` not called after geocode | Map center now controlled by `mapCenter` state, updated on every search result |
| GOV dashboard showing 0 incidents | `isRealZone()` filter too strict, excluding valid uploads | Relaxed to `isWeatherFallbackZone !== true && severity >= 2` |
| Duplicate town cards in AlertDetailScreen | Seeding wrote same zone twice to Firebase | Client-side dedup: `findIndex` by `locationName + state` before rendering |
| Evacuation centre tap navigating immediately | `onPress` opened Google Maps directly on row tap | Separated: row tap = select (highlight), Go button = navigate to Google Maps |
| Refresh button not working | Button called setState but didn't re-subscribe Firebase | `refreshKey` pattern — incrementing key forces `useEffect` to re-run and re-subscribe |
| Alert Menu blocked by notification overlay | Toast stack rendered on top of AlertsScreen with z-index | Removed overlay entirely; state cards communicate severity through color directly |
| START shows "Already in progress" on NORMAL zones | Null `startTime` fallback applied to baseline zones | Show "No event recorded" for `severity <= 1` or `isWeatherFallbackZone: true` |
| "Based on 0 verified reports" showing CRITICAL badge | Seed zones driving state severity despite no real reports | `verifiedCount === 0` → force CLEAR badge regardless of stored severity value |
| Agent not finding high-severity zones | Agent only scanned `liveReports` not `liveZones` | Fixed `get_active_nodes` + `thermal_scan` to read from `liveZones/` as primary source |
| Debug badges visible in production | Dev diagnostics left in nodeDiscovery.ts | Removed all debug badge code from `nodeDiscovery.ts` and `GovernmentDashboard.tsx` |
| Terminal horizontal scrollbar | Long chain-of-thought lines overflowing container | Added `overflow-x: hidden` + `word-break: break-word` to terminal wrapper |
| Drainage showing "Clear" with red bar | Severity→blockage % and label mapped separately | `isDrainageBlocked()` from `floodCalculations.ts` — single function controls both text and bar color |
| AI Confidence showing 49% for Level 7 | Confidence derivation not reflecting severity clarity | `deriveAIConfidence()` — extreme severities (very high/low) yield higher confidence |

---

## 8) AI Implementation Details

### 🤖 Two Models, Four Modalities

| Model | Transport | Use Case | Key Config |
|:---|:---:|:---|:---|
| `gemini-2.5-flash` | REST + AbortController | Image analysis — all 12 passes | `temp: 0.1` · `thinkingBudget: 0` · 35s timeout |
| `gemini-2.5-flash` | SDK fallback | Image analysis — SDK fallback only | `temp: 0.1` · `timeout: 35s` |
| `gemini-2.0-flash` | SDK + Google Search | State/town weather · location risk | `temp: 0.1` · `maxTokens: 250–1200` |
| `gemini-2.0-flash` | SDK only | Agent planning · audio · mission summary | `temp: 0.1` · `maxTokens: 150–2000` |

> **Key optimisation:** `thinkingBudget: 0` on all image analysis passes eliminates reasoning overhead and achieves sub-35-second response times — critical for emergency triage.

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

| Layer | Strategy |
|:---|:---|
| **Noise filtering** | `isValidLocationName()` strips weather strings from location analytics |
| **Bias prevention** | `isNaturalSceneNoUrban` detection prevents rivers/canals from inflating severity |
| **Severity floor** | Avg calculations exclude zones with severity < 2 — baseline zones filtered via `isRealZone()` |
| **Intelligent cache** | `riskScore > 3` cache hits still re-run critical cue detection + scene context |
| **Fallback chain** | Tier 1: live API + Google Search → Tier 2: AI knowledge base → Tier 3: hardcoded 16-state seed |
| **Rate limiting** | 4-second cooldown · 10-minute analysis cache · 3-second non-blocking Firebase lookup |

**Pre-seeded ground truth:** `historicalFloodData.ts` contains **28 real Malaysian flood records** seeded across all 16 states, severity range 5–10.

---

## 9) Overview of Technologies Used

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

| Role | How Manus Is Used in BILAHUJAN |
|:---|:---|
| **Agentic workflow design** | Architecting the 3-phase autonomous mission loop (Plan → Execute → Summarise) |
| **MCP strategy validation** | Evaluated and refined the 7-tool MCP registry design |
| **Chain-of-Thought prompt engineering** | Ensures the Command Agent explains reasoning step-by-step before each tool call |
| **Multi-agent scenario planning** | Modelled swarm expansion: 10, 100, and 10,000 simultaneous citizen nodes |
| **Stress-test adversarial cases** | Generated adversarial test cases to harden agent fallback logic |

```
BILAHUJAN Agentic Stack:
  Gemini 2.0 Flash   →  Mission planning · Chain-of-Thought · Tool execution
  Manus (Meta)       →  Agentic workflow design · MCP validation · Adversarial testing
  Firebase RTDB      →  Persistent state · Real-time swarm data
  MCP Tool Registry  →  7 standardised tools · Agent-to-swarm interface
```

---

### 💻 GitHub Copilot — AI-Assisted Development

| Area | How GitHub Copilot Contributed |
|:---|:---|
| **TypeScript type safety** | Auto-completed complex interfaces (`FloodAnalysisResult`, `SwarmNode`, `MCPTool`, `MissionLog`) |
| **Gemini pipeline boilerplate** | Accelerated REST fetch + AbortController + JSON parse patterns across 12 passes |
| **Firebase query patterns** | Correct `ref()`, `get()`, `set()`, `onValue()` patterns for all 8 RTDB paths |
| **MCP tool registry structure** | Scaffolded `MCPTool[]` registry and `getToolByName()` resolver |
| **Test case generation** | Generated adversarial edge cases across image, audio, and rejection paths |
| **Tailwind CSS class suggestions** | Consistent responsive utility classes at 390px mobile-first viewport |

---

## 10) Firebase Database Structure

```
Firebase Realtime Database:
├── liveZones/{zoneId}          ← real citizen uploads + 37 pre-seeded zones
│     ├── locationName          ← "Town, State" normalized format
│     ├── state                 ← normalized state name (all 16 + 3 FTs)
│     ├── severity              ← Gemini's actual score (1–10, never hardcoded)
│     ├── source                ← 'user' | 'baseline'
│     ├── isWeatherFallbackZone ← true for baseline, false for real reports
│     ├── reportId              ← links to liveReports/ entry
│     ├── lat / lng             ← coordinates for map + evacuation search
│     └── uploadedAt            ← timestamp of citizen submission
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

## 11) Validated Test Cases

> Every test case below is verifiable on the live platform at [bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)

| Scenario | Expected Output | Result |
|:---|:---:|:---:|
| Ankle-deep puddle on road | 3–4 MINOR | ✅ |
| Knee-deep urban flooding | 5–6 MODERATE | ✅ |
| Waist / car bonnet level | 7–8 SEVERE | ✅ |
| Car partially submerged | 7–8 SEVERE | ✅ |
| Car fully submerged | 9 CRITICAL | ✅ |
| People stranded on rooftop | ≥ 9 CRITICAL (forced) | ✅ |
| Buildings mostly submerged | 10 CATASTROPHIC | ✅ |
| Normal river, no flood danger | 1–2 NORMAL (capped) | ✅ |
| Selfie / food / indoor photo | Rejected at pass 1 | ✅ |
| Heavy rain ambient audio | MODERATE–HIGH risk | ✅ |
| Quiet indoor audio | NONE risk | ✅ |
| Federal Territory (KL) location | "District, Kuala Lumpur" format | ✅ |
| Building name as GPS location | Normalized to town/district | ✅ |
| Searched location passed to result | Searched location shown, not GPS | ✅ |

---

## 12) Installation & Setup

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
firebase use vhack      # → bilahujan-vhack.web.app  ← WORK HERE
firebase use kitahack   # → bilahujan-app.web.app    ← DO NOT DEPLOY HERE
```

**🌐 V Hack Live Site:** https://bilahujan-vhack.web.app

---

## 13) Full Feature Delivery Checklist

> Every item below is **live and testable** at [bilahujan-vhack.web.app](https://bilahujan-vhack.web.app)

| Feature | Status |
|:---|:---:|
| Autonomous Command Agent — 3-phase mission loop | ✅ |
| MCP tool registry — 7 standardised tools | ✅ |
| Chain-of-Thought live terminal in GOV dashboard | ✅ |
| Decentralised citizen swarm network with node classification | ✅ |
| Gemini 2.5 Flash 12-pass image analysis pipeline | ✅ |
| Physical-anchor severity rubric — 10 levels with hard floors | ✅ |
| Single source of truth severity mapping (`floodCalculations.ts`) | ✅ |
| Gemini physical depth reference in every analysis prompt | ✅ |
| 16-field structured JSON output per analysis | ✅ |
| Dual-direction guardrails (false positive + false negative) | ✅ |
| Image rejection gate (non-flood images blocked with reason) | ✅ |
| Audio environment flood risk scanning | ✅ |
| Location normalized to `"Town, State"` format everywhere | ✅ |
| Federal Territory deduplication (KL / Putrajaya / Labuan) | ✅ |
| Building name filter in geocoding pipeline | ✅ |
| 150+ Malaysian towns pre-seeded across all 16 states | ✅ |
| Searched location passed through full navigation chain | ✅ |
| `isRealZone()` filter — baseline zones never inflate analytics | ✅ |
| Weighted composite severity formula (4-source) | ✅ |
| Multi-source statistical pipeline in GOV dashboard | ✅ |
| Alert Menu dark theme redesign — state → town → zone flow | ✅ |
| ZoneDetailScreen — 5-section AI analysis page | ✅ |
| Evacuation centre select-then-GO flow | ✅ |
| Multi-tier evacuation centre fallback (DOR → school → masjid → NADMA) | ✅ |
| Upload notification with "View in Alert Menu" navigation | ✅ |
| Live weather intelligence via Google Search grounding | ✅ |
| 37 pre-seeded flood zones across all 16 states | ✅ |
| Dual-layer map (state circles + fine-grained polygons) | ✅ |
| Real-time evacuation centre discovery via Places API | ✅ |
| Haversine distance sorting of evacuation centres | ✅ |
| 3-layer Malaysian location validation | ✅ |
| Structured 5-step flood report with authority notification | ✅ |
| Government analytics dashboard — real-time, `isRealZone()` filtered | ✅ |
| CSV export with timestamp filename | ✅ |
| Firebase 24/7 monitoring + 60s heartbeat | ✅ |
| Historical flood data — 28 records across 16 states | ✅ |
| Hardcoded 16-state fallback — 100% offline uptime guarantee | ✅ |
| Malay-language flood cue detection in prompts | ✅ |
| Manus Pro Credits — agentic workflow + MCP validation + adversarial testing | ✅ |
| GitHub Copilot (Student Developer Pack) — AI-assisted development | ✅ |
| Mobile-first — tested at 390px viewport | ✅ |

---

## 14) Future Roadmap

| Phase | Feature | Technology | Impact |
|:---:|:---|:---|:---|
| **1** | Progressive Web App | Service Workers + Web Push | Install from browser · push alerts when app is closed |
| **2** | 🔑 Full Offline Swarm Mode | TensorFlow Lite + IndexedDB | AI flood detection with **zero internet** — functional when cell towers fail |
| **3** | Predictive Flood Pathing | Google Elevation API + topographic modelling | Warn downstream communities **before water physically arrives** |
| **4** | Physical Drone Integration | MCP + real drone SDK | Extend the same MCP tool layer to control actual hardware |
| **5** | National Authority Command Centre | Firebase + NADMA API | Full loop: Citizen → AI → Government → Live rescue dispatch |
| **6** | Manus Multi-Agent Swarm | Manus + MCP + Gemini | Multiple specialised sub-agents (triage, routing, logistics) under a single swarm brain |

> **Phase 2 is the most critical:** the Case Study 3 scenario assumes infrastructure failure. On-device TensorFlow Lite would make BILAHUJAN's swarm fully functional with **zero internet** — operating exactly when it is most needed.

---

## 15) Judging Criteria Coverage

### Technical — 50%

| Criterion | Coverage | Weight |
|:---|:---|:---:|
| **AI Implementation Strategy & Configuration** | Two models · four modalities · 12-pass pipeline · `thinkingBudget: 0` · per-pass temperature + token tuning · Manus-validated agentic architecture | 
| **Data Strategy & Engineering** | MetMalaysia/JPS live grounding · bias filters · `isValidLocationName()` · `isRealZone()` · 3-tier fallback · 28 seeded records · 10-min intelligent cache | 
| **Model Performance & Validation** | Physical-anchor severity scale · 14 validated test cases · hard floor rules · dual-direction guardrails · single source of truth severity mapping | 
| **System Integration** | Full 10-step citizen→agent→authority pipeline · zero manual intervention · real-time Firebase `onValue()` listeners · MCP tool layer | 
| **Technical Feasibility & Scalability** | 40+ features operational · full TypeScript · modular services · production error handling · 6-phase ASEAN roadmap · GitHub Copilot-assisted development | 

### Business — 40%

| Criterion | Coverage | Weight |
|:---|:---|:---:|
| **Market Potential & Demand** | 32M Malaysian users · 160+ local councils · RM5B+ insurance market · ASEAN expansion | 
| **Impact & Social Value** | SDG 9.1 + 9.5 + 3.d mapped · 200,000+ Malaysians protected · Malay-language cue detection | 
| **Sustainability** | RM0/month at MVP · no model retraining · modular prompt versioning · hardcoded seed fallback | 
| **Innovation & Creativity** | Citizens-as-drones model · physical anchor scoring · dual guardrails · `isRealZone()` data integrity · MCP as emergency standard · Gemini + Manus multi-platform agentic stack | 

---

## 16) Commercial Viability

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

## 17) Acknowledgements

- **V Hack 2026 & Universiti Sains Malaysia** — for the platform and the opportunity
- **Google** — for Gemini, Firebase, Google Maps Platform, and the @google/genai SDK
- **Manus (from Meta)** — for Pro Credits that powered the agentic architecture design, MCP validation, and adversarial stress-testing of the Command Agent
- **GitHub** — for the Student Developer Pack and GitHub Copilot
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
