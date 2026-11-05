# Civic Tracker — Hindi-English Translation Audit

**Date:** 5 November 2026 (UTC)  
**Environment:** local preview, http://localhost:8080; existing backend read-only. Changes are not published.

## Outcome
**PARTIAL overall.** Fixed interface coverage and switching improved substantially; complete authenticated and dynamic-generated translation coverage is not yet verified. No account, role, database, policy, authentication or stored complaint changes were made in this audit.

## Issues and fixes
- Hardcoded English and disconnected page labels: added a local exact-match Hindi dictionary and reusable language hook across citizen, staff and shared controls. English mode preserves original labels.
- Controlled statuses, categories, priorities, common department/city names, validation messages, dialogs, chart labels, voice controls and accessible labels now follow the language context. Stored values and original citizen content remain unchanged.
- Language initialization could disagree during server/client rendering: consistent English initial render, restore saved preference after mounting, memoized provider value.
- Map and heatmap initially failed from browser-only imports: lazy client rendering and deferred heat plugin loading corrected observed page errors. These are presentation-loading changes only.
- No translation service calls or dependencies introduced. Switching uses in-memory dictionaries without a page reload.

## Browser evidence
35 requested paths × 3 viewports = **105 render checks: 105 PASS / 0 FAIL**; includes existing redirects and signed-out access screens, not authenticated feature PASS results.
Hindi persistence across navigation and refresh: **105/105 PASS**. Horizontal overflow: **0/105**. Browser page exceptions: **0**.
Viewports: desktop 1280×1800, tablet 768×1024, mobile 390×844. Both language screenshots were captured for each path (210 after images), with genuine earlier before images.

| Requested path | Coverage |
|---|---|
| `/` | PASS — rendered language controls |
| `/complaints` | PASS — rendered language controls |
| `/departments` | PASS — rendered language controls |
| `/dashboard` | PASS — rendered language controls |
| `/polls` | PASS — rendered language controls |
| `/map` | PASS — rendered language controls |
| `/heatmap` | PASS — rendered language controls |
| `/leaderboard` | PASS — rendered language controls |
| `/auth` | PASS — rendered language controls |
| `/privacy` | PASS — rendered language controls |
| `/faq` | PASS — rendered language controls |
| `/contact` | PASS — rendered language controls |
| `/how-it-works` | PASS — rendered language controls |
| `/install` | PASS — rendered language controls |
| `/request-admin` | PASS — rendered language controls |
| `/worker` | PARTIAL — signed-out gate |
| `/admin` | PARTIAL — signed-out gate |
| `/admin/wards` | PARTIAL — signed-out gate |
| `/admin/workers` | PARTIAL — signed-out gate |
| `/admin/polls` | PARTIAL — signed-out gate |
| `/admin/users` | PARTIAL — signed-out gate |
| `/admin/whatsapp` | PARTIAL — signed-out gate |
| `/admin/sms` | PARTIAL — signed-out gate |
| `/admin/root` | PARTIAL — signed-out gate |
| `/admin/posters` | PARTIAL — signed-out gate |
| `/reports` | PARTIAL — signed-out gate |
| `/rewards` | PASS — rendered language controls |
| `/ai-chat` | PASS — rendered language controls |
| `/ai-chatbot` | PASS — rendered language controls |
| `/predictions` | PASS — rendered language controls |
| `/profile` | PARTIAL — signed-out gate |
| `/reset-password` | PASS — rendered language controls |
| `/complaints/CT-14` | PASS — rendered language controls |
| `/complaints/CT-142` | PASS — rendered language controls |
| `/complaints/CT-14/poster` | PASS — rendered language controls |

## Switching measurements
Actual visible header-switch clicks, measured until the document language and brand label updated plus two animation frames: **198 samples**, median **51.1 ms**, maximum **404.5 ms**. This measures local preview switching, not every asynchronous dashboard element or published-site performance. No supported claim of zero flicker on cold refresh: preference restoration occurs after mounting.

## Regression results
Local unit tests: **13 PASS / 0 FAIL** across language preference (2), accountability (4), reliable AI (3), ward import (3), app routing (1). Latest observed preview compilation: OK. Production-mutating end-to-end suites were intentionally not run.

