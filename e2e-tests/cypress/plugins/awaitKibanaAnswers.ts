import https from 'https';

export interface AwaitKibanaAnswersOptions {
  url: string;
  credentials: string;
  // Behind the proxy, consecutive requests go to the replicas in turn. So 4 in a row reach each of
  // the 2 replicas twice.
  inARow: number;
  requestTimeoutMs: number;
  budgetMs: number;
}

export interface AwaitKibanaAnswersResult {
  ok: boolean;
  elapsedMs: number;
  // The latest outcomes, oldest first: an HTTP status, "timeout" or "error: <message>".
  outcomes: string[];
}

const PAUSE_AFTER_FAILURE_MS = 1000;
const OUTCOMES_KEPT = 12;

// Resolves with the status code as soon as the response headers arrive. A hung Kibana sends none.
const requestOnce = (url: string, credentials: string, timeoutMs: number): Promise<string> =>
  new Promise(resolve => {
    const req = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        timeout: timeoutMs,
        headers: {
          authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
          'kbn-xsrf': 'true'
        }
      },
      res => {
        res.resume();
        resolve(String(res.statusCode));
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve('timeout');
    });
    req.on('error', error => resolve(`error: ${error.message}`));
    req.end();
  });

// Any status below 500 is an answer: a 401 or a 403 still proves that the request went through
// ROR KBN and back. A 5xx, a timeout or a transport error is not.
const isAnswer = (outcome: string) => /^[1-4]\d\d$/.test(outcome);

export const awaitKibanaAnswers = async ({
  url,
  credentials,
  inARow,
  requestTimeoutMs,
  budgetMs
}: AwaitKibanaAnswersOptions): Promise<AwaitKibanaAnswersResult> => {
  const start = Date.now();
  const outcomes: string[] = [];
  let answersInARow = 0;

  while (Date.now() - start < budgetMs) {
    const outcome = await requestOnce(url, credentials, requestTimeoutMs);
    outcomes.push(outcome);
    if (outcomes.length > OUTCOMES_KEPT) outcomes.shift();

    if (isAnswer(outcome)) {
      answersInARow += 1;
      if (answersInARow >= inARow) return { ok: true, elapsedMs: Date.now() - start, outcomes };
    } else {
      answersInARow = 0;
      await new Promise(resolve => setTimeout(resolve, PAUSE_AFTER_FAILURE_MS));
    }
  }

  return { ok: false, elapsedMs: Date.now() - start, outcomes };
};
