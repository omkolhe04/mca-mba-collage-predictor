/**
 * Single shared Supabase client instance.
 * Uses the service role key because all writes/reads happen
 * server-side only (no client-side Supabase calls in this app).
 *
 * Import this wherever a repository needs DB or Storage access.
 * Never instantiate createClient() anywhere else.
 *
 * NOTE: supabase-js initializes a Realtime client internally by
 * default, which requires native WebSocket support (Node 22+)
 * or the `ws` package on earlier Node versions. This app never
 * uses Realtime (no live subscriptions anywhere), but we still
 * need to satisfy that internal initialization on Node 18/20 —
 * hence passing `ws` as the transport below. If this project is
 * later deployed on Node 22+, this remains harmless.
 */
'use strict';

const { createClient } = require('@supabase/supabase-js');
const ws = require('ws');
const env = require('./env');

const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
  realtime: {
    transport: ws,
  },
});

module.exports = supabase;
