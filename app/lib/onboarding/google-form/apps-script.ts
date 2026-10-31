/**
 * The Apps Script staff paste into the onboarding Google Form (spec-051). Kept as a function of the
 * endpoint URL so the staff page shows a script that already points at this deployment.
 *
 * It reads the "Verification code" answer and posts it to the website. Delivery rules, matching the
 * route's status codes:
 *
 * - 2xx: done.
 * - 408, 429 and 5xx, and network errors: retry with a pause. The website answers 429 with a
 *   Retry-After header when too many bad credentials came from Google's shared address pool; the
 *   pause honours it (capped). Without this retry a single 429 would silently lose a completion.
 * - Anything else (a stale code, a wrong key, a spent invite): never retried, because the same
 *   request cannot succeed. The script throws, so the failure shows in the trigger's execution log
 *   and in Google's failure notification email.
 */
export function buildAppsScript(endpoint: string): string {
  // JSON.stringify yields a safely quoted JavaScript string literal for the URL.
  return `// EZ Esports onboarding form: tells the website each time someone submits this form.
// Setup (Project Settings > Script properties): add WEBHOOK_KEY with the key shown on the website's
// Onboarding Form page. Then add a trigger: function onFormSubmit, event source "From form", type "On form submit".
const ENDPOINT = ${JSON.stringify(endpoint)};
const QUESTION_TITLE = 'Verification code';
const MAX_ATTEMPTS = 5;
const MAX_PAUSE_MS = 30000;

function onFormSubmit(e) {
  const key = PropertiesService.getScriptProperties().getProperty('WEBHOOK_KEY');
  if (!key) throw new Error('Script property WEBHOOK_KEY is missing.');

  const code = findVerificationCode_(e);
  if (!code) {
    console.warn('This response has no verification code, so it was not reported.');
    return;
  }
  report_(code, key);
}

function findVerificationCode_(e) {
  const answers = e.response.getItemResponses();
  for (let i = 0; i < answers.length; i++) {
    if (answers[i].getItem().getTitle().trim().toLowerCase() === QUESTION_TITLE.toLowerCase()) {
      return String(answers[i].getResponse()).trim();
    }
  }
  return '';
}

function report_(code, key) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let status = 0;
    let body = '';
    let pauseMs = Math.min(Math.pow(2, attempt) * 1000, MAX_PAUSE_MS);
    try {
      const response = UrlFetchApp.fetch(ENDPOINT, {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + key },
        payload: JSON.stringify({ token: code }),
        muteHttpExceptions: true,
      });
      status = response.getResponseCode();
      body = response.getContentText();
      if (status >= 200 && status < 300) {
        console.log('Reported to the website.');
        return;
      }
      const headers = response.getHeaders();
      const retryAfter = Number(headers['Retry-After'] || headers['retry-after']);
      if (retryAfter > 0) pauseMs = Math.min(retryAfter * 1000, MAX_PAUSE_MS);
    } catch (err) {
      // Network failure: treated like a server error and retried.
      status = 0;
      body = String(err);
    }

    const retryable = status === 0 || status === 408 || status === 429 || status >= 500;
    if (!retryable) {
      throw new Error('The website rejected this response (' + status + '): ' + body);
    }
    console.warn('Attempt ' + attempt + ' of ' + MAX_ATTEMPTS + ' failed (' + status + '). ' + body);
    if (attempt < MAX_ATTEMPTS) Utilities.sleep(pauseMs);
  }
  throw new Error('The website did not accept this response after ' + MAX_ATTEMPTS + ' attempts.');
}
`;
}
