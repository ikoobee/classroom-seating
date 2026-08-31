/**
 * Relation constraints: friend pairs (must sit as deskmates) and blacklist
 * pairs (forbidden as deskmates / optionally forbidden front-back adjacent)
 */
export function emptyRelations() {
  return { friends: [], blacklist: [] };
}

export function normalizeRelations(r = {}) {
  const seen = new Set();
  const friends = [];
  for (const p of r.friends || []) {
    const key = pairKey(p.a, p.b);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    friends.push({ a: p.a, b: p.b });
  }
  const blacklist = [];
  const seenB = new Set();
  for (const p of r.blacklist || []) {
    const key = pairKey(p.a, p.b);
    if (!key || seenB.has(key)) continue;
    seenB.add(key);
    blacklist.push({ a: p.a, b: p.b, noFrontBack: !!p.noFrontBack });
  }
  return { friends, blacklist };
}

function pairKey(a, b) {
  if (!Number.isInteger(a) || !Number.isInteger(b) || a === b) return null;
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

/** O(1) relation lookup index */
export function buildRelationIndex(relations) {
  const friendOf = new Map();   // studentId -> Set<partnerId>
  const blackOf = new Map();    // studentId -> [{partner, noFrontBack}]
  for (const p of relations.friends) {
    addMap(friendOf, p.a, p.b);
    addMap(friendOf, p.b, p.a);
  }
  for (const p of relations.blacklist) {
    if (!blackOf.has(p.a)) blackOf.set(p.a, []);
    if (!blackOf.has(p.b)) blackOf.set(p.b, []);
    blackOf.get(p.a).push({ partner: p.b, noFrontBack: p.noFrontBack });
    blackOf.get(p.b).push({ partner: p.a, noFrontBack: p.noFrontBack });
  }
  return { friendOf, blackOf };
}

function addMap(m, k, v) {
  if (!m.has(k)) m.set(k, new Set());
  m.get(k).add(v);
}

/** Drop relations that reference non-existent students */
export function pruneRelations(relations, existingIds) {
  const ok = id => existingIds.has(id);
  return normalizeRelations({
    friends: relations.friends.filter(p => ok(p.a) && ok(p.b)),
    blacklist: relations.blacklist.filter(p => ok(p.a) && ok(p.b)),
  });
}
