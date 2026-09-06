# GOATEST_PIPELINE_CONTRACT

```text
SHB
  ↓ CM_PACKET_V1
CONDITION / C50 TEST
  ↓ /test + /reports_test
DAY
  ↓ /day + /reports_day
WEEK
  ↓ /week + /reports_week
MONTH
  ↓ /month + /reports_month
HOME
  ↓
CARETAKER / NOTIFICATIONS
```

Every boundary uses the verified Firebase Auth UID. The CM packet is transport-only and is never persisted as `/cm_packets`.

The C50 matcher and report generator remain authoritative. HOME only retrieves canonical records and reports and performs presentation normalization.

Runtime status is currently blocked by missing dependencies, unresolved single-project Firebase configuration, missing Admin credentials, and unavailable controlled runtime identities.

The machine-readable boundary matrix is in [GOATEST_PIPELINE_CONTRACT.json](GOATEST_PIPELINE_CONTRACT.json).
