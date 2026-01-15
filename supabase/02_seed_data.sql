-- =============================================
-- PrimeStrideAI KMS - Seed Data
-- =============================================
-- Run this SQL AFTER 01_schema.sql to add your initial documents
-- Replace PASTE_GOOGLE_DOC_URL_HERE with your actual Google Doc URLs
-- =============================================

-- Insert your 3 initial documents
-- IMPORTANT: Replace the placeholder URLs with your actual Google Doc share links
-- Make sure the Google Docs are shared with "Anyone with the link can view"

insert into public.documents (doc_id, title, google_doc_url, current_version)
values
  ('PS-DIAG-001', 'Diagnostic → Problem Framing', 'https://docs.google.com/document/d/1lBFxbR7zvJ0PzH_l-b6VGjLCivfiTy4-UtPx0GcRlmc/edit?tab=t.0#heading=h.3dlwbi67jtlu', 'v1.1'),
  ('PS-PITCH-001', 'Pitch Narrative', 'https://docs.google.com/document/d/1NAMQK8YzGC42IcA2CSZ6Q3NwET8ctSnBU3YZlJWBeWc/edit?tab=t.0#heading=h.gzmxa5t9ihd6', 'v1.1'),
  ('PS-ENGAGE-001', '3-Step Client Engagement Flow', 'https://docs.google.com/document/d/1CMtsMIY3eQI7B6bQGd-wg_TD4fPyhEtOFLvW8wflEzA/edit?tab=t.0#heading=h.yfx45f1jm1ko', 'v1.1')
on conflict (doc_id) do nothing;

-- Insert version history for tracking changes
insert into public.doc_versions (doc_id, version, change_summary, hypothesis)
values
  ('PS-DIAG-001', 'v1.1', 'Expanded scope + added analytics clarification', 'Reduce confusion about BI/analytics'),
  ('PS-PITCH-001', 'v1.1', 'Expanded pitch to include AI ecosystem creation', 'Reduce "only for AI-mature clients" confusion'),
  ('PS-ENGAGE-001', 'v1.1', 'Updated flow to include clients without AI + ecosystem design', 'Improve clarity across AI maturity levels')
on conflict (doc_id, version) do nothing;

-- =============================================
-- Sample feedback data (optional - for testing)
-- =============================================
-- Uncomment the lines below to add test feedback data

-- insert into public.events (user_email, doc_id, version, event_type, value, notes)
-- values
--   ('test@example.com', 'PS-DIAG-001', 'v1.1', 'feedback', 'helped', 'Clear explanation of the diagnostic process'),
--   ('test@example.com', 'PS-PITCH-001', 'v1.1', 'feedback', 'not_confident', 'Not sure about the AI ecosystem section'),
--   ('test@example.com', 'PS-ENGAGE-001', 'v1.1', 'feedback', 'helped', NULL);
