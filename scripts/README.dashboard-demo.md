# Local dashboard demo data

Run from `sms-gateway-db` with an existing local development database:

```bash
# Preview counts without writing anything.
node --env-file=../api/.env scripts/seed-dashboard-demo.mjs

# Insert the labelled synthetic data.
node --env-file=../api/.env scripts/seed-dashboard-demo.mjs --apply
```

The script requires a loopback database URL and existing connector and MW/KE network records. It creates four `[Demo]` clients, eight `DEMO-*` sender IDs, disabled demo routes and message/status history. It includes 420 messages for the current day in Africa/Blantyre, the preceding 14 days, and monthly history earlier in the current year. Segment counts match the generated GSM7 body lengths.

Clients, sender IDs and routes are disabled. Attempts are completed/submitted/failed; there are no pending dispatch attempts, queue publications, outbox events, credentials, payment records or financial ledger changes. Phone numbers are dummy placeholders. Existing non-demo records are untouched.

Stable IDs and `skipDuplicates` make repeated runs on the same day idempotent. New days append additional preview data. Records are marked through demo client metadata, message public IDs beginning `DG`, and `dashboard-demo` status events. These records affect local dashboard/report totals and should not be treated as real customer traffic.

Applied on 13 November 2026: 1,794 messages, 2,357 segments, 420 messages today. Verified using the dashboard repository queries: eight sender bars, four active-in-period clients and matching sender/client/network message totals. “Active in period” describes message activity; demo clients remain disabled.
