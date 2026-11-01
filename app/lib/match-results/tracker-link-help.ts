/**
 * How a manager gets a tracker.gg match link. One list feeds both the help popover in the
 * Submit result dialog and the portal tutorial, so the two can never disagree.
 */
export const TRACKER_LINK_STEPS: readonly string[] = [
  'Go to the Valorant tracker (tracker.gg/valorant) page for your account.',
  'Click Customs.',
  'Find the match you want to upload and click the three dots next to it.',
  'A popup with the match results opens. Either click Open in new tab and copy that page’s URL, or click Share and copy the link.',
];

/** The same steps as one sentence-per-step string for the tutorial card. */
export function trackerLinkStepsText(): string {
  return TRACKER_LINK_STEPS.map((step, index) => `${index + 1}. ${step}`).join(' ');
}
