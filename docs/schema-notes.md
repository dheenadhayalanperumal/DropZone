# DropZone — Schema Notes

The database mirrors Streaks conventions (utf8mb4, integer PKs, `created_at`/`updated_at`,
Bearer-token admin sessions). Migrations live in `backend/migrations/` and are applied
in filename order by `backend/cron/../migrate.php` (or manually).

## Design decisions (answers to PRD §8 Open Questions)

1. **Enrollment model** — open self-enroll via `POST /api/enroll` (email or mobile).
   Admins may also pre-seed users. Both paths create the same `users` + `enrollments` rows.
2. **Empty boxes** — allowed. A drop with `reward_id = NULL` (or a voucher of type `empty`)
   reveals a "better luck next time". Stock exhaustion also falls back to empty.
3. **Re-open policy** — an admin may re-open a `missed` box via `POST /api/admin/users/:id/adjust-box`.
   Always audited in `box_events` with `type = 'adjust'`.
4. **Weekly/Monthly windows** — the whole period is openable by default. `open_at`/`close_at`
   on each drop row make the exact window explicit and per-drop overridable in the calendar.
5. **Multi-campaign per user** — supported. `enrollments` is unique on `(user_id, campaign_id)`,
   so a user can hold many enrollments.
6. **Reward codes** — supports both. A voucher with `code_mode = 'shared'` issues one shared
   code; `code_mode = 'unique'` draws from `voucher_codes` pool (stock-enforced).

## Integrity invariants

- `UNIQUE(enrollment_id, drop_id)` on `boxes` → exactly one box per user per drop.
- Reward issuance is idempotent per box; a second open returns `already_opened`.
- Every state transition is written to `box_events`.
- Stock is decremented atomically inside the open transaction.