## Limitations and truthful status
- **PARTIAL:** staff and profile content beyond signed-out gates; this run did not use the real Super Admin or temporary-account sessions.
- **PARTIAL:** free-form AI responses/summaries and database notification title/body remain original; they were not translated by invented results or additional API calls. Their fixed surrounding interface is localized.
- **PARTIAL:** newly created or custom department, city, ward and zone names use original text when no known dictionary match exists. Citizen descriptions, names, addresses, comments and poll questions are intentionally preserved.
- **NOT TESTED:** real microphone/photo AI calls, authenticated assignment dialogs, private notifications and live tracking states in both languages.
- **NOT TESTED:** published-site timing after these edits; no publishing performed.
- Brand/service acronyms, file formats, map attribution and technical setup identifiers can remain English. Therefore the request's blanket “no application-generated English anywhere” requirement is not claimed complete.

## Evidence and changed files
Screenshots: `docs/translation-evidence/`; raw browser results: `docs/translation-evidence/results.json`.
All touched frontend files are listed below; no migrations or backend files were changed for this audit.

- `src/components/AccountabilityScores.tsx`
- `src/components/AdminRequestForm.tsx`
- `src/components/AdminRequestsManager.tsx`
- `src/components/BeforeAfterSlider.tsx`
- `src/components/CityOnboarding.tsx`
- `src/components/CommentThread.tsx`
- `src/components/ComplaintAssignmentPanel.tsx`
- `src/components/DuplicateMergePanel.tsx`
- `src/components/Footer.tsx`
- `src/components/HomeCityCard.tsx`
- `src/components/LiveTrackingMap.tsx`
- `src/components/LocationMapPicker.tsx`
- `src/components/MapThumbnail.tsx`
- `src/components/Navbar.tsx`
- `src/components/NotificationBell.tsx`
- `src/components/PermissionPrompt.tsx`
- `src/components/PosterSheet.tsx`
- `src/components/PrintDownloadMenu.tsx`
- `src/components/SatisfactionRating.tsx`
- `src/components/SmsOptInCard.tsx`
- `src/components/SocialShare.tsx`
- `src/components/UpvoteButton.tsx`
- `src/components/VerifyButton.tsx`
- `src/components/VoiceDictate.tsx`
- `src/components/VoiceInput.tsx`
- `src/components/WardConfigTools.tsx`
- `src/components/WardPreview.tsx`
- `src/components/pages/AIChatbot.tsx`
- `src/components/pages/Admin.tsx`
- `src/components/pages/AdminPolls.tsx`
- `src/components/pages/AdminPosters.tsx`
- `src/components/pages/AdminSMS.tsx`
- `src/components/pages/AdminUsers.tsx`
- `src/components/pages/AdminWorkers.tsx`
- `src/components/pages/Auth.tsx`
- `src/components/pages/ComplaintDetail.tsx`
- `src/components/pages/ComplaintPoster.tsx`
- `src/components/pages/Complaints.tsx`
- `src/components/pages/Departments.tsx`
- `src/components/pages/Heatmap.tsx`
- `src/components/pages/HowItWorks.tsx`
- `src/components/pages/Index.tsx`
- `src/components/pages/Leaderboard.tsx`
- `src/components/pages/MapView.tsx`
- `src/components/pages/Polls.tsx`
- `src/components/pages/Profile.tsx`
- `src/components/pages/ResetPassword.tsx`
- `src/components/pages/RewardsStore.tsx`
- `src/components/pages/SuperAdminDashboard.tsx`
- `src/components/pages/WhatsAppSetup.tsx`
- `src/routes/admin.wards.tsx`
- `src/routes/privacy.tsx`
- `src/routes/worker.tsx`

Additional language system/map-loading changes: `src/contexts/LanguageContext.tsx`, `src/lib/ui-translations.ts`, `src/hooks/useUiText.ts`, `src/routes/__root.tsx`, `src/routes/map.tsx`, `src/routes/heatmap.tsx`, `src/test/language-preference.test.tsx`.
