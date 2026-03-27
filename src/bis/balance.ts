import type { BisLink } from '../types.ts';
import { fetchSetNames } from './xivgear.ts';

const BALANCE_BASE = 'https://www.thebalanceffxiv.com';
const XIVGEAR_ORIGIN = 'https://xivgear.app';

function extractAttr(tag: string, attr: string): string | null {
  // Matches attr="value", attr='value', or attr=value (unquoted, ends at whitespace/>)
  const re = new RegExp(`${attr}=(?:"([^"]*)"|'([^']*)'|([^\\s>]*))`, 'i');
  const m = tag.match(re);
  if (!m) return null;
  return (m[1] ?? m[2] ?? m[3]).replace(/&amp;/g, '&');
}

export async function fetchBisLinks(role: string, job: string): Promise<BisLink[]> {
  const url = `${BALANCE_BASE}/jobs/${role}/${job}/best-in-slot/`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'ffxiv-gear-setup/1.0' },
  });
  if (!res.ok) {
    throw new Error(`The Balance returned ${res.status} for ${url}`);
  }
  const html = await res.text();

  const seen = new Set<string>();
  const links: BisLink[] = [];

  // 1. <a href> links — direct xivgear.app URLs (ultimates, criterion, prog, etc.)
  const anchorRegex = /<a\s([^>]*)>([\s\S]*?)<\/a>/gi;
  for (const match of html.matchAll(anchorRegex)) {
    const href = extractAttr(match[1], 'href');
    if (!href?.startsWith(XIVGEAR_ORIGIN)) continue;
    if (seen.has(href)) continue;
    seen.add(href);
    const label = match[2].replace(/<[^>]+>/g, '').trim();
    links.push({ url: href, label: label || href });
  }

  // 2. <iframe src> embeds — The Balance embeds each BIS set as an iframe using
  //    ?page=embed|bis|war|current&onlySetIndex=N. Convert these to standard BIS
  //    URLs (?page=bis|war|current&selectedIndex=N) and fetch set names for labels.
  const iframeRegex = /<iframe\s([^>]*)>/gi;
  // Group iframes by base page URL, collecting all onlySetIndex values
  const iframeGroups = new Map<string, number[]>();

  for (const match of html.matchAll(iframeRegex)) {
    const src = extractAttr(match[1], 'src');
    if (!src?.startsWith(XIVGEAR_ORIGIN)) continue;
    const parsed = new URL(src);
    const page = parsed.searchParams.get('page');
    if (!page?.startsWith('embed|')) continue;
    const basePage = page.slice('embed|'.length); // e.g. "bis|war|current"
    const baseUrl = `${XIVGEAR_ORIGIN}/?page=${basePage}`;
    const idx = Number(parsed.searchParams.get('onlySetIndex') ?? 0);
    const group = iframeGroups.get(baseUrl) ?? [];
    group.push(idx);
    iframeGroups.set(baseUrl, group);
  }

  for (const [baseUrl, indices] of iframeGroups) {
    // Fetch set names once per unique base URL
    let setNames: string[] = [];
    try {
      setNames = await fetchSetNames(baseUrl);
    } catch {
      // Fall back to index-based labels
    }
    const sortedIndices = [...new Set(indices)].sort((a, b) => a - b);
    for (const idx of sortedIndices) {
      const bisUrl = `${baseUrl}&selectedIndex=${idx}`;
      if (seen.has(bisUrl)) continue;
      seen.add(bisUrl);
      const label = setNames[idx] ?? `Set ${idx}`;
      links.push({ url: bisUrl, label });
    }
  }

  return links;
}
