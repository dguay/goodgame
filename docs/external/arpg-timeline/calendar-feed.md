# arpg-timeline.com — ICS Calendar Feed

**URL:** `https://www.arpg-timeline.com/calendar/subscribe`  
**Format:** iCalendar 2.0 (`text/calendar`)  
**Refresh TTL:** 1 hour (`X-PUBLISHED-TTL:PT1H`)

---

## VCALENDAR Properties

| Property | Value | Notes |
|---|---|---|
| `VERSION` | `2.0` | iCal spec version |
| `CALSCALE` | `GREGORIAN` | |
| `PRODID` | `adamgibbons/ics` | Generated via the `ics` npm library |
| `METHOD` | `PUBLISH` | Read-only broadcast calendar |
| `X-WR-CALNAME` | `arpg-timeline.com` | Display name in calendar clients |
| `X-PUBLISHED-TTL` | `PT1H` | Recommended client refresh interval |

---

## VEVENT Properties

Each event has the following fields:

| Property | Type | Example | Notes |
|---|---|---|---|
| `UID` | string | `393d460b-...@arpg-timeline.com` | UUID or semantic slug + `@arpg-timeline.com` |
| `SUMMARY` | string | `Grim Dawn \| Fangs of Asterkarn launch` | Format: `{Game} \| {Event description}` |
| `DTSTAMP` | datetime (UTC) | `20260604T124550Z` | Feed generation timestamp — **same value across all events in a snapshot** |
| `DTSTART` | datetime (UTC) | `20260610T170000Z` | Event start time in UTC |
| `DTEND` | datetime (UTC) | `20260610T180000Z` | Event end time in UTC — typically 1 hour after `DTSTART` |
| `DESCRIPTION` | string | See below | Free text; contains optional note, optional YouTube link, footer link |
| `URL` | string | `https://www.arpg-timeline.com?utm_source=calendar` | **Always the homepage** — not game-specific |
| `X-MICROSOFT-CDO-BUSYSTATUS` | string | `FREE` | Calendar busy/free status — always `FREE`; unrelated to game price |

---

## SUMMARY Format

Events follow this naming pattern:

```
{Game Name} | {Event Name} launch
```

Examples:
- `The Dark West | Steam Demo launch`
- `Blizzless D2R | Season 3 launch`
- `Grim Dawn | Fangs of Asterkarn launch`

Splitting on ` | ` gives game name (left) and event description (right). Stripping the trailing ` launch` gives a clean event label.

---

## DESCRIPTION Format

Descriptions are free-form but follow a consistent structure:

```
[Optional note]\n\n[Optional "Season page: <url>"]\n\nVisit https://www.arpg-timeline.com?utm_source=calendar for more information.
```

Known variants:
- **Note only:** `Note: Exact time is unknown and may vary by timezone or platform.`
- **Season page link:** `Season page: https://youtu.be/...`
- **Footer (always present):** `Visit https://www.arpg-timeline.com?utm_source=calendar for more information.`

The Season page link is the most useful external URL — it points to a YouTube trailer or season announcement. It is **not** exposed in the `URL` field (which always points to the homepage).

---

## UID Format

UIDs use two patterns:

| Pattern | Example |
|---|---|
| UUID | `393d460b-2fc5-4f3b-8ea5-8a589270ca6f@arpg-timeline.com` |
| Semantic slug | `season-grim-dawn-fangs-of-asterkarn@arpg-timeline.com` |

The slug pattern appears for events that have a stable identity (e.g., expansion launches). The UUID pattern is used otherwise.

---

## Time Handling

All datetimes are UTC. When the exact launch time is unknown:
- `DTSTART` is set to `23:00:00Z`
- `DTEND` is set to `00:00:00Z` the following day (1-hour slot)
- A note is added to `DESCRIPTION`: `Note: Exact time is unknown and may vary by timezone or platform.`

There is no dedicated boolean field for "time unknown" — the note in `DESCRIPTION` is the only signal.

---

## Feed Last-Modified Timestamp

`DTSTAMP` on each VEVENT holds the feed generation time. All events in a single fetch share the same `DTSTAMP` value — it is effectively the "when was this feed last regenerated" timestamp.

This is more reliable than the HTTP `Last-Modified` response header for displaying to the user, as it is embedded in the ICS content itself and reflects when the feed data was last published.

---

## Raw Example

```
BEGIN:VCALENDAR
VERSION:2.0
CALSCALE:GREGORIAN
PRODID:adamgibbons/ics
METHOD:PUBLISH
X-WR-CALNAME:arpg-timeline.com
X-PUBLISHED-TTL:PT1H
BEGIN:VEVENT
UID:393d460b-2fc5-4f3b-8ea5-8a589270ca6f@arpg-timeline.com
SUMMARY:The Dark West | Steam Demo launch
DTSTAMP:20260604T124550Z
DTSTART:20260610T170000Z
DTEND:20260610T180000Z
DESCRIPTION:Season page: https://www.youtube.com/watch?v=9ZcosfeFLZE&utm_source=arpg-timeline&utm_medium=calendar\n\nVisit https://www.arpg-timeline.com?utm_source=calendar for more information.
URL:https://www.arpg-timeline.com?utm_source=calendar
X-MICROSOFT-CDO-BUSYSTATUS:FREE
END:VEVENT
BEGIN:VEVENT
UID:5afdb8f4-b19e-457f-94f4-cc28761d7909@arpg-timeline.com
SUMMARY:Blizzless D2R | Season 3 launch
DTSTAMP:20260604T124550Z
DTSTART:20260612T150000Z
DTEND:20260612T160000Z
DESCRIPTION:Visit https://www.arpg-timeline.com?utm_source=calendar for more information.
URL:https://www.arpg-timeline.com?utm_source=calendar
X-MICROSOFT-CDO-BUSYSTATUS:FREE
END:VEVENT
BEGIN:VEVENT
UID:season-grim-dawn-fangs-of-asterkarn@arpg-timeline.com
SUMMARY:Grim Dawn | Fangs of Asterkarn launch
DTSTAMP:20260604T124550Z
DTSTART:20260723T230000Z
DTEND:20260724T000000Z
DESCRIPTION:Note: Exact time is unknown and may vary by timezone or platform.\n\nSeason page: https://youtu.be/n_29nUR9RXQ?si=AqdxXo4nOb9f0nNN&utm_source=arpg-timeline&utm_medium=calendar\n\nVisit https://www.arpg-timeline.com?utm_source=calendar for more information.
URL:https://www.arpg-timeline.com?utm_source=calendar
X-MICROSOFT-CDO-BUSYSTATUS:FREE
END:VEVENT
END:VCALENDAR
```

---

## Implementation Notes

- **`URL` field is not game-specific.** Always points to the arpg-timeline.com homepage. To link to a specific event, extract the YouTube/Season page URL from `DESCRIPTION` using a regex on `Season page: <url>`.
- **`DTSTAMP` = feed timestamp.** Use the first event's `DTSTAMP` (they're all equal) as the "feed last updated" value instead of relying on the HTTP `Last-Modified` header.
- **"Time unknown" detection.** Check if `DESCRIPTION` contains `"Exact time is unknown"` to suppress time display and show date-only.
- **`X-MICROSOFT-CDO-BUSYSTATUS:FREE`** is a calendar busy/free indicator — it does not mean the game is free-to-play.
