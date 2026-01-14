import { pgTable, serial, text, integer, timestamp, boolean, jsonb, uniqueIndex, index, varchar } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// 2.1.1 repos
export const repos = pgTable('repos', {
  id: serial('id').primaryKey(),
  owner: text('owner').notNull(),
  name: text('name').notNull(),
  github_repo_id: integer('github_repo_id').notNull().unique(),
  default_branch: text('default_branch').default('main'),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// 2.1.2 github_events
export const githubEvents = pgTable('github_events', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id),
  delivery_id: text('delivery_id').notNull().unique(),
  event_type: text('event_type').notNull(), // issue, pull_request, etc
  action: text('action'), // opened, edited, etc
  signature_ok: boolean('signature_ok').default(false).notNull(),
  received_at: timestamp('received_at').defaultNow().notNull(),
  payload_json: jsonb('payload_json').notNull(),
  processed_at: timestamp('processed_at'),
  process_status: text('process_status').default('NEW').notNull(), // NEW, OK, ERROR
  process_error: text('process_error'),
}, (table) => {
  return {
    repoIdIdx: index('github_events_repo_id_idx').on(table.repo_id),
    receivedAtIdx: index('github_events_received_at_idx').on(table.received_at),
  };
});

// 2.1.3 issues
export const issues = pgTable('issues', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  github_issue_id: integer('github_issue_id').unique().notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  state: text('state').notNull(), // OPEN, CLOSED
  author_login: text('author_login').notNull(),
  assignees_json: jsonb('assignees_json'),
  labels_json: jsonb('labels_json'),
  priority: text('priority'), // P0, P1, P2, P3
  scope: text('scope'), // frontend, backend, infra, etc
  missing_fields_json: jsonb('missing_fields_json'),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
  closed_at: timestamp('closed_at'),
}, (table) => {
  return {
    repoStatePrioIdx: index('issues_repo_state_prio_idx').on(table.repo_id, table.state, table.priority),
  };
});

// 2.1.4 pull_requests
export const pullRequests = pgTable('pull_requests', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  github_pr_id: integer('github_pr_id').unique().notNull(),
  number: integer('number').notNull(),
  title: text('title').notNull(),
  state: text('state').notNull(), // OPEN, CLOSED, MERGED
  author_login: text('author_login').notNull(),
  base_branch: text('base_branch').notNull(),
  head_branch: text('head_branch').notNull(),
  draft: boolean('draft').default(false).notNull(),
  labels_json: jsonb('labels_json'),
  requested_reviewers_json: jsonb('requested_reviewers_json'),
  assignees_json: jsonb('assignees_json'),
  linked_issue_numbers_json: jsonb('linked_issue_numbers_json'),
  ci_status: text('ci_status'), // SUCCESS, FAILURE, RUNNING, UNKNOWN
  review_status: text('review_status'), // NEEDS_REVIEW, APPROVED, CHANGES_REQUESTED, UNKNOWN
  first_review_requested_at: timestamp('first_review_requested_at'),
  merged_at: timestamp('merged_at'),
  created_at: timestamp('created_at').notNull(),
  updated_at: timestamp('updated_at').notNull(),
}, (table) => {
  return {
    repoStateIdx: index('pr_repo_state_idx').on(table.repo_id, table.state),
  };
});

// 2.1.5 releases
export const releases = pgTable('releases', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  github_release_id: integer('github_release_id').unique().notNull(),
  tag_name: text('tag_name').notNull(),
  name: text('name'),
  target_commitish: text('target_commitish'),
  html_url: text('html_url').notNull(),
  published_at: timestamp('published_at'),
  created_at: timestamp('created_at').notNull(),
});

// 2.1.7 rules
export const rules = pgTable('rules', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  name: text('name').notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  priority: integer('priority').default(100).notNull(),
  event_type: text('event_type').notNull(),
  event_action: text('event_action'), // NULL = All actions
  condition_json: jsonb('condition_json').notNull(),
  actions_json: jsonb('actions_json').notNull(),
  cooldown_seconds: integer('cooldown_seconds').default(0).notNull(),
  created_by: text('created_by'),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// 2.1.8 rule_runs
export const ruleRuns = pgTable('rule_runs', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  rule_id: integer('rule_id').references(() => rules.id).notNull(),
  delivery_id: text('delivery_id').notNull(),
  entity_type: text('entity_type'), // ISSUE, PR, RELEASE
  entity_number: integer('entity_number'),
  result: text('result').notNull(), // APPLIED, SKIPPED, ERROR
  details_json: jsonb('details_json'),
  ran_at: timestamp('ran_at').defaultNow().notNull(),
}, (table) => {
  return {
    repoRuleIdx: index('rule_runs_repo_rule_idx').on(table.repo_id, table.rule_id),
  };
});

// 2.1.9 discord_messages
export const discordMessages = pgTable('discord_messages', {
  id: serial('id').primaryKey(),
  repo_id: integer('repo_id').references(() => repos.id).notNull(),
  channel_key: text('channel_key').notNull(), // dev, announcements
  dedupe_key: text('dedupe_key').notNull(),
  message_id: text('message_id'),
  content_hash: text('content_hash'),
  sent_at: timestamp('sent_at').defaultNow().notNull(),
}, (table) => {
  return {
    uniqueDedupe: uniqueIndex('discord_messages_dedupe_idx').on(table.repo_id, table.dedupe_key),
  };
});

// 2.1.10 users (Added based on improvement request)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  github_login: text('github_login').unique().notNull(),
  discord_user_id: text('discord_user_id'),
  role: text('role').default('MEMBER'), // MAINTAINER, MEMBER
  created_at: timestamp('created_at').defaultNow().notNull(),
});
