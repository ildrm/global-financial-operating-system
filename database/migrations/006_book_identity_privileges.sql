-- Ordinary financial commands only increment the book version. They cannot
-- relabel its identity/currency and reinterpret already-posted monetary facts.
REVOKE UPDATE ON workspace.entities FROM gfos_app;
GRANT UPDATE(version) ON workspace.entities TO gfos_app;
