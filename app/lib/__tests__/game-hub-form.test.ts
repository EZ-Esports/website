import { describe, it, expect } from 'vitest';
import {
  FORM_LENGTH,
  buildFormGuide,
  describeFormGuide,
  type FormEntry,
} from '../game-hub-form';

/**
 * Entries are built with an explicit day number so a test can state the
 * chronology it means, independently of the order it hands the rows over in.
 *
 * One row is one *side* of one match — the shape `buildFormGuideQuery` returns
 * — so a fixture between two schools is written as two entries sharing an id.
 */
const entry = (
  day: number,
  school: string | null,
  scored: number | null,
  conceded: number | null,
  id = `match-${day}`
): FormEntry => ({
  id,
  school,
  scored,
  conceded,
  scheduledAt: new Date(Date.UTC(2025, 0, day)).toISOString(),
});

const guideFor = (entries: FormEntry[], school: string) =>
  buildFormGuide(entries).get(school);

describe('buildFormGuide', () => {
  it('returns an empty map when there are no matches — a snapshot-standings season has no form', () => {
    const guides = buildFormGuide([]);
    expect(guides.size).toBe(0);
    // The shape the caller relies on: a lookup miss, not an array of losses.
    expect(guides.get('Stuyvesant')).toBeUndefined();
  });

  it('leaves a school with no matches out of the map entirely', () => {
    const guides = buildFormGuide([entry(1, 'Stuyvesant', 2, 0)]);
    expect(guides.has('Brooklyn Tech')).toBe(false);
    expect(guides.get('Brooklyn Tech')).toBeUndefined();
  });

  it('shows only the matches that exist when a school has fewer than five', () => {
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 0, 2),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['W', 'L']);
    expect(guides.get('Stuyvesant')).toHaveLength(2);
  });

  it('returns exactly five, oldest first, when a school has five', () => {
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 0, 2),
      entry(3, 'Stuyvesant', 2, 1),
      entry(4, 'Stuyvesant', 1, 2),
      entry(5, 'Stuyvesant', 2, 0),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['W', 'L', 'W', 'L', 'W']);
  });

  it('keeps the five most recent when a school has more than five', () => {
    // Seven matches: the two oldest (days 1-2) must fall out of the guide.
    // SQL caps at five per school, but the cap is enforced here too — the two
    // must not be able to disagree about which five.
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 0, 2), // dropped
      entry(2, 'Stuyvesant', 0, 2), // dropped
      entry(3, 'Stuyvesant', 2, 0),
      entry(4, 'Stuyvesant', 2, 0),
      entry(5, 'Stuyvesant', 0, 2),
      entry(6, 'Stuyvesant', 2, 0),
      entry(7, 'Stuyvesant', 2, 0),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['W', 'W', 'L', 'W', 'W']);
  });

  it('reads each side of a fixture from its own scores', () => {
    // The two sides of one match arrive as two rows sharing an id, each with
    // its own scored/conceded — nothing downstream has to know which end of
    // the fixture it is looking at.
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 2, 0, 'match-a'),
      entry(1, 'Bronx Science', 0, 2, 'match-a'),
      entry(2, 'Stuyvesant', 0, 2, 'match-b'),
      entry(2, 'Bronx Science', 2, 0, 'match-b'),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['W', 'L']);
    expect(guides.get('Bronx Science')).toEqual(['L', 'W']);
  });

  it('orders from scheduledAt, not from the order rows arrive in', () => {
    const chronological = [
      entry(1, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 0, 2),
      entry(3, 'Stuyvesant', 0, 2),
    ];
    const expected = ['W', 'L', 'L'];
    expect(guideFor(chronological, 'Stuyvesant')).toEqual(expected);
    // Newest-first (how the hub query happens to return them) and shuffled must
    // both produce the same guide.
    expect(guideFor([...chronological].reverse(), 'Stuyvesant')).toEqual(expected);
    expect(
      guideFor([chronological[1], chronological[2], chronological[0]], 'Stuyvesant')
    ).toEqual(expected);
  });

  it('orders matches that share a kickoff time by id, not by arrival order', () => {
    // Bulk-imported seasons default every unknown kickoff to one timestamp —
    // the active Valorant season has six matches sharing one. Sorting on the
    // timestamp alone leaves those rows in whatever order the database
    // happened to return them, so a school's chips could reorder between two
    // identical requests. The id is the tiebreaker on both sides: SQL ranks
    // the partition by (scheduled_at desc, id desc) and this does the same.
    const sameDay = [
      entry(1, 'Stuyvesant', 2, 0, 'match-a'),
      entry(1, 'Stuyvesant', 0, 2, 'match-b'),
      entry(1, 'Stuyvesant', 1, 1, 'match-c'),
    ];
    const expected = ['W', 'L', 'D'];
    expect(guideFor(sameDay, 'Stuyvesant')).toEqual(expected);
    expect(guideFor([...sameDay].reverse(), 'Stuyvesant')).toEqual(expected);
    expect(guideFor([sameDay[2], sameDay[0], sameDay[1]], 'Stuyvesant')).toEqual(expected);
  });

  it('drops the lowest id when tied matches overflow the cap', () => {
    // Six matches at one timestamp: the cap has to fall somewhere, and it has
    // to fall in the same place every time.
    const tied = ['a', 'b', 'c', 'd', 'e', 'f'].map((id, i) =>
      entry(1, 'Stuyvesant', i === 0 ? 0 : 2, i === 0 ? 2 : 0, `match-${id}`)
    );
    // `match-a` is the loss and the lowest id, so it is the one pushed out.
    expect(guideFor(tied, 'Stuyvesant')).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(guideFor([...tied].reverse(), 'Stuyvesant')).toEqual(['W', 'W', 'W', 'W', 'W']);
  });

  it('caps by recency, not by input position', () => {
    const newestFirst = [
      entry(6, 'Stuyvesant', 2, 0),
      entry(5, 'Stuyvesant', 2, 0),
      entry(4, 'Stuyvesant', 2, 0),
      entry(3, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 2, 0),
      entry(1, 'Stuyvesant', 0, 2), // oldest, a loss — must be the one dropped
    ];
    expect(guideFor(newestFirst, 'Stuyvesant')).toEqual(['W', 'W', 'W', 'W', 'W']);
    expect(guideFor([...newestFirst].reverse(), 'Stuyvesant')).toEqual(['W', 'W', 'W', 'W', 'W']);
  });

  it('gives a drawn match its own chip on both sides', () => {
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 2, 0, 'match-a'),
      entry(1, 'Bronx Science', 0, 2, 'match-a'),
      entry(2, 'Stuyvesant', 1, 1, 'match-b'),
      entry(2, 'Bronx Science', 1, 1, 'match-b'),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['W', 'D']);
    expect(guides.get('Bronx Science')).toEqual(['L', 'D']);
  });

  it('lets a draw consume one of the five slots', () => {
    // Six matches, the middle two drawn. If draws were skipped the strip would
    // read the four decided results and reach back to day 1 for a fifth — so
    // "last five" would mean "last five decided", and the day-1 win would be
    // shown as more recent than two matches that were actually played after
    // it. The cap also lives in SQL now, so a skipped draw does not even free
    // a slot: it just shortens the strip.
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 0, 2),
      entry(3, 'Stuyvesant', 1, 1),
      entry(4, 'Stuyvesant', 1, 1),
      entry(5, 'Stuyvesant', 2, 0),
      entry(6, 'Stuyvesant', 0, 2),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['L', 'D', 'D', 'W', 'L']);
    expect(guides.get('Stuyvesant')).toHaveLength(FORM_LENGTH);
  });

  it('shows a school that has only ever drawn', () => {
    // Previously this school was absent from the map entirely, which the page
    // renders identically to "no form on record" — a school that had played
    // six matches read as one that had played none.
    const guides = buildFormGuide([
      entry(1, 'Stuyvesant', 0, 0),
      entry(2, 'Stuyvesant', 1, 1),
    ]);
    expect(guides.get('Stuyvesant')).toEqual(['D', 'D']);
  });

  it('drops a row it cannot attribute or score', () => {
    expect(buildFormGuide([entry(1, null, 2, 0)]).size).toBe(0);
    // An empty school name is no more usable as a key than a null one.
    expect(buildFormGuide([entry(1, '', 2, 0)]).size).toBe(0);
    // Scores are non-null by the query's filters, but a missing one is an
    // unplayed match, not a nil-nil draw.
    expect(buildFormGuide([entry(1, 'Stuyvesant', null, 0)]).size).toBe(0);
    expect(buildFormGuide([entry(1, 'Stuyvesant', 2, null)]).size).toBe(0);
  });

  it('does not mutate the caller’s array', () => {
    const entries = [
      entry(1, 'Stuyvesant', 2, 0),
      entry(3, 'Stuyvesant', 2, 0),
      entry(2, 'Stuyvesant', 2, 0),
    ];
    const order = entries.map((e) => e.scheduledAt);
    buildFormGuide(entries);
    expect(entries.map((e) => e.scheduledAt)).toEqual(order);
  });

  it('honours a custom length, and returns nothing for a non-positive one', () => {
    const entries = [
      entry(1, 'Stuyvesant', 0, 2),
      entry(2, 'Stuyvesant', 2, 0),
      entry(3, 'Stuyvesant', 2, 0),
    ];
    expect(buildFormGuide(entries, 2).get('Stuyvesant')).toEqual(['W', 'W']);
    expect(buildFormGuide(entries, 0).size).toBe(0);
    expect(FORM_LENGTH).toBe(5);
  });
});

describe('describeFormGuide', () => {
  it('names the outcomes and the direction they read in', () => {
    expect(describeFormGuide(['W', 'W', 'L', 'W', 'W'])).toBe(
      'Form, oldest to newest: won, won, lost, won, won.'
    );
  });

  it('names a draw rather than leaving a gap in the sentence', () => {
    expect(describeFormGuide(['W', 'D', 'L', 'D', 'W'])).toBe(
      'Form, oldest to newest: won, drew, lost, drew, won.'
    );
  });

  it('says form is unavailable rather than describing an empty list', () => {
    expect(describeFormGuide([])).toBe('Recent form not available.');
  });
});
