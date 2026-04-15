/**
 * SQL safety layer for the run_sql_query tool.
 *
 * Uses node-sql-parser to parse SQL into an AST, then validates:
 * 1. Single statement only (no semicolon-separated multi-statements)
 * 2. Must be SELECT or WITH...SELECT (CTE ending in SELECT)
 * 3. No DML/DDL keywords anywhere
 * 4. No backup tables or system tables
 * 5. Must have a FROM clause
 * 6. Max 5000 characters
 * 7. Injects LIMIT 1000 via AST if no LIMIT present
 *
 * If node-sql-parser can't parse the query (Postgres-specific syntax),
 * we REJECT — the AI retries with simpler SQL. Defense-in-depth
 * (database-level transaction_read_only) is a safety net, not primary defense.
 */

import { Parser } from "node-sql-parser";

const MAX_SQL_LENGTH = 5000;
const MAX_LIMIT = 1000;

const BLOCKED_TABLES = new Set([
  "item_master_v1_backup",
  "supplier_code_v1_backup",
]);

const BLOCKED_KEYWORDS_RE =
  /\b(INSERT|UPDATE|DELETE|DROP|TRUNCATE|ALTER|CREATE|GRANT|REVOKE|COPY|EXECUTE|CALL|DO\s+\$|VACUUM|ANALYZE|REINDEX|LISTEN|NOTIFY|LOCK)\b/i;

export interface SqlValidationResult {
  ok: true;
  sanitizedSql: string;
} | {
  ok: false;
  reason: string;
}

/**
 * Recursively collect all table references from an AST node.
 */
function collectTableRefs(node: unknown, tables: Set<string>): void {
  if (!node || typeof node !== "object") return;

  // Check for table reference objects
  const n = node as Record<string, unknown>;
  if (n.table && typeof n.table === "string") {
    tables.add(n.table.toLowerCase());
  }
  if (n.schema && typeof n.schema === "string") {
    tables.add(n.schema.toLowerCase());
  }

  // Recurse into arrays and objects
  if (Array.isArray(node)) {
    for (const item of node) {
      collectTableRefs(item, tables);
    }
  } else {
    for (const value of Object.values(n)) {
      if (value && typeof value === "object") {
        collectTableRefs(value, tables);
      }
    }
  }
}

export function validateSql(sql: string): SqlValidationResult {
  // Length check
  if (sql.length > MAX_SQL_LENGTH) {
    return { ok: false, reason: "Query too long (max 5000 characters)." };
  }

  // Quick keyword check before parsing (catches obvious violations fast)
  if (BLOCKED_KEYWORDS_RE.test(sql)) {
    const match = sql.match(BLOCKED_KEYWORDS_RE);
    return {
      ok: false,
      reason: `Blocked keyword found: ${match?.[1]}. Only SELECT queries are allowed.`,
    };
  }

  // Parse the SQL
  const parser = new Parser();
  let ast;
  try {
    ast = parser.astify(sql, { database: "postgresql" });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return {
      ok: false,
      reason: `Could not parse query — try simpler SQL without advanced Postgres syntax (e.g., avoid custom operators, lateral joins). Error: ${msg}`,
    };
  }

  // Ensure single statement
  const statements = Array.isArray(ast) ? ast : [ast];
  if (statements.length > 1) {
    return { ok: false, reason: "Only one statement allowed (no semicolons)." };
  }

  const stmt = statements[0] as Record<string, unknown>;

  // Must be a SELECT
  if (stmt.type !== "select") {
    return {
      ok: false,
      reason: `Only SELECT statements allowed (got ${String(stmt.type)}).`,
    };
  }

  // Must have a FROM clause (reject "SELECT pg_sleep(60)" etc.)
  if (!stmt.from) {
    return {
      ok: false,
      reason: "Query must have a FROM clause.",
    };
  }

  // Collect all table references recursively
  const referencedTables = new Set<string>();
  collectTableRefs(stmt, referencedTables);

  // Check blocked tables
  for (const table of referencedTables) {
    if (BLOCKED_TABLES.has(table)) {
      return {
        ok: false,
        reason: `Backup table '${table}' is not queryable by the AI assistant.`,
      };
    }
    if (table.startsWith("pg_") || table.startsWith("information_schema")) {
      return {
        ok: false,
        reason: `System table '${table}' is not queryable.`,
      };
    }
  }

  // Inject LIMIT if not present — modify AST and re-emit
  try {
    // Check for existing limit
    const hasLimit =
      stmt.limit !== null && stmt.limit !== undefined;

    if (!hasLimit) {
      // Inject LIMIT into the AST
      (stmt as Record<string, unknown>).limit = {
        seperator: "",
        value: [
          {
            type: "number",
            value: MAX_LIMIT,
          },
        ],
      };
    } else {
      // If existing limit > MAX_LIMIT, cap it
      const limitNode = stmt.limit as Record<string, unknown>;
      if (limitNode.value && Array.isArray(limitNode.value)) {
        const valNode = limitNode.value[0] as Record<string, unknown>;
        if (valNode && typeof valNode.value === "number" && valNode.value > MAX_LIMIT) {
          valNode.value = MAX_LIMIT;
        }
      }
    }

    // Re-emit the SQL from the modified AST
    const sanitizedSql = parser.sqlify(statements.length === 1 ? stmt : statements, {
      database: "postgresql",
    });

    return { ok: true, sanitizedSql };
  } catch {
    // If sqlify fails, fall back to string-appending LIMIT
    // (less safe but better than no limit at all)
    const hasLimitKeyword = /\bLIMIT\s+\d+/i.test(sql);
    const sanitizedSql = hasLimitKeyword ? sql : `${sql} LIMIT ${MAX_LIMIT}`;
    return { ok: true, sanitizedSql };
  }
}
