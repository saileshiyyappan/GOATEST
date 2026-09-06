# GOATEST_DATABASE_CONTRACT

## Authority

The database owner is the verified Firebase Auth UID. The authoritative Firebase project is currently `HUMAN_CONFIGURATION_REQUIRED` because repository configuration identifies both `goatest-2525` and `goatest-health`.

CONDITION writes authoritative health observations and reports. HOME reads and normalizes those records for presentation; it does not recalculate clinical or ML values.

## Temporal hierarchy

```text
/test       -- CONDITION TEST       --> consumed by DAY
/day        -- CONDITION DAY        --> consumed by WEEK
/week       -- CONDITION WEEK       --> consumed by MONTH
/month      -- CONDITION MONTH      --> consumed by HOME
```

Reports follow the same hierarchy: `/reports_test`, `/reports_day`, `/reports_week`, and `/reports_month`.

## Ownership and access

- Health and report documents use `uid` as the canonical owner field.
- `/qa_sessions` mirrors `userId` for existing HOME compatibility, but authenticated ownership is based on the verified Firebase UID.
- Owners may access their own records.
- Caretakers may access only explicitly linked monitored-user UIDs.
- Public and unauthenticated access is denied.
- `name`, `uniqueId`, document IDs, and URL parameters are not authentication.

The machine-readable collection matrix is in [GOATEST_DATABASE_CONTRACT.json](GOATEST_DATABASE_CONTRACT.json).

## Forbidden authoritative paths

`/tests`, `/day_records`, `/week_records`, `/month_records`, `/c50_results`, and `/cm_packets` are not authoritative CONDITION collections.

## Runtime status

This contract documents the intended foundation. Runtime verification is blocked until dependencies, one Firebase project selection, credentials, and controlled identities are supplied.
