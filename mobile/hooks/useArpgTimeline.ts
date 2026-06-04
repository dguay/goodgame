import { useQuery } from '@tanstack/react-query'
import ICAL from 'ical.js'

const ICS_URL = 'https://www.arpg-timeline.com/calendar/subscribe'
const GAME_BASE_URL = 'https://www.arpg-timeline.com/game'

// Maps game names (as parsed from SUMMARY) to their arpg-timeline.com slug.
// Extend this as new games appear in the feed.
const GAME_SLUGS: Record<string, string> = {
  'Grim Dawn': 'grim-dawn',
  'Grim Dawn Community League': 'titan-quest-ii',
  'The Dark West': 'the-dark-west',
  'Blizzless D2R': 'blizzless-d2r',
  'Path of Exile': 'path-of-exile',
  'Path of Exile 2': 'path-of-exile-2',
  'Diablo IV': 'diablo-iv',
  'Diablo III': 'diablo-iii',
  'Diablo II: Resurrected': 'diablo-ii-resurrected',
  'Path of Diablo': 'path-of-diablo',
  'Last Epoch': 'last-epoch',
  'Torchlight Infinite': 'torchlight-infinite',
  'Undecember': 'undecember',
  'Wolcen': 'wolcen',
  'Titan Quest II': 'titan-quest-ii',
  'Crystalfall': 'crystalfall',
  'Ravenswatch': 'ravenswatch',
  'Project Diablo 2': 'pd2',
  'No Rest For The Wicked': 'nrftw',
  'Path of Terraria': 'path-of-terraria',
  'Zizaran\'s Path of Exile Gauntlet': 'zizaran-s-path-of-exile-gauntlet',
  'Striving for Light': 'striving-for-light',
  'Dwarven Realms': 'dwarven-realms',
  'Cult of Shadows': 'cult-of-shadows',
  'Hell Clock': 'hell-clock',
  'Slash Diablo': 'slash-diablo',
  'Hero Siege': 'hero-siege',
  'Median XL': 'median-xl',
  'Emberville': 'emberville',
  'Pathfinder: Abomination Vaults': 'pathfinder-abomination-vaults',
  'Darkhaven': 'darkhaven',
  'Dragonkin: The Banished': 'dragonkin-the-banished',
  'The Slormancer': 'the-slormancer',
}

export type ArpgEventType = 'Demo' | 'Season' | 'Alpha' | 'Beta' | 'Launch' | 'Event'

export interface ArpgEvent {
  uid: string
  game: string
  eventName: string
  eventType: ArpgEventType
  startDate: Date
  gameUrl: string | null
}

export interface ArpgTimeline {
  events: ArpgEvent[]
  feedLastModified: Date | null
}

function classifyEvent(summary: string): ArpgEventType {
  const lower = summary.toLowerCase()
  if (lower.includes('demo')) return 'Demo'
  if (lower.includes('season')) return 'Season'
  if (lower.includes('alpha')) return 'Alpha'
  if (lower.includes('beta')) return 'Beta'
  if (lower.includes('launch') || lower.includes('release')) return 'Launch'
  return 'Event'
}

function parseSummary(summary: string): { game: string; eventName: string } {
  const sep = summary.indexOf(' | ')
  if (sep === -1) return { game: summary, eventName: '' }
  const game = summary.slice(0, sep).trim()
  const raw = summary.slice(sep + 3).trim()
  const eventName = raw.replace(/\s+launch\s*$/i, '').trim() || raw
  return { game, eventName }
}

function icalTimeToDate(val: unknown): Date | null {
  if (val != null && typeof val === 'object' && 'toJSDate' in val) {
    return (val as { toJSDate(): Date }).toJSDate()
  }
  return null
}

async function fetchArpgTimeline(): Promise<ArpgTimeline> {
  const res = await fetch(ICS_URL)
  if (!res.ok) throw new Error(`ICS fetch failed: ${res.status}`)

  const lastModifiedHeader = res.headers.get('last-modified')

  const text = await res.text()
  const parsed = ICAL.parse(text)
  const comp = new ICAL.Component(parsed)
  const vevents = comp.getAllSubcomponents('vevent')

  // DTSTAMP is the feed generation timestamp (same value across all events per snapshot).
  // Prefer it over the HTTP Last-Modified header.
  const dtstamp = vevents[0]?.getFirstPropertyValue('dtstamp')
  const feedLastModified =
    icalTimeToDate(dtstamp) ?? (lastModifiedHeader != null ? new Date(lastModifiedHeader) : null)

  const events: ArpgEvent[] = vevents
    .map((vevent) => {
      const ev = new ICAL.Event(vevent)
      const { game, eventName } = parseSummary(ev.summary ?? '')
      const slug = GAME_SLUGS[game]
      return {
        uid: ev.uid,
        game,
        eventName,
        eventType: classifyEvent(ev.summary ?? ''),
        startDate: ev.startDate.toJSDate(),
        gameUrl: slug != null ? `${GAME_BASE_URL}/${slug}` : null,
      }
    })
    .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())

  return { events, feedLastModified }
}

export function useArpgTimeline() {
  return useQuery({
    queryKey: ['arpg-timeline'],
    queryFn: fetchArpgTimeline,
    staleTime: 60 * 60 * 1000,
    gcTime: 2 * 60 * 60 * 1000,
    refetchOnWindowFocus: false,
  })
}
