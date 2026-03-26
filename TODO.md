# Maintenance App — TODO (March 26, 2026)

## Low Priority (from code audit)
- [ ] **Form validation improvements** — Inspection/Repair forms only require technician name; signatures and other fields can be submitted empty
- [ ] **Disable form inputs while saving** — Prevent double-submit on inspection/repair forms
- [ ] **Accessibility pass** — Add aria-labels to stat cards, SVG icons, and interactive elements

## Pending (from CLAUDE.md)
- [ ] **Operating Procedures links** — Need Google Drive links for Shipping, Receiving, Event Days, Tram Rodeo (currently show "Coming soon" in DocsPage)
- [ ] **QR codes** — Print and label the fleet (TRAM-01 through TRAM-32, ADA-01, ADA-02)

## Nice to Have
- [ ] **Code splitting** — Build warns about 823KB bundle; lazy-load InspectionForm/RepairForm/ScanPage to cut initial load
- [ ] **Unused Supabase indexes** — 8 indexes flagged as unused; fine for now but revisit once app has more traffic

## Completed Tonight (March 25)
- [x] Moved static docs (technical drawings, wiring diagram, tow vehicles, trailer loading) from Google Drive to Supabase Storage
- [x] Added PWA offline caching for storage docs (CacheFirst, 30-day)
- [x] Reorganized DocsPage — Technical Documents accordion with all 4 PDFs
- [x] Cleaned up HomePage — removed inline doc buttons
- [x] Fixed oversized submit buttons on inspection/repair forms
- [x] Added status_changes table to schema.sql
- [x] Added equipment DELETE deny RLS policy
- [x] Removed console.log from production, added proper error logging
- [x] Fixed useEffect race conditions in HomePage/EquipmentPage
- [x] Extracted hardcoded Supabase project ID to env variable
