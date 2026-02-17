# Arc — Feature Outline

---

## Interface Structure

Arc is organized around **projects**. When you open Arc, you either select an existing project or create a new one. A project is a workspace scoped to a specific domain of your data — it holds your data sources, saved queries, explorations, and charts in one place.

### Project Workspace

When you open a project, you land on the **workspace home** — a centered view showing everything in the project at a glance: connected data sources, recent explorations, saved queries, and pinned charts. A top bar provides quick access to these categories.

### Sidebar Navigation

A vertical icon sidebar sits on the left edge. Each icon represents a different mode:

- **Workspace Home** *(active by default)* — The overview. Your data sources, saved queries, charts, and recent activity.
- **Explorations** — Opens a secondary sidebar listing all explorations in the project. Select one to open its conversation thread, or start a new one.
- **Charts** — A gallery of all charts generated across explorations, organized and filterable.
- **Query Library** — Browse and manage all named queries in the project.

### Explorations

An exploration is a conversation thread — the core interaction model. This is where you ask questions, run queries, view results, build charts, and execute operations. Each exploration maintains its own context and history. You can have many explorations open within a project, each investigating a different angle of your data.

When you select an exploration from the sidebar, the workspace transitions to the conversation interface. The full Glove runtime powers this view — every result, table, form, and chart renders inline as an interactive component.

---

## Features

### 1. Universal Database Connection

Connect Arc to any supported database with a connection string. Postgres, MySQL, SQLite, MongoDB, and more. Credentials are stored locally and never leave your machine.

A single project can hold **multiple database connections**. The agent has access to all of them simultaneously and can craft queries that pull from different sources within the same exploration. This is what makes Arc a workspace, not just a client — your data sources are unified under one roof.

---

### 2. Schema Introspection

Once connected, Arc reads your database schema automatically — tables, columns, types, indexes, foreign keys, constraints. This introspection builds an internal map that Arc uses to understand your data structure and generate accurate queries.

Introspection can be triggered manually at any time or scheduled to run on an interval. When your schema changes, Arc adapts. New tables appear, dropped columns disappear, and relationship maps update accordingly.

---

### 3. Conversational Querying

Ask questions about your data in plain language. Arc translates your intent into the appropriate query, executes it, and presents results through structured UI — tables, summaries, counts, or whatever format best fits the answer.

You don't need to know SQL (though you can write it directly if you prefer). Arc handles the translation and shows you the generated query alongside the results, so you always know exactly what ran.

---

### 4. Database Execution

Arc goes beyond read-only queries. Insert rows, update records, delete entries, modify schema — all through conversation. Destructive operations always surface a confirmation step before execution, showing you exactly what will change and how many rows are affected.

This turns Arc into a full database operations tool, not just a viewer. Migrations, data corrections, and bulk updates become conversational workflows.

---

### 5. Charts & Visualization

Arc renders charts directly in the conversation when visual representation serves the data better than a table. Line charts, bar charts, area charts, pie charts, scatter plots — the agent selects the appropriate type based on the shape of the result, or you can request a specific format.

Charts are interactive. Hover for values, zoom into ranges, toggle series on and off. Any chart can be pinned to the workspace home or saved to the project's chart gallery for quick reference later. Charts update live if the underlying query is re-run.

When you need to track something over time or compare dimensions, charts are the default output. When you need row-level detail, tables are. Arc chooses intelligently, and you can always switch between the two.

---

### 6. Rich Table Views

Query results render as interactive table components directly in the conversation. Sort by column, filter rows, resize columns, paginate through large result sets. Tables are not static output — they're live UI that you can manipulate after the query completes.

Different data shapes get different treatments. A single row might render as a detail card. An aggregate might render as a summary block. Arc chooses the right display component based on the result.

---

### 7. Forms & Input

When Arc needs structured input — inserting a new row, updating a record, providing filter parameters — it renders purpose-built forms inline. Fields are typed to match your schema (text, number, date, boolean, enum), with validation baked in.

Forms are not separate pages. They appear in the conversation flow, get filled out, and submit as part of the same thread. The result of the operation follows immediately.

---

### 8. Database Projects

Projects are the top-level organizational unit. Each project scopes a set of data sources, explorations, saved queries, and charts around a particular domain — "User analytics," "Order pipeline," "Migration audit," or whatever boundary makes sense for your work.

Inside a project, Arc maintains persistent context. The agent knows which databases are connected, what their schemas look like, which queries have been saved, and what you've explored before. Projects are where shallow questions become deep investigations.

---

### 9. Database Stats

Get a high-level overview of your connected databases at any time. Table counts, row counts, index health, disk usage, recent activity. Arc surfaces the operational metrics that tell you whether your database is healthy without you having to assemble the picture yourself.

Stats are available as a quick snapshot on the workspace home or as a more detailed diagnostic within an exploration. For teams managing production databases, this is the first thing you check when something feels off.

---

### 10. Query Scanner

Point Arc at your codebase and it identifies every database query embedded in your application code. Arc maps queries to the tables and columns they touch, flags potential issues (missing indexes, N+1 patterns, unused columns), and gives you a clear picture of how your application actually uses your database.

This bridges the gap between your code and your data. Instead of guessing which queries are slow or which tables are over-queried, you get a concrete map.

---

### 11. Table Linking

Explicitly link related tables so that Arc can reason across them — including across different databases within the same project. While Arc infers some relationships from foreign keys during introspection, table linking lets you define additional connections: logical relationships that don't exist as formal constraints but matter for analysis.

Once tables are linked, Arc can join data across them in response to questions, follow reference chains, and present multi-table results as unified views.

---

### 12. Named Queries

Save any query with a name and optional description. Named queries become reusable building blocks — call them by name in conversation, chain them together, or schedule them to run on an interval.

Named queries appear in the workspace home and in the dedicated query library view. In team contexts, a library of named queries becomes a shared vocabulary for talking about your data. "Run the churn check" means the same thing for everyone.

---

### 13. CSV Import

Drop a CSV file into Arc and it automatically creates a temporary, queryable table. Column types are inferred, headers become column names, and the data is immediately available for querying — alongside your connected databases.

CSV tables can be joined against your real database tables, used as lookup references, or analyzed independently. When you're done, the table is discarded. When you need it again, drop the file back in.

This makes Arc useful even without a database connection. Any tabular data becomes conversational.

---

*Each feature is delivered as a Glove tool — rendering its own UI, handling its own interaction, and participating in the conversational flow. No feature exists as a separate page or mode. Everything lives in the thread.*
