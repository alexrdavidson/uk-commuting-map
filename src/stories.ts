// "People making this journey": verified, publicly posted first-person commute descriptions.
// Only linked to a pair of census areas when the author explicitly names both ends.
export interface Story {
  id: string
  platform: string
  url: string
  author: string              // as publicly credited
  published?: string
  checked: string             // date the source was opened and checked
  origin_text: string         // as stated by the author
  destination_text: string
  origin_code?: string        // 2011 census area, only when the stated origin clearly falls in it
  destination_code?: string   // may be undefined when the destination is ambiguous at area level
  mode: string
  duration?: string           // only if explicitly reported
  duration_kind?: string      // e.g. 'door to door', 'station to station', 'moving time'
  summary: string
  note?: string
}

export async function loadStories(): Promise<Story[]> {
  const r = await fetch(import.meta.env.BASE_URL + 'data/stories.json')
  if (!r.ok) return []
  return (await r.json()).stories as Story[]
}
