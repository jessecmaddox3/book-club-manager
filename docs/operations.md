# Run the next meeting

> **TL;DR:** Suggestions become a reviewed ballot, members vote, and an organizer explicitly chooses the book and date. Commands preview changes by default. Communication tools save private drafts and never send messages.

Stop the local web app before using a standalone owner command against its data folder. In production, configure `BOOKCLUB_OWNER_MEMBER_ID` for a linked organizer. Keep plans, drafts, and recipient lists under the ignored `private/` folder.

## The six routines

| Routine | Starting command | What you review |
| --- | --- | --- |
| Ask for nominations | `npm run drafts -- nominations --output private/nominations.json` | Message and active recipients. |
| Prepare a shortlist | `npm run drafts -- shortlist --output private/shortlist.json` | Private suggestions, attribution, notes, and member UUIDs. No recipients. |
| Announce voting | `npm run drafts -- vote --meeting 6 --output private/vote.json` | Requires an open ballot; omits who nominated each book. |
| Remind nonvoters | `npm run drafts -- reminder --meeting 6 --output private/reminder.json` | Current nonvoters only, excluding former members and reminder exemptions. |
| Announce results | `npm run drafts -- results --meeting 6 --output private/results.json --calendar private/meeting.ics` | Requires a finalized book/date; includes the actual host and beverage volunteers. |
| Week-of reminder | `npm run drafts -- week-of --meeting 6 --output private/week-of.json` | Requires an upcoming finalized meeting. |

These examples use the invented current meeting number. Run `npm run cycle -- status` to check yours. Every output is marked as a draft, and existing files are not overwritten. A successful draft does not mark `notification_deliveries` or imply a message was delivered.

Review the recipient list again immediately before sending through your own chosen channel. The JSON contains private addresses if you entered them. Calendar files are exports, not invitations; opening one in your calendar is your own action. Updated meeting exports retain their UID and increase their sequence. A local-demo link only works on your computer.

## Build and open a ballot

Copy [the invented ballot example](../examples/ballot.json) to `private/ballot.json`. Choose at least two books, possible dates, a recommender for each book, and accurate descriptions. Prefer member UUIDs; an exact unique name is accepted, but an ambiguous name is rejected. Use the actual previous meeting UUID if you are pinning a previous reading assignment.

```sh
npm run cycle -- build private/ballot.json
npm run cycle -- build private/ballot.json --yes
npm run cycle -- open 7
npm run cycle -- open 7 --yes
```

Draft replacement is atomic: removed nominees/dates are removed from that draft while shared books and pending suggestions are retained. An unfinished newer draft never hides the current open ballot. Opening a closed ballot requires the separate reopen operation.

## Close a ballot deliberately

```sh
npm run cycle -- close 6
```

Review the book averages, tied leaders, dates, host volunteers, and beverage volunteers. Averages do not choose the date or host for you. Then prepare a precise plan:

```sh
npm run cycle -- close 6 --book book-6 --date 2035-04-18 --host Remy --save-plan private/close-plan.json
npm run cycle -- apply-close private/close-plan.json --yes
```

Use a book slug/UUID on your actual ballot and a listed date. Add `--beverage` once per volunteer and `--location` if known. A new accepted vote makes an older plan stale. Repeating the exact successful saved plan is idempotent; changing its payload while retaining the operation ID is rejected.

Finalization computes history from the accepted responses under the same lock as voting. Previous-book verdicts remain their own canonical records. An omitted verdict never overwrites a later backlog edit.

## Reopen, when appropriate

```sh
npm run cycle -- reopen 6
npm run cycle -- reopen 6 --yes
```

Reopening is limited to a future meeting with no recorded post-read verdicts. The previous finalization is withdrawn, its meeting becomes tentative, and old forms become stale. Existing member responses and meeting notes are retained. Re-close through a new reviewed plan.

## Explore preference forecasts

```sh
node --import tsx scripts/predict.ts --target 6 --save-plan private/prediction-plan.json
node --import tsx scripts/predict.ts --apply-plan private/prediction-plan.json --persist
```

The first command previews and saves a plan; the second explicitly appends that exact plan. The model uses finalized earlier preference votes, not the target ballot's outcomes or post-read verdicts. It compares six additive configurations, tunes on earlier folds, and evaluates on later folds. Limited history produces explicitly unavailable evaluation metrics. This is a heuristic exploration tool, not a promise of a particular accuracy.

Manual genre edits are the default:

```sh
node --import tsx scripts/tag-genres.ts
node --import tsx scripts/tag-genres.ts --file private/genres.json
node --import tsx scripts/tag-genres.ts --file private/genres.json --yes
```

Optional `--ai --save-plan private/genre-proposal.jsonl` requires explicitly enabled paid AI. The tool reserves the journal before calling the provider and syncs each validated batch. A failed later request does not lose completed paid work. Review and apply the saved proposal with `--file`; existing labels and stale changes are protected.
