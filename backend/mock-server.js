/**
 * DropZone Mock API Server — runs on port 8080 with Node.js built-ins only.
 * Usage: node backend/mock-server.js
 */
const http = require('http');
const { URL } = require('url');

const PORT = 8080;
const MOCK_TOKEN = 'mock-admin-token-2026';

// ── In-memory state (mirrors dummy_data.sql) ────────────────────────────────

let brand = {
  name: 'DropZone Demo',
  tagline: 'Open a box every day!',
  logo: '',
  favicon: '',
  primary_color: '#6d28d9',
  accent_color: '#f59e0b',
  background_color: '#0b0b12',
  box_closed_image: '',
  box_opened_image: '',
  box_missed_image: '',
  reveal_style: 'confetti',
  welcome_headline: 'Open a box every day — win amazing rewards!',
  opened_message: 'Congratulations! You unlocked a reward!',
  missed_message: 'This drop has closed. Catch the next one!',
};

// Unique code pool (voucher_codes table)
let uniqueCodes = [
  { id: 1,  voucher_id: 5, code: 'GIFT-A1B2', used: 1, used_at: '2026-07-03T14:23:11Z' },
  { id: 2,  voucher_id: 5, code: 'GIFT-C3D4', used: 1, used_at: '2026-07-03T18:05:44Z' },
  { id: 3,  voucher_id: 5, code: 'GIFT-E5F6', used: 1, used_at: '2026-07-05T09:30:22Z' },
  { id: 4,  voucher_id: 5, code: 'GIFT-G7H8', used: 0, used_at: null },
  { id: 5,  voucher_id: 5, code: 'GIFT-I9J0', used: 0, used_at: null },
  { id: 6,  voucher_id: 5, code: 'GIFT-K1L2', used: 0, used_at: null },
  { id: 7,  voucher_id: 5, code: 'GIFT-M3N4', used: 0, used_at: null },
  { id: 8,  voucher_id: 5, code: 'GIFT-O5P6', used: 0, used_at: null },
  { id: 9,  voucher_id: 5, code: 'GIFT-Q7R8', used: 0, used_at: null },
  { id: 10, voucher_id: 5, code: 'GIFT-S9T0', used: 0, used_at: null },
];

let vouchers = [
  { id: 1, title: 'Free Coffee',          description: 'Redeem for a free medium coffee at any outlet.', type: 'coupon', value: 'Free medium coffee', code_mode: 'shared', shared_code: 'COFFEE-DZ', stock: null,  validity_days: 30,   active: 1, issued: 5, redeemed: 2, expired: 1 },
  { id: 2, title: '10% Off',               description: 'Get 10% off your next purchase — no minimum spend.', type: 'coupon', value: '10% off',  code_mode: 'shared', shared_code: 'SAVE10',    stock: 496,   validity_days: 14,   active: 1, issued: 4, redeemed: 0, expired: 0 },
  { id: 3, title: '50 Loyalty Points',     description: 'Earn 50 points added to your loyalty account.',   type: 'points', value: '50 pts',   code_mode: 'shared', shared_code: null,        stock: null,  validity_days: null, active: 1, issued: 4, redeemed: 1, expired: 0 },
  { id: 4, title: 'Gold Badge',            description: 'Unlock the exclusive Gold Collector badge.',       type: 'badge',  value: 'Gold Badge',code_mode: 'shared', shared_code: null,       stock: null,  validity_days: null, active: 1, issued: 2, redeemed: 0, expired: 0 },
  { id: 5, title: 'Surprise Gift',         description: 'A handpicked surprise gift — collect your unique code.', type: 'coupon', value: 'Surprise Gift', code_mode: 'unique', shared_code: null, stock: 97, validity_days: 60, active: 1, issued: 3, redeemed: 0, expired: 0 },
  { id: 6, title: 'Better Luck Next Time', description: 'Keep opening boxes for a chance to win!',          type: 'empty',  value: null,       code_mode: 'shared', shared_code: null,        stock: null,  validity_days: null, active: 1, issued: 0, redeemed: 0, expired: 0 },
];

let campaigns = [
  { id: 1, name: 'Summer Daily Adventure', description: 'Open a mystery box every day for 30 days and win exciting rewards.', type: 'daily',  duration_days: 30, custom_duration_days: null, grace_hours: 0, timezone: 'UTC', start_date: '2026-07-03', end_date: '2026-08-01', active: 1, drop_count: 30, enrolled: 5 },
  { id: 2, name: 'Weekly Winners',          description: 'Eight weeks of big weekly prizes — open your box any time during the week.', type: 'weekly', duration_days: 56, custom_duration_days: null, grace_hours: 2, timezone: 'UTC', start_date: '2026-07-01', end_date: '2026-08-25', active: 1, drop_count: 8,  enrolled: 2 },
];

