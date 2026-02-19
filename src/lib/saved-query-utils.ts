import type { SavedQuery } from "./commands";

export type SavedQueryParamValue = string | number | boolean | null;
export type SavedQueryParams = Record<string, SavedQueryParamValue>;

const TEMPLATE_PARAM_RE = /\{\{\s*([a-zA-Z_][\w]*)\s*\}\}/g;
const COLON_PARAM_RE = /(^|[^:]):([a-zA-Z_][\w]*)/g;
const DOLLAR_NAMED_PARAM_RE = /\$([a-zA-Z_][\w]*)/g;
const DOLLAR_POSITIONAL_PARAM_RE = /\$([1-9]\d*)/g;
const QUESTION_PARAM_RE = /\?/g;

function normalizeKey(value: string): string {
  return value.trim().toLowerCase();
}

function sqlLiteral(value: SavedQueryParamValue): string {
  if (value === null) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "NULL";
  }
  if (typeof value === "boolean") {
    return value ? "TRUE" : "FALSE";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function getParam(params: SavedQueryParams, name: string): SavedQueryParamValue | undefined {
  if (Object.prototype.hasOwnProperty.call(params, name)) {
    return params[name];
  }

  const normalizedName = normalizeKey(name);
  for (const [k, v] of Object.entries(params)) {
    if (normalizeKey(k) === normalizedName) {
      return v;
    }
  }
  return undefined;
}

function collectParamNames(regex: RegExp, sql: string, names: Set<string>, mapName?: (raw: string) => string) {
  regex.lastIndex = 0;
  for (const match of sql.matchAll(regex)) {
    const raw = match[1];
    if (!raw) continue;
    names.add(mapName ? mapName(raw) : raw);
  }
}

export function extractSavedQueryParams(sql: string): string[] {
  const names = new Set<string>();

  collectParamNames(TEMPLATE_PARAM_RE, sql, names);
  collectParamNames(COLON_PARAM_RE, sql, names);
  collectParamNames(DOLLAR_NAMED_PARAM_RE, sql, names);
  collectParamNames(DOLLAR_POSITIONAL_PARAM_RE, sql, names, (n) => `param${n}`);

  let questionIndex = 0;
  QUESTION_PARAM_RE.lastIndex = 0;
  for (const _ of sql.matchAll(QUESTION_PARAM_RE)) {
    questionIndex += 1;
    names.add(`param${questionIndex}`);
  }

  return Array.from(names);
}

export function compileSavedQuerySql(
  sql: string,
  params: SavedQueryParams
): { sql: string; missing: string[] } {
  const missing = new Set<string>();
  let compiled = sql;

  const resolve = (name: string, rawToken: string): string => {
    const value = getParam(params, name);
    if (value === undefined) {
      missing.add(name);
      return rawToken;
    }
    return sqlLiteral(value);
  };

  compiled = compiled.replace(TEMPLATE_PARAM_RE, (token, name: string) =>
    resolve(name, token)
  );

  compiled = compiled.replace(COLON_PARAM_RE, (token, prefix: string, name: string) =>
    `${prefix}${resolve(name, `:${name}`)}`
  );

  compiled = compiled.replace(DOLLAR_NAMED_PARAM_RE, (token, name: string) =>
    resolve(name, token)
  );

  compiled = compiled.replace(DOLLAR_POSITIONAL_PARAM_RE, (token, index: string) =>
    resolve(`param${index}`, token)
  );

  let questionIndex = 0;
  compiled = compiled.replace(QUESTION_PARAM_RE, (token) => {
    questionIndex += 1;
    return resolve(`param${questionIndex}`, token);
  });

  return { sql: compiled, missing: Array.from(missing) };
}

export function normalizeSavedQueryRef(reference: string): string {
  return reference
    .trim()
    .replace(/^\/+/, "")
    .toLowerCase()
    .replace(/[_\s]+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export function slashAliasForSavedQuery(query: SavedQuery): string {
  return normalizeSavedQueryRef(query.name) || query.id;
}

export function findSavedQueryByReference(
  queries: SavedQuery[],
  reference: string
): SavedQuery | null {
  const raw = reference.trim().replace(/^\/+/, "");
  const normalized = normalizeSavedQueryRef(raw);
  const rawLower = raw.toLowerCase();

  for (const query of queries) {
    const nameLower = query.name.toLowerCase();
    if (query.id === raw || query.id.toLowerCase() === rawLower) {
      return query;
    }
    if (nameLower === rawLower || normalizeSavedQueryRef(query.name) === normalized) {
      return query;
    }
  }
  return null;
}
