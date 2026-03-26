# Maintenance App — TODO (Updated March 26, 2026)

## Pending
- [ ] **Operating Procedures links** — Need Google Drive links for Shipping, Receiving, Event Days, Tram Rodeo (currently show "Coming soon" in DocsPage)
- [ ] **QR codes** — Print and label the fleet (TRAM-01 through TRAM-32, ADA-01, ADA-02)

## Nice to Have
- [ ] **Code splitting** — Build warns about 823KB bundle; lazy-load InspectionForm/RepairForm/ScanPage to cut initial load
- [ ] **Unused Supabase indexes** — 8 indexes flagged as unused; fine for now but revisit once app has more traffic

## Completed — March 26 (Session 3)
- [x] Accessibility pass — aria-hidden on decorative SVGs/emojis, role=button + tabIndex + keyboard Enter on all interactive divs, role=alert on form error banners, aria-expanded on accordions/toggles, tablist/tab roles on filter tabs, aria-labels on stat cards + camera feed + search input
- [x] Security audit — tightened RLS policies (status_changes INSERT enforces changed_by=auth.uid(), equipment UPDATE policy, maintenance_records UPDATE for voiding), updated schema.sql to match live DB
- [x] Disable form inputs while saving — prevent double-submit on forms

## Completed — March 26 (Session 2)
- [x] Form validation — strict on InspectionForm (tech name, date, RO#, signature, at least one item), light on RepairForm (tech name, signature, one section)
- [x] Inline error banners replacing alert(), red border highlights on invalid fields
- [x] try/catch error handling on form submit (no more stuck "Saving..." state)
- [x] RO# auto-formatting to RO-XXXXX pattern on both forms
- [x] Maintenance history timeline — INSPECTION/REPAIR badges on record cards, RO# displayed
- [x] Status change audit trail — compact "living" group cards that reflect current state, tap to expand full history
- [x] Stat cards now link to fleet equipment list filtered by status (not empty records)
- [x] Color-coded filter tabs on RecordsPage (green/red/orange matching status)
- [x] Records filtered by equipment's CURRENT status, not record's status at submission
- [x] Void record workflow — any user can void with reason, voided records in collapsible section
- [x] Retired Trams 14 & 15 — excluded from counts, no service buttons, "See ADA Trams" note
- [x] Fuzzy/partial search on scan page — returns multiple results for selection
- [x] Status change cards show changed-by user name
- [x] Icons on homepage nav buttons (clipboard for records, document for docs)
- [x] Unified card design across timeline, then evolved to compact living status cards
- [x] Fixed QR camera not triggering on mobile (race condition with DOM rendering)
- [x] Fleet equipment list sorted: ADA trams first, then numeric order

## Completed — March 25 (Session 1)
- [x] Moved static docs from Google Drive to Supabase Storage with offline caching
- [x] Reorganized DocsPage — Technical Documents accordion with all 4 PDFs
- [x] Cleaned up HomePage — removed inline doc buttons
- [x] Fixed oversized submit buttons on inspection/repair forms
- [x] Code quality & security cleanup — RLS policies, console.log removal, race conditions, env vars