// Drops for each campaign (pre-computed windows)
const campaignDrops = {
  1: [
    { id:  1, campaign_id: 1, drop_index:  1, period_index: 20635, reward_id: 1, title: 'Day 1',  open_at: '2026-07-03T00:00:00Z', close_at: '2026-07-03T23:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id:  2, campaign_id: 1, drop_index:  2, period_index: 20636, reward_id: 2, title: 'Day 2',  open_at: '2026-07-04T00:00:00Z', close_at: '2026-07-04T23:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id:  3, campaign_id: 1, drop_index:  3, period_index: 20637, reward_id: 3, title: 'Day 3',  open_at: '2026-07-05T00:00:00Z', close_at: '2026-07-05T23:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id:  4, campaign_id: 1, drop_index:  4, period_index: 20638, reward_id: 4, title: 'Day 4',  open_at: '2026-07-06T00:00:00Z', close_at: '2026-07-06T23:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id:  5, campaign_id: 1, drop_index:  5, period_index: 20639, reward_id: 5, title: 'Day 5',  open_at: '2026-07-07T00:00:00Z', close_at: '2026-07-07T23:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id:  6, campaign_id: 1, drop_index:  6, period_index: 20640, reward_id: 6, title: 'Day 6',  open_at: '2026-07-08T00:00:00Z', close_at: '2026-07-08T23:59:59Z', reward_title: 'Better Luck Next Time', reward_type: 'empty' },
    { id:  7, campaign_id: 1, drop_index:  7, period_index: 20641, reward_id: 1, title: 'Day 7',  open_at: '2026-07-09T00:00:00Z', close_at: '2026-07-09T23:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id:  8, campaign_id: 1, drop_index:  8, period_index: 20642, reward_id: 2, title: 'Day 8',  open_at: '2026-07-10T00:00:00Z', close_at: '2026-07-10T23:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id:  9, campaign_id: 1, drop_index:  9, period_index: 20643, reward_id: 3, title: 'Day 9',  open_at: '2026-07-11T00:00:00Z', close_at: '2026-07-11T23:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 10, campaign_id: 1, drop_index: 10, period_index: 20644, reward_id: 4, title: 'Day 10', open_at: '2026-07-12T00:00:00Z', close_at: '2026-07-12T23:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id: 11, campaign_id: 1, drop_index: 11, period_index: 20645, reward_id: 5, title: 'Day 11', open_at: '2026-07-13T00:00:00Z', close_at: '2026-07-13T23:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id: 12, campaign_id: 1, drop_index: 12, period_index: 20646, reward_id: 6, title: 'Day 12', open_at: '2026-07-14T00:00:00Z', close_at: '2026-07-14T23:59:59Z', reward_title: 'Better Luck Next Time', reward_type: 'empty' },
    { id: 13, campaign_id: 1, drop_index: 13, period_index: 20647, reward_id: 1, title: 'Day 13', open_at: '2026-07-15T00:00:00Z', close_at: '2026-07-15T23:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id: 14, campaign_id: 1, drop_index: 14, period_index: 20648, reward_id: 2, title: 'Day 14', open_at: '2026-07-16T00:00:00Z', close_at: '2026-07-16T23:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id: 15, campaign_id: 1, drop_index: 15, period_index: 20649, reward_id: 3, title: 'Day 15', open_at: '2026-07-17T00:00:00Z', close_at: '2026-07-17T23:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 16, campaign_id: 1, drop_index: 16, period_index: 20650, reward_id: 4, title: 'Day 16', open_at: '2026-07-18T00:00:00Z', close_at: '2026-07-18T23:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id: 17, campaign_id: 1, drop_index: 17, period_index: 20651, reward_id: 5, title: 'Day 17', open_at: '2026-07-19T00:00:00Z', close_at: '2026-07-19T23:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id: 18, campaign_id: 1, drop_index: 18, period_index: 20652, reward_id: 6, title: 'Day 18', open_at: '2026-07-20T00:00:00Z', close_at: '2026-07-20T23:59:59Z', reward_title: 'Better Luck Next Time', reward_type: 'empty' },
    { id: 19, campaign_id: 1, drop_index: 19, period_index: 20653, reward_id: 1, title: 'Day 19', open_at: '2026-07-21T00:00:00Z', close_at: '2026-07-21T23:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id: 20, campaign_id: 1, drop_index: 20, period_index: 20654, reward_id: 2, title: 'Day 20', open_at: '2026-07-22T00:00:00Z', close_at: '2026-07-22T23:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id: 21, campaign_id: 1, drop_index: 21, period_index: 20655, reward_id: 3, title: 'Day 21', open_at: '2026-07-23T00:00:00Z', close_at: '2026-07-23T23:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 22, campaign_id: 1, drop_index: 22, period_index: 20656, reward_id: 4, title: 'Day 22', open_at: '2026-07-24T00:00:00Z', close_at: '2026-07-24T23:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id: 23, campaign_id: 1, drop_index: 23, period_index: 20657, reward_id: 5, title: 'Day 23', open_at: '2026-07-25T00:00:00Z', close_at: '2026-07-25T23:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id: 24, campaign_id: 1, drop_index: 24, period_index: 20658, reward_id: 6, title: 'Day 24', open_at: '2026-07-26T00:00:00Z', close_at: '2026-07-26T23:59:59Z', reward_title: 'Better Luck Next Time', reward_type: 'empty' },
    { id: 25, campaign_id: 1, drop_index: 25, period_index: 20659, reward_id: 1, title: 'Day 25', open_at: '2026-07-27T00:00:00Z', close_at: '2026-07-27T23:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id: 26, campaign_id: 1, drop_index: 26, period_index: 20660, reward_id: 2, title: 'Day 26', open_at: '2026-07-28T00:00:00Z', close_at: '2026-07-28T23:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id: 27, campaign_id: 1, drop_index: 27, period_index: 20661, reward_id: 3, title: 'Day 27', open_at: '2026-07-29T00:00:00Z', close_at: '2026-07-29T23:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 28, campaign_id: 1, drop_index: 28, period_index: 20662, reward_id: 4, title: 'Day 28', open_at: '2026-07-30T00:00:00Z', close_at: '2026-07-30T23:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id: 29, campaign_id: 1, drop_index: 29, period_index: 20663, reward_id: 5, title: 'Day 29', open_at: '2026-07-31T00:00:00Z', close_at: '2026-07-31T23:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id: 30, campaign_id: 1, drop_index: 30, period_index: 20664, reward_id: 6, title: 'Day 30', open_at: '2026-08-01T00:00:00Z', close_at: '2026-08-01T23:59:59Z', reward_title: 'Better Luck Next Time', reward_type: 'empty' },
  ],
  2: [
    { id: 31, campaign_id: 2, drop_index: 1, period_index: 2947, reward_id: 2, title: 'Week 1', open_at: '2026-07-01T00:00:00Z', close_at: '2026-07-08T01:59:59Z', reward_title: '10% Off',           reward_type: 'coupon' },
    { id: 32, campaign_id: 2, drop_index: 2, period_index: 2948, reward_id: 3, title: 'Week 2', open_at: '2026-07-08T00:00:00Z', close_at: '2026-07-15T01:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 33, campaign_id: 2, drop_index: 3, period_index: 2949, reward_id: 4, title: 'Week 3', open_at: '2026-07-15T00:00:00Z', close_at: '2026-07-22T01:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
    { id: 34, campaign_id: 2, drop_index: 4, period_index: 2950, reward_id: 5, title: 'Week 4', open_at: '2026-07-22T00:00:00Z', close_at: '2026-07-29T01:59:59Z', reward_title: 'Surprise Gift',      reward_type: 'coupon' },
    { id: 35, campaign_id: 2, drop_index: 5, period_index: 2951, reward_id: 1, title: 'Week 5', open_at: '2026-07-29T00:00:00Z', close_at: '2026-08-05T01:59:59Z', reward_title: 'Free Coffee',       reward_type: 'coupon' },
    { id: 36, campaign_id: 2, drop_index: 6, period_index: 2952, reward_id: 2, title: 'Week 6', open_at: '2026-08-05T00:00:00Z', close_at: '2026-08-12T01:59:59Z', reward_title: '10% Off',            reward_type: 'coupon' },
    { id: 37, campaign_id: 2, drop_index: 7, period_index: 2953, reward_id: 3, title: 'Week 7', open_at: '2026-08-12T00:00:00Z', close_at: '2026-08-19T01:59:59Z', reward_title: '50 Loyalty Points',  reward_type: 'points' },
    { id: 38, campaign_id: 2, drop_index: 8, period_index: 2954, reward_id: 4, title: 'Week 8', open_at: '2026-08-19T00:00:00Z', close_at: '2026-08-26T01:59:59Z', reward_title: 'Gold Badge',         reward_type: 'badge'  },
  ],
};

let users = [
  { id: 1, name: 'John Doe',     identifier: 'john@demo.test',  created_at: '2026-07-02T20:00:00Z', campaigns: 2, rewards: 5 },
  { id: 2, name: 'Priya Sharma', identifier: 'priya@demo.test', created_at: '2026-07-02T21:30:00Z', campaigns: 2, rewards: 3 },
  { id: 3, name: 'Rahul Verma',  identifier: 'rahul@demo.test', created_at: '2026-07-03T07:45:00Z', campaigns: 1, rewards: 0 },
  { id: 4, name: 'Alice Tan',    identifier: 'alice@demo.test', created_at: '2026-07-02T18:00:00Z', campaigns: 1, rewards: 3 },
  { id: 5, name: 'Bob Lim',      identifier: '+6591234567',     created_at: '2026-07-09T08:15:00Z', campaigns: 1, rewards: 0 },
];

const userDetail = {
  1: {
    id: 1, name: 'John Doe', identifier: 'john@demo.test', created_at: '2026-07-02T20:00:00Z',
    enrollments: [
      { campaign_id: 1, campaign_name: 'Summer Daily Adventure', status: 'active', joined_at: '2026-07-02T20:05:00Z' },
      { campaign_id: 2, campaign_name: 'Weekly Winners',          status: 'active', joined_at: '2026-07-01T10:00:00Z' },
    ],
    boxes: [
      { drop_title: 'Day 1', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-03T14:23:11Z', reward: 'Free Coffee (COFFEE-DZ)' },
      { drop_title: 'Day 2', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-04T09:08:55Z', reward: '10% Off (SAVE10)' },
      { drop_title: 'Day 3', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-05T20:44:02Z', reward: '50 Loyalty Points' },
      { drop_title: 'Day 4', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-06T11:31:19Z', reward: 'Gold Badge' },
      { drop_title: 'Day 5', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-07T08:02:33Z', reward: 'Surprise Gift (GIFT-A1B2)' },
      { drop_title: 'Day 6', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-08T16:22:07Z', reward: '— empty' },
      { drop_title: 'Day 7', campaign: 'Summer Daily Adventure', status: 'available', opened_at: null, reward: null },
      { drop_title: 'Week 1', campaign: 'Weekly Winners', status: 'opened', opened_at: '2026-07-05T16:00:00Z', reward: '10% Off (SAVE10)' },
      { drop_title: 'Week 2', campaign: 'Weekly Winners', status: 'available', opened_at: null, reward: null },
    ],
    reward_issues: [
      { id: 1,  reward_id: 1, reward: 'Free Coffee',       code: 'COFFEE-DZ', status: 'redeemed', issued_at: '2026-07-03T14:23:12Z', expires_at: '2026-08-02T14:23:12Z' },
      { id: 2,  reward_id: 2, reward: '10% Off',           code: 'SAVE10',    status: 'issued',   issued_at: '2026-07-04T09:08:56Z', expires_at: '2026-07-18T09:08:56Z' },
      { id: 3,  reward_id: 3, reward: '50 Loyalty Points', code: null,        status: 'redeemed', issued_at: '2026-07-05T20:44:03Z', expires_at: null },
      { id: 4,  reward_id: 4, reward: 'Gold Badge',        code: null,        status: 'issued',   issued_at: '2026-07-06T11:31:20Z', expires_at: null },
      { id: 5,  reward_id: 5, reward: 'Surprise Gift',     code: 'GIFT-A1B2', status: 'issued',   issued_at: '2026-07-07T08:02:34Z', expires_at: '2026-09-05T08:02:34Z' },
      { id: 12, reward_id: 2, reward: '10% Off',           code: 'SAVE10',    status: 'issued',   issued_at: '2026-07-05T16:00:01Z', expires_at: '2026-07-19T16:00:01Z' },
    ],
  },
  2: {
    id: 2, name: 'Priya Sharma', identifier: 'priya@demo.test', created_at: '2026-07-02T21:30:00Z',
    enrollments: [
      { campaign_id: 1, campaign_name: 'Summer Daily Adventure', status: 'active', joined_at: '2026-07-02T21:35:00Z' },
      { campaign_id: 2, campaign_name: 'Weekly Winners',          status: 'active', joined_at: '2026-07-01T11:00:00Z' },
    ],
    boxes: [
      { drop_title: 'Day 1', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-03T19:11:00Z', reward: 'Free Coffee (COFFEE-DZ)' },
      { drop_title: 'Day 2', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
      { drop_title: 'Day 3', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-05T12:55:30Z', reward: '50 Loyalty Points' },
      { drop_title: 'Day 4', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
      { drop_title: 'Day 5', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-07T22:40:18Z', reward: 'Surprise Gift (GIFT-C3D4)' },
      { drop_title: 'Day 6', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
      { drop_title: 'Day 7', campaign: 'Summer Daily Adventure', status: 'available', opened_at: null, reward: null },
    ],
    reward_issues: [
      { id: 6, reward_id: 1, reward: 'Free Coffee',       code: 'COFFEE-DZ', status: 'issued', issued_at: '2026-07-03T19:11:01Z', expires_at: '2026-08-02T19:11:01Z' },
      { id: 7, reward_id: 3, reward: '50 Loyalty Points', code: null,        status: 'issued', issued_at: '2026-07-05T12:55:31Z', expires_at: null },
      { id: 8, reward_id: 5, reward: 'Surprise Gift',     code: 'GIFT-C3D4', status: 'issued', issued_at: '2026-07-07T22:40:19Z', expires_at: '2026-09-05T22:40:19Z' },
    ],
  },
  3: { id: 3, name: 'Rahul Verma', identifier: 'rahul@demo.test', created_at: '2026-07-03T07:45:00Z', enrollments: [{ campaign_id: 1, campaign_name: 'Summer Daily Adventure', status: 'active', joined_at: '2026-07-03T07:50:00Z' }], boxes: [], reward_issues: [] },
  4: {
    id: 4, name: 'Alice Tan', identifier: 'alice@demo.test', created_at: '2026-07-02T18:00:00Z',
    enrollments: [{ campaign_id: 1, campaign_name: 'Summer Daily Adventure', status: 'active', joined_at: '2026-07-02T18:10:00Z' }],
    boxes: [
      { drop_title: 'Day 1', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-03T10:00:01Z', reward: 'Free Coffee (COFFEE-DZ)' },
      { drop_title: 'Day 2', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-04T15:33:00Z', reward: '10% Off (SAVE10)' },
      { drop_title: 'Day 3', campaign: 'Summer Daily Adventure', status: 'opened', opened_at: '2026-07-05T08:20:45Z', reward: '50 Loyalty Points' },
      { drop_title: 'Day 4', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
      { drop_title: 'Day 5', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
      { drop_title: 'Day 6', campaign: 'Summer Daily Adventure', status: 'missed', opened_at: null, reward: null },
    ],
    reward_issues: [
      { id: 9,  reward_id: 1, reward: 'Free Coffee',       code: 'COFFEE-DZ', status: 'expired', issued_at: '2026-07-03T10:00:02Z', expires_at: '2026-07-03T23:59:59Z' },
      { id: 10, reward_id: 2, reward: '10% Off',           code: 'SAVE10',    status: 'issued',  issued_at: '2026-07-04T15:33:01Z', expires_at: '2026-07-18T15:33:01Z' },
      { id: 11, reward_id: 3, reward: '50 Loyalty Points', code: null,        status: 'issued',  issued_at: '2026-07-05T08:20:46Z', expires_at: null },
    ],
  },
  5: { id: 5, name: 'Bob Lim', identifier: '+6591234567', created_at: '2026-07-09T08:15:00Z', enrollments: [{ campaign_id: 1, campaign_name: 'Summer Daily Adventure', status: 'active', joined_at: '2026-07-09T08:20:00Z' }], boxes: [], reward_issues: [] },
};

// Tracks which drop each user has opened: { [userId]: { [dropId]: { opened_at, reward, reward_id } } }
// Pre-seeded to match the dummy_data.sql history so reloads show the correct state.
const openedBoxes = {
  1: {
    1:  { opened_at: '2026-07-03T14:23:11Z', reward_id: 1, reward: { title: 'Free Coffee',       type: 'coupon', value: 'Free medium coffee', image: null, code: 'COFFEE-DZ', expires_at: '2026-08-02T14:23:12Z' } },
    2:  { opened_at: '2026-07-04T09:08:55Z', reward_id: 2, reward: { title: '10% Off',            type: 'coupon', value: '10% off',            image: null, code: 'SAVE10',    expires_at: '2026-07-18T09:08:56Z' } },
    3:  { opened_at: '2026-07-05T20:44:02Z', reward_id: 3, reward: { title: '50 Loyalty Points',  type: 'points', value: '50 pts',             image: null, code: null,        expires_at: null } },
    4:  { opened_at: '2026-07-06T11:31:19Z', reward_id: 4, reward: { title: 'Gold Badge',         type: 'badge',  value: 'Gold Badge',         image: null, code: null,        expires_at: null } },
    5:  { opened_at: '2026-07-07T08:02:33Z', reward_id: 5, reward: { title: 'Surprise Gift',      type: 'coupon', value: 'Surprise Gift',      image: null, code: 'GIFT-A1B2', expires_at: '2026-09-05T08:02:34Z' } },
    6:  { opened_at: '2026-07-08T16:22:07Z', reward_id: 6, reward: null },
    31: { opened_at: '2026-07-05T16:00:00Z', reward_id: 2, reward: { title: '10% Off',            type: 'coupon', value: '10% off',            image: null, code: 'SAVE10',    expires_at: '2026-07-19T16:00:01Z' } },
  },
  2: {
    1:  { opened_at: '2026-07-03T19:11:00Z', reward_id: 1, reward: { title: 'Free Coffee',        type: 'coupon', value: 'Free medium coffee', image: null, code: 'COFFEE-DZ', expires_at: '2026-08-02T19:11:01Z' } },
    3:  { opened_at: '2026-07-05T12:55:30Z', reward_id: 3, reward: { title: '50 Loyalty Points',  type: 'points', value: '50 pts',             image: null, code: null,        expires_at: null } },
    5:  { opened_at: '2026-07-07T22:40:18Z', reward_id: 5, reward: { title: 'Surprise Gift',      type: 'coupon', value: 'Surprise Gift',      image: null, code: 'GIFT-C3D4', expires_at: '2026-09-05T22:40:19Z' } },
  },
  4: {
    1:  { opened_at: '2026-07-03T10:00:01Z', reward_id: 1, reward: { title: 'Free Coffee',        type: 'coupon', value: 'Free medium coffee', image: null, code: 'COFFEE-DZ', expires_at: '2026-08-02T10:00:02Z' } },
    2:  { opened_at: '2026-07-04T15:33:00Z', reward_id: 2, reward: { title: '10% Off',            type: 'coupon', value: '10% off',            image: null, code: 'SAVE10',    expires_at: '2026-07-18T15:33:01Z' } },
    3:  { opened_at: '2026-07-05T08:20:45Z', reward_id: 3, reward: { title: '50 Loyalty Points',  type: 'points', value: '50 pts',             image: null, code: null,        expires_at: null } },
  },
};

let nextRewardIssueId = 13;

let whatsappSettings = { mode: 'simulation', phone_number_id: '', access_token: '', verify_token: 'dz-verify-token-2026', business_acct_id: '' };

let whatsappTemplates = [
  { id: 1, name: 'drop_reminder',       language: 'en', category: 'MARKETING', body: 'Hi {{1}}! Your daily DropZone box is open right now. Tap to open it before midnight! 🎁',    status: 'approved' },
  { id: 2, name: 'reward_issued',        language: 'en', category: 'MARKETING', body: 'Great news {{1}}! You just won: {{2}}. Use code {{3}} before it expires. 🎉',                 status: 'approved' },
  { id: 3, name: 'enrollment_welcome',   language: 'en', category: 'MARKETING', body: 'Welcome to DropZone, {{1}}! Your first box opens tomorrow at midnight. Stay tuned! 📦',       status: 'approved' },
  { id: 4, name: 'campaign_launch',      language: 'en', category: 'MARKETING', body: 'A new campaign is live on DropZone! Join now and start winning daily rewards. 🚀',            status: 'draft'    },
];

let whatsappMessages = [
  { id: 1, template_id: 3, template_name: 'enrollment_welcome', body: 'Welcome to DropZone! Your first box opens tomorrow at midnight. Stay tuned! 📦', audience: 'All users', recipients: 4, status: 'simulated', sent_by: 'admin@dropzone.test', created_at: '2026-07-02T22:00:00Z' },
  { id: 2, template_id: 1, template_name: 'drop_reminder',      body: 'Hi there! Your daily DropZone box is open right now. Tap to open it before midnight! 🎁', audience: 'All users', recipients: 5, status: 'simulated', sent_by: 'manager@dropzone.test', created_at: '2026-07-09T08:00:00Z' },
  { id: 3, template_id: null, template_name: null,               body: 'Big week ahead — new rewards unlocked in the Weekly Winners campaign! 🏆', audience: 'Campaign 2 users', recipients: 2, status: 'simulated', sent_by: 'admin@dropzone.test', created_at: '2026-07-08T09:00:00Z' },
];

let nextId = { voucher: 7, campaign: 3, template: 5, message: 4, user: 6, drop: 39 };

// ── Drop generation (mirrors DropEngine::generateDrops) ──────────────────────
function generateDrops(campaign) {
  const type = campaign.type || 'daily';
  const duration = Number(campaign.custom_duration_days || campaign.duration_days || 30);
  const grace = Number(campaign.grace_hours || 0);
  const startDate = campaign.start_date || new Date().toISOString().slice(0, 10);
  const startMs = new Date(startDate + 'T00:00:00Z').getTime();

  let count;
  if (type === 'weekly')       count = Math.ceil(duration / 7);
  else if (type === 'monthly') count = Math.max(1, Math.floor(duration / 30));
  else                         count = duration;

  const graceMs = grace * 3600 * 1000;
  const drops = [];

  for (let i = 1; i <= count; i++) {
    let openMs, closeMs, title, period_index;

    if (type === 'weekly') {
      openMs  = startMs + (i - 1) * 7 * 86400000;
      closeMs = openMs + 7 * 86400000 - 1000 + graceMs;
      title   = `Week ${i}`;
      period_index = Math.floor(openMs / (7 * 86400000));
    } else if (type === 'monthly') {
      const d = new Date(startDate + 'T00:00:00Z');
      d.setUTCMonth(d.getUTCMonth() + (i - 1));
      openMs = d.getTime();
      d.setUTCMonth(d.getUTCMonth() + 1);
      d.setUTCSeconds(d.getUTCSeconds() - 1);
      closeMs = d.getTime() + graceMs;
      title   = `Month ${i}`;
      const od = new Date(openMs);
      period_index = od.getUTCFullYear() * 12 + od.getUTCMonth();
    } else {
      openMs  = startMs + (i - 1) * 86400000;
      closeMs = openMs + 86400000 - 1000 + graceMs;
      title   = `Day ${i}`;
      period_index = Math.floor(openMs / 86400000);
    }

    drops.push({
      id: nextId.drop++,
      campaign_id: campaign.id,
      drop_index:  i,
      period_index,
      reward_id:    null,
      title,
      image:        null,
      open_at:  new Date(openMs).toISOString(),
      close_at: new Date(closeMs).toISOString(),
      reward_title: null,
      reward_type:  null,
    });
  }

  // Compute end_date from last drop's close_at
  if (drops.length) {
    const idx = campaigns.findIndex((c) => c.id === campaign.id);
    if (idx !== -1) {
      campaigns[idx].end_date = drops[drops.length - 1].close_at.slice(0, 10);
      campaigns[idx].drop_count = drops.length;
    }
  }
  return drops;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-User-Id,X-User-Identifier,Idempotency-Key');
}

function json(res, data, status = 200) {
  cors(res);
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

function err(res, code, message, status = 400) {
  json(res, { error: code, message }, status);
}

function readBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      try { resolve(raw ? JSON.parse(raw) : {}); }
      catch (e) { console.error('[readBody] JSON parse failed:', e.message.slice(0, 120)); resolve({}); }
    });
  });
}

function requireAuth(req, res) {
  const auth = req.headers['authorization'] || '';
  if (!auth.startsWith('Bearer ')) { err(res, 'unauthorized', 'Missing token', 401); return false; }
  return true;
}

// ── Route handler ─────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // Preflight
  if (method === 'OPTIONS') { cors(res); res.writeHead(204); res.end(); return; }

  // ── Health ──────────────────────────────────────────────────────────────────
  if (path === '/api/health' && method === 'GET') {
    return json(res, { status: 'ok', time: new Date().toISOString() });
  }

  // ── Admin login ─────────────────────────────────────────────────────────────
  if (path === '/api/admin/login' && method === 'POST') {
    const body = await readBody(req);
    if (!body.email || !body.password) return err(res, 'validation', 'Email and password required');
    if (body.password !== 'password' && body.password !== 'dropzone123') {
      return err(res, 'invalid_credentials', 'Invalid email or password', 401);
    }
    return json(res, { token: MOCK_TOKEN, admin: { email: body.email, name: 'Demo Admin', role: 'owner' } });
  }

  // ── Admin logout ────────────────────────────────────────────────────────────
  if (path === '/api/admin/logout' && method === 'POST') {
    return json(res, { ok: true });
  }

  // ── Brand ───────────────────────────────────────────────────────────────────
  if (path === '/api/admin/brand') {
    if (!requireAuth(req, res)) return;
    if (method === 'GET') return json(res, brand);
    if (method === 'PUT') {
      const body = await readBody(req);
      brand = { ...brand, ...body };
      return json(res, brand);
    }
  }

  // ── Upload (mock: echo the data URL back so the image renders immediately) ──
  if (path === '/api/admin/upload' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    // Return the base64 data URL directly — no filesystem needed in mock mode.
    if (body.data && body.data.startsWith('data:')) {
      return json(res, { url: body.data });
    }
    return json(res, { url: '/uploads/mock-image.png' });
  }

  // ── Vouchers ─────────────────────────────────────────────────────────────────
  if (path === '/api/admin/vouchers') {
    if (!requireAuth(req, res)) return;
    if (method === 'GET') return json(res, { vouchers });
    if (method === 'POST') {
      const body = await readBody(req);
      const v = { id: nextId.voucher++, issued: 0, redeemed: 0, expired: 0, active: 1, ...body };
      vouchers.push(v);
      return json(res, { voucher: v }, 201);
    }
  }
  const voucherMatch = path.match(/^\/api\/admin\/vouchers\/(\d+)$/);
  if (voucherMatch) {
    if (!requireAuth(req, res)) return;
    const id = Number(voucherMatch[1]);
    const idx = vouchers.findIndex((v) => v.id === id);
    if (idx === -1) return err(res, 'not_found', 'Voucher not found', 404);
    if (method === 'PUT') {
      const body = await readBody(req);
      vouchers[idx] = { ...vouchers[idx], ...body, id };
      return json(res, { voucher: vouchers[idx] });
    }
    if (method === 'DELETE') {
      vouchers.splice(idx, 1);
      return json(res, { ok: true });
    }
  }

  // ── Campaigns ────────────────────────────────────────────────────────────────
  if (path === '/api/admin/campaigns' || path === '/api/campaigns/active') {
    if (path.startsWith('/api/admin') && !requireAuth(req, res)) return;
    if (method === 'GET') {
      const payload = { campaigns };
      if (path === '/api/campaigns/active') {
        const now = new Date().toISOString().slice(0, 10);
        const active = campaigns
          .filter((c) => c.active && c.start_date <= now)
          .sort((a, b) => new Date(b.start_date) - new Date(a.start_date));
        return json(res, { campaigns: active, brand });
      }
      return json(res, payload);
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const c = { id: nextId.campaign++, drop_count: 0, enrolled: 0, active: 1, end_date: null, ...body };
      campaigns.push(c);
      campaignDrops[c.id] = generateDrops(c);
      return json(res, { id: c.id, campaign: campaigns.find((x) => x.id === c.id) }, 201);
    }
  }

  const campaignMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)$/);
  if (campaignMatch) {
    if (!requireAuth(req, res)) return;
    const id = Number(campaignMatch[1]);
    const idx = campaigns.findIndex((c) => c.id === id);
    if (method === 'GET') {
      if (idx === -1) return err(res, 'not_found', 'Campaign not found', 404);
      return json(res, { campaign: campaigns[idx] });
    }
    if (method === 'PUT') {
      const body = await readBody(req);
      if (idx === -1) return err(res, 'not_found', 'Campaign not found', 404);
      campaigns[idx] = { ...campaigns[idx], ...body, id };
      return json(res, { campaign: campaigns[idx] });
    }
    if (method === 'DELETE') {
      if (idx !== -1) campaigns.splice(idx, 1);
      return json(res, { ok: true });
    }
  }

  const dropsMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)\/drops$/);
  if (dropsMatch && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const id = Number(dropsMatch[1]);
    return json(res, { drops: campaignDrops[id] || [] });
  }

  const bulkDropsMatch = path.match(/^\/api\/admin\/campaigns\/(\d+)\/drops\/bulk$/);
  if (bulkDropsMatch && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const cid = Number(bulkDropsMatch[1]);
    const campaign = campaigns.find((c) => c.id === cid);
    if (campaign) campaignDrops[cid] = generateDrops(campaign);
    return json(res, { ok: true, count: (campaignDrops[cid] || []).length });
  }

  const dropMatch = path.match(/^\/api\/admin\/drops\/(\d+)$/);
  if (dropMatch && method === 'PUT') {
    if (!requireAuth(req, res)) return;
    const id = Number(dropMatch[1]);
    const body = await readBody(req);
    for (const cid of Object.keys(campaignDrops)) {
      const idx = campaignDrops[cid].findIndex((d) => d.id === id);
      if (idx !== -1) {
        campaignDrops[cid][idx] = { ...campaignDrops[cid][idx], ...body };
        if (body.reward_id) {
          const v = vouchers.find((v) => v.id === body.reward_id);
          if (v) { campaignDrops[cid][idx].reward_title = v.title; campaignDrops[cid][idx].reward_type = v.type; campaignDrops[cid][idx].reward_image = v.image || null; }
        }
        return json(res, { drop: campaignDrops[cid][idx] });
      }
    }
    return err(res, 'not_found', 'Drop not found', 404);
  }

  // ── Users ─────────────────────────────────────────────────────────────────────
  if (path === '/api/admin/users' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const q = url.searchParams.get('q') || '';
    const filtered = q
      ? users.filter((u) => (u.name || '').toLowerCase().includes(q) || u.identifier.toLowerCase().includes(q))
      : users;
    return json(res, { users: filtered });
  }

  const userMatch = path.match(/^\/api\/admin\/users\/(\d+)$/);
  if (userMatch && method === 'GET') {
    if (!requireAuth(req, res)) return;
    const id = Number(userMatch[1]);
    const detail = userDetail[id];
    if (!detail) return err(res, 'not_found', 'User not found', 404);
    const boxes = (detail.boxes || []).map((b, i) => ({
      id: i + 1,
      drop_index: i + 1,
      drop_title: b.drop_title,
      campaign_name: b.campaign,
      status: b.status,
      opened_at: b.opened_at,
    }));
    const rewards = (detail.reward_issues || []).map((ri) => {
      const v = vouchers.find((v) => v.id === ri.reward_id) || {};
      return {
        id: ri.id, title: ri.reward, type: v.type || 'coupon', value: v.value || null,
        code: ri.code || null, status: ri.status, issued_at: ri.issued_at,
        redeemed_at: ri.status === 'redeemed' ? ri.issued_at : null,
        expires_at: ri.expires_at || null,
      };
    });
    return json(res, {
      id: detail.id, name: detail.name, identifier: detail.identifier, created_at: detail.created_at,
      boxes, rewards, events: [],
    });
  }

  const adjustBoxMatch = path.match(/^\/api\/admin\/users\/(\d+)\/adjust-box$/);
  if (adjustBoxMatch && method === 'POST') {
    if (!requireAuth(req, res)) return;
    return json(res, { ok: true });
  }

  const rewardIssueMatch = path.match(/^\/api\/admin\/reward-issues\/(\d+)$/);
  if (rewardIssueMatch && method === 'PATCH') {
    if (!requireAuth(req, res)) return;
    return json(res, { ok: true });
  }

  // ── Stats ─────────────────────────────────────────────────────────────────────
  if (path === '/api/admin/stats' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, {
      registered_users: 5,
      boxes_opened: 14,
      rewards_claimed: 12,
      open_rate: 58,
      missed_drops: 13,
      completion_rate: 0,
    });
  }

  // ── Analytics ─────────────────────────────────────────────────────────────────
  if (path.startsWith('/api/admin/analytics') && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, {
      daily_opens: [
        { day: '2026-07-03', opens: 3 },
        { day: '2026-07-04', opens: 2 },
        { day: '2026-07-05', opens: 4 },
        { day: '2026-07-06', opens: 1 },
        { day: '2026-07-07', opens: 3 },
        { day: '2026-07-08', opens: 1 },
        { day: '2026-07-09', opens: 0 },
      ],
      reward_distribution: [
        { title: 'Free Coffee',       type: 'coupon', claimed: 5 },
        { title: '10% Off',           type: 'coupon', claimed: 4 },
        { title: '50 Loyalty Points', type: 'points', claimed: 4 },
        { title: 'Gold Badge',        type: 'badge',  claimed: 2 },
        { title: 'Surprise Gift',     type: 'coupon', claimed: 3 },
      ],
      per_drop: (() => {
        const cid = Number(url.searchParams.get('campaign') || 1);
        const drops = (campaignDrops[cid] || campaignDrops[1] || []).slice(0, 7);
        const enrolled = (campaigns.find((c) => c.id === cid) || {}).enrolled || 5;
        return drops.map((d) => {
          const now = Date.now();
          const isPast = new Date(d.close_at).getTime() < now;
          const opened = isPast ? Math.floor(enrolled * 0.55) : 0;
          const missed = isPast ? enrolled - opened : 0;
          return { drop_index: d.drop_index, title: d.title, available: enrolled, opened, missed, open_rate: isPast ? Math.round((opened / enrolled) * 100) : 0 };
        });
      })(),
      redemption_funnel: { issued: 12, redeemed: 3, expired: 1 },
    });
  }

  // ── Activity ──────────────────────────────────────────────────────────────────
  if (path === '/api/admin/activity' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, {
      activity: [
        { id: 16, type: 'open', meta: { drop_index: 6 }, created_at: '2026-07-08T16:22:07Z', user_name: 'John Doe',     identifier: 'john@demo.test',  drop_index: 6, campaign_name: 'Summer Daily Adventure' },
        { id: 15, type: 'open', meta: { drop_index: 5 }, created_at: '2026-07-07T22:40:18Z', user_name: 'Priya Sharma', identifier: 'priya@demo.test', drop_index: 5, campaign_name: 'Summer Daily Adventure' },
        { id: 14, type: 'open', meta: { drop_index: 5 }, created_at: '2026-07-07T08:02:33Z', user_name: 'John Doe',     identifier: 'john@demo.test',  drop_index: 5, campaign_name: 'Summer Daily Adventure' },
        { id: 13, type: 'miss', meta: {},                created_at: '2026-07-07T00:00:01Z', user_name: 'Rahul Verma',  identifier: 'rahul@demo.test', drop_index: 5, campaign_name: 'Summer Daily Adventure' },
        { id: 12, type: 'miss', meta: {},                created_at: '2026-07-07T00:00:01Z', user_name: 'Alice Tan',    identifier: 'alice@demo.test', drop_index: 5, campaign_name: 'Summer Daily Adventure' },
        { id: 11, type: 'open', meta: { drop_index: 4 }, created_at: '2026-07-06T11:31:19Z', user_name: 'John Doe',     identifier: 'john@demo.test',  drop_index: 4, campaign_name: 'Summer Daily Adventure' },
        { id: 10, type: 'open', meta: { drop_index: 3 }, created_at: '2026-07-05T20:44:02Z', user_name: 'John Doe',     identifier: 'john@demo.test',  drop_index: 3, campaign_name: 'Summer Daily Adventure' },
        { id: 9,  type: 'open', meta: { drop_index: 3 }, created_at: '2026-07-05T12:55:30Z', user_name: 'Priya Sharma', identifier: 'priya@demo.test', drop_index: 3, campaign_name: 'Summer Daily Adventure' },
        { id: 8,  type: 'open', meta: { drop_index: 3 }, created_at: '2026-07-05T08:20:45Z', user_name: 'Alice Tan',    identifier: 'alice@demo.test', drop_index: 3, campaign_name: 'Summer Daily Adventure' },
        { id: 7,  type: 'open', meta: { drop_index: 1 }, created_at: '2026-07-05T16:00:00Z', user_name: 'John Doe',     identifier: 'john@demo.test',  drop_index: 1, campaign_name: 'Weekly Winners' },
      ],
    });
  }

  // ── WhatsApp ──────────────────────────────────────────────────────────────────
  if (path === '/api/admin/whatsapp/settings') {
    if (!requireAuth(req, res)) return;
    if (method === 'GET') return json(res, whatsappSettings);
    if (method === 'PUT') {
      const body = await readBody(req);
      whatsappSettings = { ...whatsappSettings, ...body };
      return json(res, whatsappSettings);
    }
  }

  if (path === '/api/admin/whatsapp/status' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, { connected: false, mode: whatsappSettings.mode });
  }

  if (path === '/api/admin/whatsapp/templates') {
    if (!requireAuth(req, res)) return;
    if (method === 'GET') return json(res, { templates: whatsappTemplates });
    if (method === 'POST') {
      const body = await readBody(req);
      const t = { id: nextId.template++, language: 'en', status: 'draft', ...body };
      whatsappTemplates.push(t);
      return json(res, { template: t }, 201);
    }
  }

  const templateMatch = path.match(/^\/api\/admin\/whatsapp\/templates\/(\d+)$/);
  if (templateMatch && method === 'PATCH') {
    if (!requireAuth(req, res)) return;
    const id = Number(templateMatch[1]);
    const idx = whatsappTemplates.findIndex((t) => t.id === id);
    if (idx === -1) return err(res, 'not_found', 'Template not found', 404);
    const body = await readBody(req);
    whatsappTemplates[idx] = { ...whatsappTemplates[idx], ...body };
    return json(res, { template: whatsappTemplates[idx] });
  }

  if (path === '/api/admin/whatsapp/broadcast' && method === 'POST') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req);
    const t = whatsappTemplates.find((t) => t.id === body.template_id);
    const recipientCount = body.user_ids?.length || users.length;
    const msg = {
      id: nextId.message++,
      template_id: body.template_id || null,
      template_name: t?.name || null,
      body: t?.body || '',
      audience: body.user_ids?.length ? `${body.user_ids.length} selected users` : 'All users',
      recipients: recipientCount,
      status: whatsappSettings.mode === 'live' ? 'sent' : 'simulated',
      sent_by: 'admin@dropzone.test',
      created_at: new Date().toISOString(),
    };
    whatsappMessages.unshift(msg);
    return json(res, { recipients: msg.recipients, status: msg.status, audience: msg.audience });
  }

  if (path === '/api/admin/whatsapp/messages' && method === 'GET') {
    if (!requireAuth(req, res)) return;
    return json(res, { messages: whatsappMessages });
  }

  // ── Public: customer enroll ───────────────────────────────────────────────────
  if (path === '/api/enroll' && method === 'POST') {
    const body = await readBody(req);
    const identifier = req.headers['x-user-identifier'] || body.identifier;
    if (!identifier) return err(res, 'validation', 'identifier required');
    let user = users.find((u) => u.identifier === identifier);
    if (!user) {
      user = { id: nextId.user++, name: body.name || null, identifier, created_at: new Date().toISOString(), campaigns: 1, rewards: 0 };
      users.push(user);
    }
    return json(res, { user_id: user.id, identifier: user.identifier });
  }

  // ── Public: customer calendar ─────────────────────────────────────────────────
  if (path === '/api/me/calendar' && method === 'GET') {
    const campaignId = Number(url.searchParams.get('campaign') || 1);
    const userId = Number(req.headers['x-user-id'] || 0);
    const userBoxes = openedBoxes[userId] || {};
    const now = Date.now();
    const drops = (campaignDrops[campaignId] || []).map((d) => {
      const open  = new Date(d.open_at).getTime();
      const close = new Date(d.close_at).getTime();
      let status = 'locked';
      if (userBoxes[d.id]) {
        status = 'opened';
      } else if (now > close) {
        status = 'missed';
      } else if (now >= open) {
        status = 'available';
      }
      return { drop_id: d.id, drop_index: d.drop_index, title: d.title, open_at: d.open_at, close_at: d.close_at, status };
    });
    return json(res, { drops });
  }

  // ── Public: open box ─────────────────────────────────────────────────────────
  const openBoxMatch = path.match(/^\/api\/boxes\/(\d+)\/open$/);
  if (openBoxMatch && method === 'POST') {
    const dropId = Number(openBoxMatch[1]);
    const userId = Number(req.headers['x-user-id'] || 0);
    const drop = Object.values(campaignDrops).flat().find((d) => d.id === dropId);
    if (!drop) return err(res, 'not_found', 'Drop not found', 404);

    // Idempotent: return stored result if already opened by this user
    if (openedBoxes[userId]?.[dropId]) {
      const stored = openedBoxes[userId][dropId];
      return json(res, { status: 'opened', box_id: dropId, opened_at: stored.opened_at, reward: stored.reward });
    }

    const now = Date.now();
    const open  = new Date(drop.open_at).getTime();
    const close = new Date(drop.close_at).getTime();
    if (now < open)  return err(res, 'too_early', 'This box is not open yet', 423);
    if (now > close) return err(res, 'missed',    'This drop has closed',     410);

    const v = drop.reward_id ? vouchers.find((v) => v.id === drop.reward_id) : null;
    let reward = null;
    if (v && v.type !== 'empty') {
      let code = v.shared_code || null;
      if (v.code_mode === 'unique') {
        const pool = uniqueCodes.filter((c) => c.voucher_id === v.id && !c.used);
        if (pool.length) { const c = pool[0]; c.used = 1; c.used_at = new Date().toISOString(); code = c.code; }
        else code = null;
      }
      const expiresAt = v.validity_days ? new Date(Date.now() + v.validity_days * 86400000).toISOString() : null;
      reward = { title: v.title, type: v.type, value: v.value, image: v.image || null, code, expires_at: expiresAt };
    }

    const openedAt = new Date().toISOString();

    // Persist opened state so calendar and rewards reflect it on reload
    openedBoxes[userId] = openedBoxes[userId] || {};
    openedBoxes[userId][dropId] = { opened_at: openedAt, reward_id: v?.id || null, reward };

    // Add to user's reward history
    if (reward) {
      if (!userDetail[userId]) {
        const u = users.find((u) => u.id === userId);
        userDetail[userId] = { id: userId, name: u?.name || null, identifier: u?.identifier || '', created_at: u?.created_at || openedAt, enrollments: [], boxes: [], reward_issues: [] };
      }
      userDetail[userId].reward_issues = userDetail[userId].reward_issues || [];
      userDetail[userId].reward_issues.push({
        id: nextRewardIssueId++, reward_id: v?.id || null,
        reward: reward.title, code: reward.code || null,
        status: 'issued', issued_at: openedAt, expires_at: reward.expires_at || null,
      });
    }

    return json(res, { status: 'opened', box_id: dropId, opened_at: openedAt, reward });
  }

  // ── Public: rewards ───────────────────────────────────────────────────────────
  if (path === '/api/me/rewards' && method === 'GET') {
    const userId = Number(req.headers['x-user-id'] || 0);
    const detail = userDetail[userId];
    const rewards = (detail?.reward_issues || []).map((ri) => {
      const v = vouchers.find((v) => v.id === ri.reward_id) || {};
      return { id: ri.id, title: ri.reward, type: v.type || 'coupon', value: v.value || null, image: v.image || null, code: ri.code || null, status: ri.status, issued_at: ri.issued_at, expires_at: ri.expires_at };
    });
    return json(res, { rewards });
  }

  // ── Public: redeem ────────────────────────────────────────────────────────────
  const redeemMatch = path.match(/^\/api\/rewards\/(\d+)\/redeem$/);
  if (redeemMatch && method === 'POST') {
    return json(res, { ok: true });
  }

  // ── WhatsApp webhook ──────────────────────────────────────────────────────────
  if (path === '/api/whatsapp/webhook') {
    if (method === 'GET') {
      const mode  = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && token === whatsappSettings.verify_token) {
        res.writeHead(200); res.end(challenge || ''); return;
      }
      return err(res, 'forbidden', 'Verify token mismatch', 403);
    }
    if (method === 'POST') { cors(res); res.writeHead(200); res.end('{}'); return; }
  }

  // ── 404 ───────────────────────────────────────────────────────────────────────
  err(res, 'not_found', `No route for ${method} ${path}`, 404);
});

server.listen(PORT, () => {
  console.log(`DropZone mock API running at http://localhost:${PORT}`);
  console.log('Admin login: any email + password "password" (or "dropzone123")');
  console.log('Press Ctrl+C to stop.');
});
