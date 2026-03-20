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

## 2) Problem Statement

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

**The BILAHUJAN Approach:**

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

![Firebase Reports](https://github.com/user-attachments/assets/87982019-094f-4de3-b488-234f202271cf)
*Live liveZones/ with real citizen-uploaded severity scores*

---

### Firebase Console — liveReports

![Firebase Alerts](https://github.com/user-attachments/assets/cb650e6d-8ff9-442d-9cf2-3d57ea253628)
*Real citizen flood reports with reportId, state, locationName, severity*

---

### Firebase Console — missionLogs

![Firebase Heartbeat](https://github.com/user-attachments/assets/3e54f96e-829f-4a5d-9253-a0e93f819667)
*Autonomous agent mission logs with chain-of-thought steps*

---

### Firebase Console — agentAlerts

![Firebase Missions](https://github.com/user-attachments/assets/db541c37-f59c-4879-80fa-172460acc231)
*Authority alerts dispatched by Command Agent to JPS/NADMA/APM*

---

### Firebase Console — systemHeartbeat

![Firebase Hosting](https://github.com/user-attachments/assets/3d0130c4-f47f-42aa-a1e3-e2aded1eae77)
*24/7 system health monitoring — 60-second intervals*

---

### Firebase Hosting — Live Deployment

![Firebase RTDB](https://github.com/user-attachments/assets/d1aa360f-5153-4e07-9fe5-a03b90afe173)
*bilahujan-vhack.web.app — active deployment on Firebase Spark plan*

---

## 4) System Architecture

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

## 5) Full Data Pipeline — Citizen to Authority

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

## 6) Firebase Database Structure

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

## 7) Technologies Used

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

### 🔧 Supporting Stack

| Tool | Version | Purpose |
|:---|:---:|:---|
| React + TypeScript | 18 | Type-safe component-driven single-page application |
| Vite | 6 | Sub-4-second production builds with hot module replacement |
| Tailwind CSS | 3 | Consistent utility-first UI — mobile-first, tested at 390px |
| @google/genai SDK | 1.29 | Official Gemini client with `responseSchema` JSON enforcement |
| @react-google-maps/api | 2.20 | Type-safe React bindings for all Google Maps components |

### 🤝 Manus Agentic AI — Pro Credits

| Role | How Manus Is Used |
|:---|:---|
| **Agentic workflow design** | Architecting the 3-phase autonomous mission loop (Plan → Execute → Summarise) |
| **MCP strategy validation** | Evaluated and refined the 7-tool MCP registry design and tool interface contracts |
| **Chain-of-Thought prompt engineering** | Ensures the Command Agent explains reasoning step-by-step before each tool call |
| **Multi-agent scenario planning** | Modelled swarm expansion: 10, 100, and 10,000 simultaneous citizen nodes |
| **Stress-test adversarial cases** | Generated adversarial test cases to harden agent fallback logic |

### 💻 GitHub Copilot — Student Developer Pack

| Area | Contribution |
|:---|:---|
| **TypeScript type safety** | Auto-completed complex interfaces (`FloodAnalysisResult`, `SwarmNode`, `MCPTool`, `MissionLog`) |
| **Gemini pipeline boilerplate** | Accelerated REST fetch + AbortController + JSON parse patterns across 12 passes |
| **Firebase query patterns** | Correct `ref()`, `get()`, `set()`, `onValue()` patterns for all 8 RTDB paths |
| **MCP tool registry structure** | Scaffolded `MCPTool[]` registry and `getToolByName()` resolver |
| **Test case generation** | Generated adversarial edge cases across image, audio, and rejection paths |

---

## 8) Challenges Faced & Resolved

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

## 9) Installation & Setup

**Prerequisites:** Node.js v18+ · Firebase CLI (`npm install -g firebase-tools`)

```bash
git clone https://github.com/HowardWoon/BILAHUJAN-VHack2026.git
cd BILAHUJAN-VHack2026
npm install
```

Create a `.env` file in the project root:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
VITE_GOOGLE_MAPS_API_KEY=your_google_maps_key
```

> ⚠️ **Never commit `.env` to Git.** Google automatically scans public repos and **instantly revokes** any API key it detects. The `VITE_` prefix is required — Vite only exposes variables with this prefix to the browser bundle.

```bash
npm run dev
npm run build
firebase use vhack
firebase deploy --only hosting
```

```bash
firebase use vhack      # → bilahujan-vhack.web.app  ← WORK HERE
```

**🌐 V Hack Live Site:** https://bilahujan-vhack.web.app

---

## 10) Full Feature Delivery Checklist

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

## 11) Judging Criteria — Technical 

---

### 11.1 · AI Implementation Strategy & Configuration 

BILAHUJAN deploys **two Gemini models across four distinct modalities** — each independently configured for its specific emergency response task:

| Model | Modality | Config | Purpose |
|:---|:---|:---|:---|
| `gemini-2.5-flash` | REST + AbortController | `temp: 0.1` · `thinkingBudget: 0` · 35s timeout | All 12 image analysis passes |
| `gemini-2.5-flash` | SDK fallback | `temp: 0.1` · `timeout: 35s` | Image analysis fallback path |
| `gemini-2.0-flash` | SDK + Google Search grounding | `temp: 0.1` · `maxTokens: 250–1200` | Live weather · location risk |
| `gemini-2.0-flash` | SDK only | `temp: 0.1` · `maxTokens: 150–2000` | Agent planning · audio · mission summary |

**Key architectural decisions:**
- `thinkingBudget: 0` on all 12 image passes eliminates reasoning overhead — achieving sub-35-second triage critical for emergency response
- Every image pass enforces structured JSON output via `responseSchema` in `@google/genai SDK v1.29` — zero free-form text, 100% typed responses
- Temperature `0.1` across all passes ensures deterministic, reproducible severity scoring
- The Command Agent (Gemini 2.0 Flash) runs in a separate context from the image classifier — preventing cross-contamination between reasoning and visual analysis
- **Manus (Meta) Pro Credits** validated the entire agentic architecture: 3-phase mission loop, MCP tool interface contracts, and Chain-of-Thought prompt structure

**Autonomous Command Agent — 3-phase mission loop:**

```
Phase 1 — PLANNING (Gemini 2.0 Flash)
  Agent reads: zone count, active nodes, last mission timestamp
  Gemini generates: step sequence with explicit Chain-of-Thought per tool call
  Example: "Zone KL-007 has severity 8 and 3 active nodes nearby.
            I will scan it first, then dispatch an alert to NADMA."

Phase 2 — EXECUTION (MCP Tool Loop, 800ms inter-step delay)
  Each tool call streams live to the GOV terminal
  Every result persisted to Firebase missionLogs/ in real time

Phase 3 — SUMMARY (Gemini synthesis)
  Agent synthesises all tool results into a structured mission report
```

**MCP Tool Architecture — 7 standardised tools:**

| Tool | Firebase Path | Case Study 3 Analogue |
|:---|:---|:---|
| `scan_flood_zone` | Calls `analyzeFloodImage()` | `thermal_scan()` drone tool |
| `get_zone_status` | Reads `liveZones/{zoneId}` | `get_battery_status()` |
| `update_zone_severity` | Writes to `liveZones/` | `move_to(x,y)` |
| `get_active_nodes` | Reads `liveReports/` + `liveZones/` | MCP real-time tool discovery |
| `dispatch_alert` | Writes to `agentAlerts/{zoneId}` | Authority notification |
| `get_system_health` | Reads `systemHeartbeat/` | System status monitoring |
| `thermal_scan` | Haversine radius spatial search | Direct `thermal_scan()` analogue |

> The agent uses `get_active_nodes` to discover citizen nodes dynamically — satisfying Case Study 3 verbatim: *"The agent must use the MCP discovery mechanism to see which drones are active on the network."*

**FloodVision AI Pipeline — 12-pass analysis:**

| Pass | Name | Purpose |
|:---:|:---|:---|
| 1 | Guideline Classification | Reject non-flood images at the gate |
| 2 | Primary Analysis | Full 16-field structured extraction |
| 3 | False Negative Recovery | Recovery if primary rejects a real flood |
| 4 | Low-Score Reassessment | Re-evaluate score ≤ 3 for missed cues |
| 5 | Rooftop Cue Detection | Detect `bumbung rumah`, rooftop rescue |
| 6 | Severity Calibration | Physical anchor calibration |
| 7 | Scene Context | Identify normal waterbodies |
| 8 | Professional Regrade | Final reassessment if score ≤ 3 |
| 9 | Score Merge | `max(primary, calibration, formula floor)` |
| 10 | Critical Override | Rooftop cue always beats scene cap |
| 11 | Scene Context Cap | Normal waterbody → cap at NORMAL (2) |
| 12 | Guardrails + Consistency | Hard floors + anti-over-scoring |

**Image Analysis Fallback Chain:**

```
Primary:   gemini-2.5-flash REST API (35s AbortController timeout)
    ↓ [REST fails]
Secondary: gemini-2.5-flash SDK (35s withTimeout)
    ↓ [SDK returns structured .parsed]  → normalizeFloodAnalysisResult()
    ↓ [SDK returns raw text]            → parseFloodAnalysisText()
    ↓ [all fail]                        → recoverFloodFalseNegative()
                                          → enforceSeverityGuardrails()
                                          → cached and returned
```

---

### 11.2 · Data Strategy & Engineering 

BILAHUJAN implements a **5-layer data strategy** handling noise, bias, fallback, caching, and rate limiting — producing clean, trustworthy analytics from noisy citizen-generated input.

**Layer 1 — Noise filtering**
`isValidLocationName()` strips weather condition strings ("Cloudy", "Heavy Rain") that bleed into location fields. Without this, "Cloudy" would appear as a hotspot in Location Analytics.

**Layer 2 — Bias prevention**
`isNaturalSceneNoUrban` detection identifies river/canal/sea images with no flood context — preventing normal waterbodies from inflating the national severity average. `applySceneContextCap()` enforces a maximum score of 2 for these scenes.

**Layer 3 — `isRealZone()` data integrity filter**

```typescript
const isRealZone = (z: Zone): boolean =>
  z.isWeatherFallbackZone !== true &&
  z.source !== 'baseline' &&
  z.source !== 'seed' &&
  z.severity >= 2 &&
  (z.reportId != null || z.uploadedAt != null || z.source === 'user');
```

Exported from `floodCalculations.ts` and applied identically in every screen and service. Only zones passing this filter count as real incidents in GOV Dashboard, AlertsScreen, and Location Analytics.

**Layer 4 — Intelligent analysis cache**
DJB2 hash of image content → 10-minute TTL in `analysisCache/{hash}`. Cache hits with `riskScore > 3` still re-run passes 5, 7, and 10 — safety-critical cues are never served stale.

**Layer 5 — 3-tier weather fallback**
```
Tier 1: Live Gemini 2.0 Flash + Google Search (MetMalaysia, JPS, Google Weather)
Tier 2: Gemini 2.0 Flash knowledge base (no quota consumption)
Tier 3: Hardcoded 16-state seed data (100% uptime guarantee)
```

**Statistical formulas — all derived from real-time Firebase, never hardcoded:**

| Formula | Used In | Expression |
|:---|:---|:---|
| Weighted Composite Severity | Zone upload | `0.50×Gemini + 0.25×rainfall + 0.15×historical + 0.10×reportDensity` |
| State Severity | AlertsScreen | `Math.max(...realZones.filter(state))` |
| Drainage Efficiency | GOV Dashboard | `100 - (avgBlockage × affectedRatio)` |
| Avg Response Time | GOV Dashboard | `mean(dispatchedAt - firstReportedAt)` mins |
| AI Confidence | ZoneDetailScreen | `0.40×Gemini + 0.30×agreement + 0.30×historicalMatch` |
| Report Density | Zone severity | `min(10, reportsLast30min × 2)` |

**Pre-seeded ground truth:** `historicalFloodData.ts` — 28 real Malaysian flood records across all 16 states, severity 5–10.

**Rate limiting:** 4-second cooldown · 10-minute cache TTL · 3-second non-blocking Firebase lookup.

**Real-Time Location Intelligence — 3-priority normalization:**
```
Priority 1: Google Geocoding address_components (locality + admin_level_1)
Priority 2: MALAYSIA_TOWNS dictionary scan (150+ towns, all 16 states)
Priority 3: String cleaning + building name filter + postcode removal
```

Federal Territory duplicate handling:

| Territory | Problem | Solution |
|:---|:---|:---|
| Kuala Lumpur | `"Kuala Lumpur, Kuala Lumpur"` | `resolveKLDistrict()` → KL_DISTRICT_MAP (25 districts) |
| Putrajaya | `"Putrajaya, Putrajaya"` | `PUTRAJAYA_PRECINCT_MAP` (Presint 1–20) |
| Labuan | `"Labuan, Labuan"` | `LABUAN_DISTRICT_MAP` → `"Labuan Town"` |

---

### 11.3 · Model Performance & Validation 

**Physical Anchor Rubric — embedded in every Gemini prompt:**

| Score | Physical Anchor | Hard Floor Rule |
|:---:|:---|:---|
| 1–2 | Dry/damp surface · normal waterbody | River/canal/sea → cap at 2 |
| 3–4 | Ankle-deep · < 0.2m | Depth ≥ 0.2m → floor 4 |
| 5–6 | Knee-deep · 0.2–0.5m | Flooded road → floor 5 |
| 7–8 | Waist/car bonnet · 0.5–1.3m | **Car bonnet submerged → min 7** |
| 9 | Car roof / rooftop rescue · > 1.3m | **Rooftop rescue → min 9 (unbypassable)** |
| 10 | Buildings submerged · > 3m | Complete submersion → 10 |

**Dual-direction guardrails — unique to BILAHUJAN:**

```
❌ Standard AI:  Only prevents false negatives (missed floods)
✅ BILAHUJAN:   Prevents false negatives AND false positives simultaneously

Anti-false-negative: inferMinimumRiskScore() + enforceSeverityGuardrails()
Anti-false-positive: enforceProfessionalConsistency() + applySceneContextCap()
Critical override:   applyCriticalVisualOverride() — rooftop always wins
```

**Single source of truth:** All severity label functions defined once in `src/utils/floodCalculations.ts` — `severityToRiskLabel`, `severityToBadge`, `severityToAssessment`, `severityToHeroBg`, `severityToBlockage`, `severityToRainfall`, `deriveAIConfidence` — imported by every screen. Zero contradictions across the platform.

**14 Validated Test Cases:**

| Scenario | Expected | Result |
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
| Federal Territory (KL) location | "District, Kuala Lumpur" | ✅ |
| Building name as GPS location | Normalized to town/district | ✅ |
| Searched location passed to result | Searched location, not GPS | ✅ |

---

### 11.4 · System Integration 

**Fully automated 10-step citizen-to-authority pipeline:**

```
Step 1:  Citizen opens app → searches location OR uses GPS
Step 2:  SelectedLocation object created and passed through entire navigation chain
Step 3:  Gemini 2.5 Flash 12-pass image analysis triggered
Step 4:  ResultScreen: severity score, depth estimate, vehicle passability, AI directive
Step 5:  "Upload to Alert Zone" → liveZones/{zoneId} written with real Gemini score
Step 6:  Location normalized to "Town, State" via normalizeToTownState() before write
Step 7:  AlertsScreen auto-updates via Firebase onValue() — no polling, no setInterval
Step 8:  Command Agent detects new node via get_active_nodes MCP tool
Step 9:  Agent executes: scan_flood_zone → update_zone_severity → dispatch_alert
Step 10: agentAlerts/{zoneId} written → JPS / NADMA / APM notified
```

**Real-time integration architecture:**
- Firebase `onValue()` listeners on `liveZones/` in AlertsScreen, AlertDetailScreen, and GOV Dashboard — all screens reflect uploads within milliseconds
- No `setInterval` polling anywhere — pure event-driven updates
- `SelectedLocation` interface passed MapScreen → CameraScreen → ResultScreen → Firebase — searched location never replaced by device GPS
- `isRealZone()` filter applied identically in AlertsScreen, GOV Dashboard, and all analytics
- MCP tool layer provides a clean abstraction between the Gemini agent and Firebase — the agent never writes to the database directly

**Decentralised Citizen Swarm Network:**

| Status | Threshold | Agent Behaviour |
|:---:|:---|:---|
| 🟢 **ACTIVE** | Last seen < 5 minutes | Highest priority — agent scans first |
| 🟡 **IDLE** | Last seen 5–10 minutes | Secondary evidence — corroborates active nodes |
| 🔴 **OFFLINE** | Last seen > 10 minutes | Historical reference in GOV dashboard |

Network health score = `(active / total) × 100%` — displayed live.

**Government Intelligence Dashboard:**
- 📊 Key Metrics — Total incidents, avg severity, affected areas, drainage efficiency (`isRealZone()` filtered)
- 🗺️ Location Analytics — Hotspots in `"Town, State"` format, ranked by avg severity
- 🏗️ Infrastructure Insights — Critical zones ≥ 8, maintenance zones ≥ 65% blockage
- 🐝 Swarm Intelligence Panel — Live node grid, network health score
- 🤖 Command Agent Terminal — Live chain-of-thought, Run Mission, mission history
- 📡 MCP Tool Activity Feed — Last 5 tool calls from `missionLogs/`
- 📥 CSV Export — Download with timestamp filename

**Alert Menu navigation flow:**
```
AlertsScreen (16 state cards, real-time severity)
  → AlertDetailScreen (towns: ACTIVE FLOOD ZONES vs MONITORED LOCATIONS)
    → ZoneDetailScreen (hero · time · stats · Gemini AI Analysis · evacuation)
```

**Evacuation Centre Discovery — multi-tier fallback:**
```
Step 1: "dewan orang ramai" radius 10km
Step 2: "community hall" radius 15km
Step 3: "sekolah kebangsaan" radius 20km  ← official Malaysian evacuation centres
Step 4: "masjid OR surau" radius 20km     ← gazetted emergency shelters
Step 5: "Call NADMA: 03-8064 2400"        ← if all searches fail
```

---

### 11.5 · Technical Feasibility & Scalability 

**BILAHUJAN is live and operational** at [bilahujan-vhack.web.app](https://bilahujan-vhack.web.app) — every feature is verifiable right now.

**Production-grade engineering:**
- Full TypeScript across all 7 service modules — `FloodAnalysisResult`, `SwarmNode`, `MCPTool`, `MissionLog`, `SelectedLocation`, `Zone`, `AgentAlert` — all typed
- `AbortController` on every Gemini REST call — no hanging requests
- Firebase Spark (free tier) sustains the entire platform at RM 0/month
- Modular prompt versioning — each of the 12 analysis passes is independently upgradeable
- GitHub Copilot (Student Developer Pack) used throughout — enforcing consistent TypeScript patterns across 7 service files

**6-phase ASEAN scalability roadmap:**

| Phase | Feature | Technology | Scalability Impact |
|:---:|:---|:---|:---|
| 1 | Progressive Web App | Service Workers + Web Push | Push alerts without app open |
| 2 | **Full Offline Swarm Mode** | TensorFlow Lite + IndexedDB | **Zero-internet AI — works when towers fail** |
| 3 | Predictive Flood Pathing | Google Elevation API | Warn downstream before water arrives |
| 4 | Physical Drone Integration | MCP + real drone SDK | Same tool layer, real hardware |
| 5 | National Authority Command Centre | Firebase + NADMA API | Full government loop closed |
| 6 | Manus Multi-Agent Swarm | Manus + MCP + Gemini | Parallel triage/routing/logistics agents |

<<<<<<< HEAD
### 🔮 Phase 2 Deep Dive — Edge Computing & Offline-First Swarm
 
> *"Standard AI models that depend on the cloud become useless."*
> *"Build a self-healing rescue swarm that operates as a collective brain*
> *at the edge, ensuring aid reaches survivors even when the world is offline."*
>
> — V Hack 2026 Case Study 3 Booklet
 
The case study explicitly describes a **"communication blackout"** in the
critical first 72 hours where cell towers and internet suffer catastrophic
failure. BILAHUJAN's current architecture already addresses this via a
hardcoded 16-state fallback — but **Phase 2 completes the full offline vision**:
 
| Edge Component | Technology | Replaces |
|:---|:---|:---|
| On-device flood image analysis | TensorFlow Lite (quantized model) | Gemini 2.5 Flash REST calls |
| Local zone state storage | IndexedDB + Service Workers | Firebase RTDB cloud sync |
| Offline swarm node registry | Local-first CRDTs | Firebase `sensorNodes/` |
| Agent mission planning | On-device quantized LLM | Gemini 2.0 Flash SDK |
| Background sync on reconnect | Web Background Sync API | Real-time `onValue()` listeners |
 
**Why BILAHUJAN is already architected for this transition:**
 
The 7 MCP tools (`scan_flood_zone`, `get_active_nodes`, `dispatch_alert`
etc.) are fully abstracted from their transport layer. Swapping Firebase
RTDB for IndexedDB requires **only changing the tool implementations —
not the agent logic**. The Command Agent continues orchestrating the
swarm identically, whether online or offline.
 
**Offline-first citizen flow:**
 
```
Citizen smartphone (zero internet)
  → TensorFlow Lite analyzes flood image locally (< 2s)
  → IndexedDB stores zone severity + location
  → Service Worker queues report for background sync
  → Swarm node marked ACTIVE locally
  → When connectivity returns (even 2G):
      → Firebase RTDB synced automatically
      → Command Agent picks up new citizen nodes
      → Authorities notified via dispatch_alert
      → Mission log persisted to missionLogs/
```
 
This directly satisfies the Case Study 3 mandatory requirement:
**a self-healing swarm that operates as a collective brain at the edge —
functioning even when the world is offline.**

=======
>>>>>>> a23f781df4332d959cf1e4ac0d9d341a00391702
> **Phase 2 is the most critical:** on-device TensorFlow Lite makes BILAHUJAN operational with zero internet — exactly when it is most needed.

**Why it scales:** The citizen-as-sensor model grows with every user — no hardware, no sensor deployment, no capex. 1,000 simultaneous reports = 1,000 active swarm nodes, handled by the same Firebase RTDB architecture live today.

---

## 12) Judging Criteria — Business 

---

### 12.1 · Market Potential & Demand 

**Segment 1 — Government & Emergency Response (B2G)**
- 160+ local councils in Malaysia with no unified real-time flood intelligence
- NADMA, JPS, APM, BOMBA all operate from fragmented data today
- BILAHUJAN provides what no existing system offers: AI-triaged citizen reports automatically escalated to the right authority in under 60 seconds

**Segment 2 — Insurance & Financial Services (B2B)**
- Malaysia's flood insurance market: RM 5B+ annually
- Current pricing relies on postcode-level historical data updated yearly
- BILAHUJAN provides real-time, street-level severity scores — enabling dynamic premium adjustment and faster claims validation

**Segment 3 — Citizens (B2C / Civic)**
- 32M Malaysians, 200,000+ displaced annually
- Zero competing apps offer AI-verified flood severity + real-time evacuation routing in one platform
- Network effect: more users → more swarm nodes → better coverage → more users

**ASEAN expansion:** Same architecture applies directly to Indonesia (floods), Philippines (typhoons), Thailand (seasonal flooding) — identical infrastructure, different geographic seed data.

---

### 12.2 · Impact & Social Value 

**SDG 9 — Target 9.1: Resilient Infrastructure**
The decentralised swarm architecture survives the exact failure scenario in Case Study 3. When cell towers fail and cloud systems go offline, BILAHUJAN's hardcoded 16-state fallback and local Firebase RTDB cache keep the platform operational. Citizens continue reporting, the agent continues processing, authorities continue receiving alerts — during the blackout window.

**SDG 9 — Target 9.5: Innovation & Research**
The 12-pass Gemini pipeline, dual-direction guardrails, and MCP-based swarm architecture represent genuine civic R&D — applying frontier AI to a public safety problem that traditional sensor infrastructure cannot solve affordably. The weighted composite severity formula mirrors JPS and FEMA professional flood risk engineering methodology, applied at citizen scale for the first time.

**SDG 3 — Target 3.d: Health Security & Early Warning**
`detectCriticalRooftopCueViaRest()` — Pass 5 — specifically detects Malay-language cues (`bumbung rumah`, `atas bumbung`) and visual rooftop stranding. When detected, severity is forced to ≥ 9 (unbypassable) and `dispatch_alert` triggers immediately, notifying BOMBA and NADMA before the citizen completes their report. This is the difference between a warning system and a rescue trigger.

**Malay-language inclusion:** All Gemini prompts include Malay flood terminology — ensuring the system works for rural Malaysians reporting in Bahasa Malaysia.

---

### 12.3 · Sustainability 

**Cost sustainability:**
- Firebase Spark (free tier): RM 0/month — handles all RTDB, Firestore, and CDN hosting at current scale
- Gemini API: pay-per-use, only triggered by real citizen uploads — no background polling costs
- Google Maps Platform: free tier covers MVP usage
- No servers, no DevOps, no infrastructure team required

**Model sustainability:**
- Zero model retraining required — Gemini 2.5 Flash and 2.0 Flash are Google-maintained
- Prompt versioning: each of the 12 analysis passes is an independently upgradeable function
- `historicalFloodData.ts` grows with every real flood event — historical risk score improves over time

**Operational sustainability:**
- The Command Agent runs autonomously — no human operator needed
- `systemHeartbeat` updates every 60 seconds — self-monitoring with automatic Firebase persistence
- Hardcoded 16-state fallback guarantees 100% uptime even when all external APIs fail simultaneously

---

### 12.4 · Innovation & Creativity 

**Innovation 1 — Citizens as Drones**
Case Study 3 uses physical drones as sensor nodes. BILAHUJAN reframes 32 million Malaysian smartphones as the fleet — same swarm coverage, zero hardware cost, zero deployment time, infinite scalability. Every citizen report is a typed `SwarmNode` discoverable by the Command Agent via MCP — no precedent in existing Malaysian flood apps.

**Innovation 2 — Physical Anchor Severity Scoring**
Standard flood AI outputs generic labels ("low/medium/high"). BILAHUJAN anchors every score to a physical object visible in the image — car bonnet, car roof, rooftop — with unbypassable hard floor rules. This mirrors JPS and FEMA methodology, applied to citizen-submitted images for the first time.

**Innovation 3 — Dual-Direction Guardrails**
Every existing flood AI protects against one failure mode. BILAHUJAN protects against both: `applySceneContextCap()` prevents over-scoring normal waterbodies while `applyCriticalVisualOverride()` ensures rooftop rescue is never missed. Architecturally unique.

**Innovation 4 — `isRealZone()` Data Integrity Layer**
A single exported function enforcing data integrity across every screen, service, and analytics calculation — preventing pre-seeded baseline zones from ever inflating incident counts or severity averages.

**Innovation 5 — MCP as Emergency Response Standard**
BILAHUJAN applies the Model Context Protocol to emergency response: 7 standardised tools, a typed `MCPTool[]` registry, `getToolByName()` resolver. The Gemini agent discovers and executes tools at runtime with no hardcoded logic — the same architecture that physical drone fleets and IoT sensor arrays would use in a production emergency system.

---

## 13) Commercial Viability

| Buyer | What They Receive | Why It Has Value |
|:---|:---|:---|
| 🏛️ Government (JPS, NADMA, APM) | Verified real-time intelligence · time-series zone exports | Emergency preparedness and resource allocation |
| 🏦 Insurance Companies | Flood risk scores by postcode · historical incident frequency | Dynamic premium calculation and faster claims |
| 🏗️ Property Developers | Zone heatmaps · drainage performance scores | Site selection, risk disclosure, infrastructure planning |
| 🏙️ Urban Planners & Councils | Drainage efficiency · critical zones · historical trends | Infrastructure investment prioritisation |
| 🔬 Academic & Research | Anonymized hydrology datasets | Publication-quality data at a fraction of sensor cost |

```
Every citizen report simultaneously:
    improves public safety  AND  grows the commercial data asset
                    ↑________________________↑
                         compounds with every new user
```

---

## 14) Acknowledgements

- **V Hack 2026 & Universiti Sains Malaysia** — for the platform and the opportunity
- **Google** — for Gemini, Firebase, Google Maps Platform, and the @google/genai SDK
- **Manus (from Meta)** — for Pro Credits that powered the agentic architecture design, MCP validation, and adversarial stress-testing
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
