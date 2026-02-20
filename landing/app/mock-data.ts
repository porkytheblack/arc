/* -------------------------------------------------------------------
 * Mock conversation data for the realistic Arc app clone.
 * Each entry mirrors the real app's timeline structure.
 * ----------------------------------------------------------------- */

export type MockMessageKind =
  | "user"
  | "agent_text"
  | "sql_result"
  | "chart"
  | "typing";

export interface MockSqlResult {
  sql: string;
  columns: string[];
  rows: (string | number | null)[][];
  rowCount: number;
  executionTimeMs: number;
}

export interface MockChartData {
  title: string;
  chartType: "bar" | "line" | "area" | "pie";
  data: { name: string; value: number }[];
}

export interface MockMessage {
  id: string;
  kind: MockMessageKind;
  text?: string;
  sqlResult?: MockSqlResult;
  chart?: MockChartData;
}

/* -------------------------------------------------------------------
 * Feature-specific conversations. Each array is shown in a different
 * section of the timeline scroll.
 * ----------------------------------------------------------------- */

export const nlQueryConversation: MockMessage[] = [
  {
    id: "nq-1",
    kind: "user",
    text: "What were our top 5 products by revenue last month?",
  },
  {
    id: "nq-2",
    kind: "agent_text",
    text: "I'll query the orders and products tables to find the top performers from January 2026.",
  },
  {
    id: "nq-3",
    kind: "sql_result",
    sqlResult: {
      sql: `SELECT p.name, SUM(oi.quantity * oi.unit_price) AS revenue
FROM order_items oi
JOIN products p ON p.id = oi.product_id
JOIN orders o ON o.id = oi.order_id
WHERE o.created_at >= '2026-01-01'
  AND o.created_at < '2026-02-01'
GROUP BY p.name
ORDER BY revenue DESC
LIMIT 5;`,
      columns: ["name", "revenue"],
      rows: [
        ["Wireless Pro Headphones", 48750],
        ["Ergonomic Desk Chair", 36200],
        ["4K Ultrawide Monitor", 31800],
        ["Mechanical Keyboard", 24100],
        ["USB-C Docking Station", 19400],
      ],
      rowCount: 5,
      executionTimeMs: 23,
    },
  },
  {
    id: "nq-4",
    kind: "agent_text",
    text: "Wireless Pro Headphones led with $48,750 in revenue. The top 5 products generated $160,250 combined.",
  },
];

export const dataTableConversation: MockMessage[] = [
  {
    id: "dt-1",
    kind: "user",
    text: "Show me all customers who signed up this week with their order counts.",
  },
  {
    id: "dt-2",
    kind: "agent_text",
    text: "Querying customer signups from the last 7 days with their order activity.",
  },
  {
    id: "dt-3",
    kind: "sql_result",
    sqlResult: {
      sql: `SELECT c.name, c.email, c.created_at,
       COUNT(o.id) AS orders, COALESCE(SUM(o.total), 0) AS spent
FROM customers c
LEFT JOIN orders o ON o.customer_id = c.id
WHERE c.created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY c.id, c.name, c.email, c.created_at
ORDER BY c.created_at DESC;`,
      columns: ["name", "email", "created_at", "orders", "spent"],
      rows: [
        ["Maria Santos", "maria@example.com", "2026-02-19", 2, 284.00],
        ["James Chen", "james.c@example.com", "2026-02-18", 1, 149.99],
        ["Aisha Patel", "aisha.p@example.com", "2026-02-18", 3, 512.50],
        ["Tom Eriksson", "tom.e@example.com", "2026-02-17", 0, 0],
        ["Lena Novak", "lena.n@example.com", "2026-02-16", 1, 89.99],
        ["Carlos Ruiz", "c.ruiz@example.com", "2026-02-15", 4, 723.00],
        ["Yuki Tanaka", "yuki.t@example.com", "2026-02-14", 2, 199.98],
        ["Sarah Kim", "s.kim@example.com", "2026-02-14", 0, 0],
      ],
      rowCount: 8,
      executionTimeMs: 18,
    },
  },
  {
    id: "dt-4",
    kind: "agent_text",
    text: "8 customers signed up in the last week. 6 of them have already placed orders. Carlos Ruiz is the most active with 4 orders totaling $723.",
  },
];

export const chartConversation: MockMessage[] = [
  {
    id: "ch-1",
    kind: "user",
    text: "Show me a chart of monthly revenue for the last 6 months.",
  },
  {
    id: "ch-2",
    kind: "agent_text",
    text: "I'll aggregate order totals by month and render a bar chart.",
  },
  {
    id: "ch-3",
    kind: "chart",
    chart: {
      title: "Monthly Revenue (Sep 2025 - Feb 2026)",
      chartType: "bar",
      data: [
        { name: "Sep", value: 142000 },
        { name: "Oct", value: 158000 },
        { name: "Nov", value: 187000 },
        { name: "Dec", value: 231000 },
        { name: "Jan", value: 196000 },
        { name: "Feb", value: 164000 },
      ],
    },
  },
  {
    id: "ch-4",
    kind: "agent_text",
    text: "December saw the highest revenue at $231K, likely driven by holiday sales. February is tracking at $164K with 10 days remaining.",
  },
];

export const multiDbConversation: MockMessage[] = [
  {
    id: "md-1",
    kind: "user",
    text: "What databases do I have connected?",
  },
  {
    id: "md-2",
    kind: "agent_text",
    text: "You have 4 connections configured in this project:",
  },
  {
    id: "md-3",
    kind: "agent_text",
    text: "- **production-pg** -- PostgreSQL on `db.internal:5432` (connected)\n- **analytics-mysql** -- MySQL on `analytics.internal:3306` (connected)\n- **local-dev** -- SQLite at `./dev.sqlite3` (connected)\n- **cache-redis** -- Redis on `redis.internal:6379` (connected)",
  },
];

