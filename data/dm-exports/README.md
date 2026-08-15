# Archived DealMachine export evidence

This directory is retained only to preserve historical source, prospect, outreach,
and audit evidence created before the native API migration.

- Do not place new DealMachine exports here.
- No watcher, webhook, cron route, browser automation, or CSV ingestion job reads
  this directory.
- Do not delete historical files during routine cleanup; retention decisions must
  follow the data-governance policy.
- New DealMachine records must enter through the server-only native API adapter,
  use provider IDs for deduplication, retain source provenance, and pass
  suppression/consent gates before outreach.

The native adapter remains inactive until a verified `DEALMACHINE_API_KEY` is
installed and `DEALMACHINE_SOURCE_ENABLED=true` is explicitly approved.
