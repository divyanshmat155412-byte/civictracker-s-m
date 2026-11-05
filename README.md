# Civic Tracker

**AI-Powered Citizen-to-Resolution Platform**
Report. Resolve. Renew.

Civic Tracker is a mobile-first, multilingual web platform where citizens report civic problems (garbage, broken roads, waterlogging, streetlights and more) by text, photo or voice, and city officials resolve them in public view. Google Gemini reads every request, suggests the category and priority, answers questions in the citizen's language, and turns the data into hotspots, trend forecasts and reports for planners.

- **Live prototype:** https://civictracker1.lovable.app
- **Hackathon track:** Problem Statement 01, AI for Digital Public Infrastructure & Governance (Theme: Innovation)

---

## Built with Google AI

Google AI is the core of Civic Tracker, not an add-on. **Google Gemini powers 9 server functions** across the citizen, official and planner experience, and **Google Sign-In** gives citizens one-tap access.

| Google technology | Where it is used in Civic Tracker | What it does |
|---|---|---|
| **Gemini 3 Flash (preview)** | `civic-chat`, AI Chat page | Civic AI assistant. Answers questions from live complaint data and replies in the citizen's language (English, Hindi, Marathi, Tamil, Bengali, Telugu, Gujarati, Punjabi) |
| **Gemini 2.5 Flash** | `analyze-image`, complaint form | Looks at the uploaded photo and suggests the complaint category |
| **Gemini 2.5 Flash-Lite** | `generate-summary`, after submission | Writes a short summary and raises the priority when the issue is serious |
| **Gemini 2.5 Flash-Lite** | `analyze-sentiment` | Scores the tone and urgency of the complaint text |
| **Gemini 2.5 Flash** | `voice-stt` | Turns spoken complaints into text, including Hindi and Hinglish, exactly as spoken |
| **Gemini 2.5 Flash** | `voice-transcribe` | Translates a spoken complaint into English and suggests its title, category and priority |
| **Gemini 2.5 Flash** | `predict-trends`, Predictions page | Forecasts complaint trends for the next two weeks by area and category, in English or Hindi |
| **Gemini 2.5 Flash-Lite** | `generate-admin-report`, Reports page | Writes the AI insight summary in weekly and monthly admin reports |
| **Gemini 2.5 Flash** | `whatsapp-webhook` (test mode) | Turns a WhatsApp message into a structured complaint |
| **Google Sign-In** | Login page, "Continue with Google" | One-tap sign-in for citizens, no new password needed |

**How Gemini is used:** every Gemini call runs on the server, never in the browser, through the Lovable AI Gateway. Gemini uses function calling to return structured fields (category, priority, summary, sentiment, trend), so its output is saved directly in the database and drives the map, dashboard and reports.

Maps in this build use Leaflet with OpenStreetMap data. Google Maps, Firebase and Google Cloud Vision are not used yet.

---

## Table of contents

