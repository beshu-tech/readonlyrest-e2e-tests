import * as yaml from 'js-yaml';

export function parseKbnSettings(settings: string): object {
  const lines = settings.split('\n').filter(l => l.trim().length > 0);
  if (!lines.length) return {};
  const indent = Math.min(...lines.map(l => /^(\s*)/.exec(l)![1].length));
  return (yaml.load(lines.map(l => l.slice(indent)).join('\n')) as object) ?? {};
}
