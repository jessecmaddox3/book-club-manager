---
name: book-club-operations
description: Run a Book Club Manager nomination, shortlist, ballot, reminder, or meeting-announcement workflow using its local or hosted owner commands.
---

# Book club operations

Work from this repository's root and read [the organizer guide](../../docs/operations.md) for the requested operation. The project provides six routines: nomination request, organizer shortlist, voting announcement, nonvoter reminder, results announcement, and week-of reminder.

Use the configured club, not the invented example's names, dates, or meeting number. Read `npm run cycle -- status`. Keep private outputs in `private/`. Stop a local demo server before opening the same data folder with an owner command; its lock enforces one owner.

Preserve the user's actual authorization. A request to prepare a ballot or announcement authorizes its draft. Apply a state change with `--yes` when the user has authorized that change and the required book/date/host choices are settled. Reuse existing approval; do not add a ceremonial approval step. These tools never send messages. A saved draft does not authorize sending through another app.

Use stable member/book UUIDs from the current installation. Do not match people by approximate name or email. Keep nominee attribution in the organizer shortlist; the voting announcement is anonymous. Check factual book claims against sources, retaining sources in the ballot definition. Do not invent page counts, awards, reading commitments, or member availability.

Closing requires an explicitly chosen book and ballot date. Inspect ties and host/beverage volunteers, save the exact close plan, then apply it. If a new vote makes the plan stale, review the new state and prepare a new plan. Retrying the same successful plan is safe. Never directly overwrite history or relabel a meeting with existing verdicts.

Generate reminders from current exemption-aware recipients. Review addresses immediately before any separately authorized send. Calendar export is a local `.ics` file, not an invitation delivery. Do not mark delivery based on draft creation.

Preference forecasts and optional paid genre labeling are separate tools. Use their saved plans and journals. Paid requests need the user's applicable authorization and explicit provider configuration. The local demo must not use live providers.

Preserve the full application when improving it: local and hosted modes share the command functions, canonical post-read verdicts remain separate from pre-read preferences, and private records/credentials never belong in source fixtures, screenshots, releases, or public issue reports.
