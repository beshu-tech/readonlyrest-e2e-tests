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
  // The latest outcomes, oldest first: an HTTP status, "timeout" or "error: <message>", followed by
  // "@<replica address>" when the proxy names the replica.
  outcomes: string[];
}

interface Outcome {
  result: string;
  replica?: string;
}

const PAUSE_AFTER_FAILURE_MS = 1000;
const OUTCOMES_KEPT = 12;

// Resolves as soon as the response headers arrive. A hung Kibana sends none.
//
// `x-kbn-proxy-failover: off` stops the proxy from retrying a failed request on the other replica,
// which would hide the failed one. A Kibana without that proxy ignores the header.
const requestOnce = (url: string, credentials: string, timeoutMs: number): Promise<Outcome> =>
  new Promise(resolve => {
    const req = https.request(
      url,
      {
        method: 'GET',
        rejectUnauthorized: false,
        timeout: timeoutMs,
        headers: {
          authorization: `Basic ${Buffer.from(credentials).toString('base64')}`,
          'kbn-xsrf': 'true',
          'x-kbn-proxy-failover': 'off'
        }
      },
      res => {
        res.resume();
        const replica = res.headers['x-kbn-replica'];
        resolve({ result: String(res.statusCode), replica: typeof replica === 'string' ? replica : undefined });
      }
    );
    req.on('timeout', () => {
      req.destroy();
      resolve({ result: 'timeout' });
    });
    req.on('error', error => resolve({ result: `error: ${error.message}` }));
    req.end();
  });

// Any status below 500 is an answer: a 401 or a 403 still proves that the request went through
// ROR KBN and back. A 5xx, a timeout or a transport error is not.
const isAnswer = ({ result }: Outcome) => /^[1-4]\d\d$/.test(result);

const format = ({ result, replica }: Outcome) => (replica ? `${result}@${replica}` : result);

// Done after `inARow` answers in a row, among which every replica seen so far answered at least once.
// Other traffic through the proxy can shift its round-robin, so `inARow` alone does not prove that
// each replica answered.
export const awaitKibanaAnswers = async ({
  url,
  credentials,
  inARow,
  requestTimeoutMs,
  budgetMs
}: AwaitKibanaAnswersOptions): Promise<AwaitKibanaAnswersResult> => {
  const start = Date.now();
  const outcomes: string[] = [];
  const replicasSeen = new Set<string>();
  const replicasInTheRow = new Set<string>();
  let answersInARow = 0;

  while (Date.now() - start < budgetMs) {
    const outcome = await requestOnce(url, credentials, requestTimeoutMs);
    outcomes.push(format(outcome));
    if (outcomes.length > OUTCOMES_KEPT) outcomes.shift();
    if (outcome.replica) replicasSeen.add(outcome.replica);

    if (isAnswer(outcome)) {
      answersInARow += 1;
      if (outcome.replica) replicasInTheRow.add(outcome.replica);
      if (answersInARow >= inARow && replicasInTheRow.size === replicasSeen.size) {
        return { ok: true, elapsedMs: Date.now() - start, outcomes };
      }
    } else {
      answersInARow = 0;
      replicasInTheRow.clear();
      await new Promise(resolve => setTimeout(resolve, PAUSE_AFTER_FAILURE_MS));
    }
  }

  return { ok: false, elapsedMs: Date.now() - start, outcomes };
};