1. [The problem](#the-problem)
2. [What Civic Tracker does](#what-civic-tracker-does)
3. [Feature status](#feature-status)
4. [Architecture](#architecture)
5. [Tech stack](#tech-stack)
6. [Project structure](#project-structure)
7. [Getting started](#getting-started)
8. [Configuration](#configuration)
9. [Database](#database)
10. [Server functions](#server-functions)
11. [Scaling across India and BRICS](#scaling-across-india-and-brics)
12. [Roadmap](#roadmap)
13. [Security and privacy](#security-and-privacy)
14. [Open-source credits](#open-source-credits)
15. [License](#license)

---

## The problem

Citizen feedback in India is spread across many systems. Central grievances go to CPGRAMS, states run their own portals, and local issues such as garbage, roads and drains go to separate city channels. Citizens do not know if anyone is working on their complaint, and governments cannot see where the real demand is. As a result, infrastructure gaps stay hidden and public spending is hard to match with real needs.

## What Civic Tracker does

**For citizens**
- Report a problem in under a minute with a photo, automatic GPS location (or a map picker), category and priority.
- Speak the complaint instead of typing.
- Get a unique public ID (for example `CT-07`) and track the status live, with a 48-hour countdown and a timeline of every update.
- Ask the Civic AI assistant questions in eight Indian languages.
- Report anonymously when needed. Only the name is hidden.
- Comment, upvote, verify ("I have seen this too"), share and rate the resolution.
- Earn green points and badges from Bronze to Diamond.

**For city officials**
- City-scoped admin panel: each admin manages the complaints of their own city. The database enforces this with row-level security.
- Change status (Pending, In Progress, Resolved, Escalated), add admin notes and upload a resolution photo as proof. Citizens see a before and after comparison.
- Filter by status and city, print complaint posters, export CSV and PDF.
- Create community polls, manage departments, and generate weekly or monthly AI reports.
- New officials request admin access. The main admin approves the request, grants the role for one city, and can remove it at any time.

**For planners**
- Complaint map with clusters, markers, heatmap and area statistics.
- Hotspot page with time range, city and category filters and the worst areas.
- Public analytics dashboard: totals, resolution rate, average resolution time, monthly trend, and breakdowns by category, area and priority.
- Gemini trend forecast for the next two weeks by area and category.

## Feature status

| Status | Features |
|---|---|
| **Working** | Sign in (email and Google), complaint submission with photo and GPS, map picker, unique IDs, anonymous reporting, priority levels, public tracking and timeline, comments, upvotes, verification, sharing, rating, notification bell, complaint map (clusters, markers, heatmap, area stats), hotspot page, public dashboard, all Gemini features listed above, Hindi interface, 8-language AI chat, city-scoped admin panel, status updates with proof photo, admin access requests and role management, polls, AI admin reports, CSV and PDF export, posters with QR codes, green points, badges, leaderboard, installable web app |
| **Partly working** | 48-hour rule (countdown is shown, escalation is set manually by an admin), browser notifications (only while the app is open), Hindi translation (main screens only), departments (in progress), rewards store and achievements (built, but no items configured yet), installable app (no offline mode yet) |
| **Needs external setup** | SMS updates (need Twilio keys, simulated until then), WhatsApp intake (needs a Twilio or Meta business number, works in the built-in test simulator), email reports (need an email domain, not built yet) |
| **Simulated** | Field worker live tracking (demo movement only, workers do not log in yet) |

## Architecture

```mermaid
flowchart TD
    A[Citizen or official on a phone browser] --> B[React web app, installable PWA]
    B --> C[Server functions: src/routes/api/public/fn]
    C --> G[Google Gemini via Lovable AI Gateway]
    B --> D[Supabase]
    C --> D
    D --> D1[(Postgres with row-level security)]
    D --> D2[Auth: email and Google Sign-In]
    D --> D3[Storage: complaint photos]
    D --> D4[Realtime: live status updates]
    B --> M[Leaflet maps with OpenStreetMap tiles and geocoding]
```

Every change is saved in one database and pushed live to all open screens, so the public feed, the map, the dashboard and the AI forecasts all use the same data.

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | React 19, TypeScript 5, TanStack Start and TanStack Router, Vite 8 |
| UI | Tailwind CSS 4, shadcn/ui (Radix UI), lucide-react, framer-motion, sonner |
| Data fetching | TanStack Query 5 |
| Maps | Leaflet 1.9, react-leaflet 5, leaflet.markercluster, leaflet.heat, OpenStreetMap |
| Charts | Recharts 2 |
| Backend | Supabase (Postgres, Auth, Storage, Realtime), hosted on Lovable Cloud |
| Server logic | TanStack Start server routes in `src/routes/api/public/fn` |
| AI | Google Gemini through the Lovable AI Gateway |

## Project structure

```
.
├── public/                        Static files, PWA manifest and icons
├── src/
│   ├── components/                Reusable UI (map picker, voice input, notification bell, before/after slider, ...)
│   │   └── pages/                 Screen components (Home, Complaints, Map, Admin, Reports, AI Chat, ...)
│   ├── contexts/                  Auth and language providers
│   ├── hooks/                     Data and role hooks
│   ├── integrations/              Supabase client and Google Sign-In integration
│   ├── lib/                       Helpers (translations, cities, geocoding, export, main admin config)
│   └── routes/                    App routes
│       └── api/public/fn/         Server functions (Gemini features, SMS, WhatsApp webhook, worker simulation)
├── supabase/
│   └── migrations/                Database schema, policies and triggers
├── .env.example                   Environment variables template
└── README.md
```

## Getting started

### Prerequisites

- Node.js 20 or newer, and Bun or npm
- A Supabase project (or Lovable Cloud)
- A Lovable AI Gateway key for the Gemini features

### Run locally

```bash
git clone <this-repository-url>
cd civic-tracker
bun install          # or: npm install
cp .env.example .env # then fill in your own values
bun run dev          # or: npm run dev
```

Other scripts:

```bash
bun run build     # production build
bun run preview   # preview the production build
bun run lint      # lint the code
bun run format    # format the code
```

### Set up the database

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

Before running the migrations, replace the placeholder `main-admin@example.com` in `supabase/migrations` with the email of your own main admin. See [Configuration](#configuration).

## Configuration

All values go in `.env` (copy it from `.env.example`). Never commit the real `.env` file.

| Variable | Where it is used | Purpose |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | URL of your Supabase project |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser | Public (anon) key of your Supabase project |
| `VITE_SUPABASE_PROJECT_ID` | Browser | Supabase project ID |
| `VITE_MAIN_ADMIN_EMAIL` | Browser | Email of the main admin, used to show main admin screens |
| `SUPABASE_URL` | Server only | Supabase URL for server functions |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Service key for server functions. Keep it secret |
| `LOVABLE_API_KEY` | Server only | Access to Google Gemini through the Lovable AI Gateway |
| `MAIN_ADMIN_EMAIL` | Server only | Email of the main admin, checked by server functions |
| `TWILIO_API_KEY`, `TWILIO_FROM_NUMBER` | Server only | Optional, for real SMS delivery |

The main admin email is never hard-coded in the source code. The database functions in `supabase/migrations` contain the placeholder `main-admin@example.com`; replace it with your own main admin email before running them.

## Database

Main tables: `complaints`, `profiles`, `user_roles`, `admin_requests`, `complaint_timeline`, `complaint_comments`, `complaint_upvotes`, `complaint_verifications`, `complaint_ratings`, `departments`, `workers`, `worker_assignments`, `worker_locations`, `notifications`, `polls`, `poll_options`, `poll_votes`, `rewards`, `reward_redemptions`, `achievements`, `user_achievements`, `sla_config`, `sms_log`, `audit_logs`.

Key rules, enforced with row-level security:
- Anyone can read complaints, so every complaint is public.
- Only signed-in users can create complaints.
- City admins can update or delete complaints of their own city only.
- Only the main admin can grant or remove admin roles.

Triggers create the complaint ID, award green points, update badges and send notifications on new complaints and status changes.

## Server functions

All server functions live in `src/routes/api/public/fn` and run on the server.

| Function | Purpose |
|---|---|
| `civic-chat` | Civic AI chat assistant (Gemini) |
| `analyze-image` | Category suggestion from the complaint photo (Gemini) |
| `generate-summary` | AI summary and priority check (Gemini) |
| `analyze-sentiment` | Sentiment and urgency score (Gemini) |
| `voice-stt` | Speech to text (Gemini) |
| `voice-transcribe` | Voice complaint translation and structuring (Gemini) |
| `predict-trends` | Two-week trend forecast (Gemini) |
| `generate-admin-report` | Weekly or monthly admin report with AI insights (Gemini) |
| `whatsapp-webhook` | Turns WhatsApp messages into complaints (Gemini, test mode) |
| `send-sms` | Sends SMS updates through Twilio (needs keys) |
| `simulate-worker-movement` | Demo movement for field worker tracking |

## Scaling across India and BRICS

- **Across states:** add a city and give it a city admin. OpenStreetMap already covers all of India, and Gemini handles new languages without retraining.
- **Across BRICS countries:** maps and Gemini work worldwide. A new country needs its city list, interface text and local departments.
- **As a Digital Public Good:** open-source licence, documentation, open map data, privacy rules and anonymous reporting.

## Roadmap

- Policy Insights: join complaint hotspots with open data such as Census population and infrastructure indices, so Gemini can rank development projects for policymakers.
- Automatic escalation after 48 hours.
- Field worker app with real GPS tracking.
- Server push notifications and offline support.
- More Indian languages in the interface.

## Security and privacy

- Row-level security on every table.
- User data (accounts, complaints, photos, locations, comments) lives only in the database and storage, never in this repository.
- Phone numbers and WhatsApp numbers are column-restricted and never shown publicly.
- Anonymous reporting hides the reporter's name.
- API keys and service keys stay on the server and are read from environment variables.
- See [SECURITY.md](SECURITY.md) to report a security issue.

## Open-source credits

Civic Tracker is built on these open-source projects. All are used under their own licences. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

- React, TanStack Start, TanStack Router, TanStack Query, Vite, TypeScript, Tailwind CSS, shadcn/ui, Radix UI, lucide-react, framer-motion, sonner
- Leaflet, react-leaflet, Leaflet.markercluster, Leaflet.heat
- Map data from OpenStreetMap contributors (ODbL)
- Recharts, qrcode.react
- Supabase client libraries

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE).