export const queryLibConversation: MockMessage[] = [
  {
    id: "ql-1",
    kind: "user",
    text: "/monthly-revenue month=2026-01",
  },
  {
    id: "ql-2",
    kind: "agent_text",
    text: "Running saved query **monthly-revenue** with month = 2026-01.",
  },
  {
    id: "ql-3",
    kind: "sql_result",
    sqlResult: {
      sql: `-- Saved query: monthly-revenue
SELECT DATE(created_at) AS day,
       COUNT(*) AS orders,
       SUM(total) AS revenue
FROM orders
WHERE created_at >= '2026-01-01'
  AND created_at < '2026-02-01'
GROUP BY DATE(created_at)
ORDER BY day;`,
      columns: ["day", "orders", "revenue"],
      rows: [
        ["2026-01-01", 34, 4820],
        ["2026-01-02", 41, 5690],
        ["2026-01-03", 38, 5120],
        ["2026-01-04", 29, 3980],
        ["2026-01-05", 52, 7340],
      ],
      rowCount: 31,
      executionTimeMs: 12,
    },
  },
  {
    id: "ql-4",
    kind: "agent_text",
    text: "January 2026 totaled $196,000 across 1,247 orders. The busiest day was January 15 with 68 orders.",
  },
];

export const schemaConversation: MockMessage[] = [
  {
    id: "sc-1",
    kind: "user",
    text: "Show me the schema for the orders table.",
  },
  {
    id: "sc-2",
    kind: "agent_text",
    text: "Here is the schema for the `orders` table:\n\n| Column | Type | Attributes |\n|---|---|---|\n| id | uuid | PK, NOT NULL |\n| customer_id | uuid | FK -> customers.id, NOT NULL |\n| status | varchar(20) | NOT NULL, DEFAULT 'pending' |\n| total | decimal(10,2) | NOT NULL |\n| shipping_address_id | uuid | FK -> addresses.id |\n| created_at | timestamptz | NOT NULL, DEFAULT now() |\n| updated_at | timestamptz | NOT NULL |\n\nThe table has 142,387 rows and 3 indexes.",
  },
];

/* -------------------------------------------------------------------
 * Sidebar mock explorations
 * ----------------------------------------------------------------- */

export interface MockExploration {
  id: string;
  title: string;
  date: string;
  messageCount: number;
  active?: boolean;
}

export const mockExplorations: MockExploration[] = [
  {
    id: "exp-1",
    title: "January revenue analysis",
    date: "Feb 19",
    messageCount: 24,
    active: true,
  },
  {
    id: "exp-2",
    title: "Customer churn metrics",
    date: "Feb 17",
    messageCount: 12,
  },
  {
    id: "exp-3",
    title: "Product inventory check",
    date: "Feb 14",
    messageCount: 8,
  },
  {
    id: "exp-4",
    title: "Shipping cost breakdown",
    date: "Feb 10",
    messageCount: 31,
  },
  {
    id: "exp-5",
    title: "Q4 2025 summary",
    date: "Jan 28",
    messageCount: 45,
  },
];

/* -------------------------------------------------------------------
 * Connection cards for multi-database feature
 * ----------------------------------------------------------------- */

export interface MockConnection {
  name: string;
  dbType: "PostgreSQL" | "MySQL" | "SQLite" | "Redis";
  host: string;
  connected: boolean;
  tables?: number;
}

export const mockConnections: MockConnection[] = [
  {
    name: "production-pg",
    dbType: "PostgreSQL",
    host: "db.internal:5432",
    connected: true,
    tables: 47,
  },
  {
    name: "analytics-mysql",
    dbType: "MySQL",
    host: "analytics.internal:3306",
    connected: true,
    tables: 23,
  },
  {
    name: "local-dev",
    dbType: "SQLite",
    host: "./dev.sqlite3",
    connected: true,
    tables: 12,
  },
  {
    name: "cache-redis",
    dbType: "Redis",
    host: "redis.internal:6379",
    connected: true,
  },
];

/* -------------------------------------------------------------------
 * Feature section definitions
 * ----------------------------------------------------------------- */

export interface FeatureSection {
  id: string;
  label: string;
  title: string;
  description: string;
  conversation: MockMessage[];
}

export const featureSections: FeatureSection[] = [
  {
    id: "natural-language",
    label: "01",
    title: "Natural language queries",
    description:
      "Ask questions in plain English. Arc translates them to SQL, executes the query, and shows the results.",
    conversation: nlQueryConversation,
  },
  {
    id: "data-tables",
    label: "02",
    title: "Interactive data tables",
    description:
      "Results appear in sortable, paginated tables. Export to CSV with one click.",
    conversation: dataTableConversation,
  },
  {
    id: "inline-charts",
    label: "03",
    title: "Inline chart generation",
    description:
      "Arc renders charts directly in the conversation. Bar, line, area, and pie charts from your data.",
    conversation: chartConversation,
  },
  {
    id: "multi-database",
    label: "04",
    title: "Multi-database support",
    description:
      "Connect PostgreSQL, MySQL, SQLite, and Redis. Switch between connections in one project.",
    conversation: multiDbConversation,
  },
  {
    id: "query-library",
    label: "05",
    title: "Query library",
    description:
      "Save queries with parameters. Run them from the chat with slash commands like /monthly-revenue.",
    conversation: queryLibConversation,
  },
  {
    id: "schema-exploration",
    label: "06",
    title: "Schema exploration",
    description:
      "Browse tables, columns, types, and constraints. Arc knows your schema and uses it to write better queries.",
    conversation: schemaConversation,
  },
];
