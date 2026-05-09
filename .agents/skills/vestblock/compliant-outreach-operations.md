# Compliant Outreach Operations

Use this skill when expanding VestBlock's outbound system.

## Core rule

Do not treat automation as permission to blast.

## Required controls

- approval states
- send caps
- provider readiness checks
- error logging
- opt-out language
- do-not-contact status support

## Transactional vs outbound

- Resend is for system and transactional mail first
- Gmail / Workspace is preferred for inbox-style outbound if configured
- keep those roles separate in code and in operations

## Safe defaults

- auto-send off by default
- use dry-run tests first
- surface missing provider keys clearly
- never crash the workflow because a send provider is unavailable
