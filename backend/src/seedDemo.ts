/**
 * SupportSense Demo Seeding Script
 *
 * NOTE: All tickets inserted in this script are SAMPLE DEMO DATA created solely
 * to populate the dashboard metrics and week-over-week reporting charts.
 * This script does NOT call the live AI service to ensure instant, deterministic seeding.
 */

import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

// Load environment variables
const rootEnv = path.resolve(__dirname, '../../.env');
if (fs.existsSync(rootEnv)) {
  dotenv.config({ path: rootEnv });
} else {
  dotenv.config();
}

import { db, dbOperations } from './db/database';
import { generateWeeklyReport } from './services/reportJob';

interface SampleTicketDefinition {
  email: string;
  text: string;
  status: 'auto_resolved' | 'escalated' | 'human_resolved';
  tags: string[];
  urgency: 'low' | 'medium' | 'high';
  confidence: number;
  sources: string[];
  daysAgo: number;
  answer?: string;
  summary?: string;
  human_reply?: string;
}

const SAMPLE_TICKETS: SampleTicketDefinition[] = [
  // --- Current Week (Days 0 to 6 ago) ---
  {
    email: 'sarah.j@example.com',
    text: 'What is the return window for electronics and is there a deduction fee?',
    status: 'auto_resolved',
    tags: ['refund'],
    urgency: 'low',
    confidence: 0.88,
    sources: ['returns_and_refunds.md'],
    daysAgo: 1,
    answer: 'Electronics can be returned within 14 days of delivery in original packaging. Change-of-mind returns have a flat $5.99 return postage fee deducted from the refund.',
  },
  {
    email: 'michael.b@gmail.com',
    text: 'My order has been delayed for 6 days with no tracking updates. Where is it?',
    status: 'escalated',
    tags: ['shipping'],
    urgency: 'high',
    confidence: 0.38,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 1,
    summary: '1. Customer Wants: Status update on delayed shipment with stalled tracking for 6 days.\n2. AI Attempted: Found 5-day delay policy, but cannot inspect live courier tracking database.\n3. Suggested Next Step: Look up order in carrier portal and issue replacement if lost.',
  },
  {
    email: 'emily.t@outlook.com',
    text: 'Can I cancel an order that I submitted 20 minutes ago?',
    status: 'auto_resolved',
    tags: ['cancellation'],
    urgency: 'medium',
    confidence: 0.92,
    sources: ['order_cancellation.md'],
    daysAgo: 2,
    answer: 'Yes! You can cancel your order directly from the "My Orders" tab within 60 minutes of placing it by clicking the "Cancel Order" button.',
  },
  {
    email: 'robert.d@workmail.com',
    text: 'I see two identical charges for $49.99 on my credit card statement. Why?',
    status: 'auto_resolved',
    tags: ['payment'],
    urgency: 'medium',
    confidence: 0.84,
    sources: ['payment_issues.md'],
    daysAgo: 2,
    answer: 'One of the entries is typically a temporary pre-authorization hold that automatically drops off within 3 to 5 business days. If both clear, please contact support for a refund.',
  },
  {
    email: 'olivia.k@example.com',
    text: 'How do I submit a warranty claim for a blender motor that stopped running?',
    status: 'auto_resolved',
    tags: ['warranty'],
    urgency: 'medium',
    confidence: 0.89,
    sources: ['warranty.md'],
    daysAgo: 3,
    answer: 'Electronics carry a 1-year limited warranty. Submit your 10-digit Order ID and product photos/video at support.shopeasy.com/warranty. Claims are reviewed within 48 business hours.',
  },
  {
    email: 'david.w@gmail.com',
    text: 'I forgot my password and the reset link has expired.',
    status: 'auto_resolved',
    tags: ['login'],
    urgency: 'low',
    confidence: 0.91,
    sources: ['account_and_login.md'],
    daysAgo: 3,
    answer: 'Password reset links expire after 60 minutes for security. You can request a fresh link by visiting the login page and clicking "Forgot Password".',
  },
  {
    email: 'jessica.m@yahoo.com',
    text: 'Do you offer cryptocurrency or Bitcoin payment options for checkout?',
    status: 'escalated',
    tags: ['payment', 'other'],
    urgency: 'low',
    confidence: 0.15,
    sources: ['payment_issues.md'],
    daysAgo: 3,
    summary: '1. Customer Wants: Information on paying with cryptocurrency.\n2. AI Attempted: Verified accepted payments; cryptocurrency is strictly excluded from accepted methods.\n3. Suggested Next Step: Inform customer that only credit cards, PayPal, and Apple/Google Pay are supported.',
  },
  {
    email: 'kevin.p@example.com',
    text: 'My order has been stuck in warehouse processing for 5 business days.',
    status: 'human_resolved',
    tags: ['shipping'],
    urgency: 'medium',
    confidence: 0.42,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 4,
    summary: '1. Customer Wants: Package expedited after 5 days of warehouse processing.\n2. AI Attempted: Standard processing is 24-48 hours; order appears delayed.\n3. Suggested Next Step: Contact distribution team and upgrade shipping to overnight.',
    human_reply: 'Hello Kevin, I apologize for the delay. We had a brief inventory recount at our Ohio fulfillment center. I have upgraded your parcel to Overnight Priority at no additional charge!',
  },
  {
    email: 'laura.s@gmail.com',
    text: 'Can I change my delivery address? I ordered 3 hours ago.',
    status: 'auto_resolved',
    tags: ['cancellation', 'shipping'],
    urgency: 'high',
    confidence: 0.86,
    sources: ['order_cancellation.md'],
    daysAgo: 4,
    answer: 'Orders cannot be modified after 60 minutes as they enter automated picking. Once the parcel arrives, you can initiate a standard return.',
  },
  {
    email: 'daniel.h@outlook.com',
    text: 'My account is locked out after trying to log in multiple times.',
    status: 'auto_resolved',
    tags: ['login'],
    urgency: 'medium',
    confidence: 0.94,
    sources: ['account_and_login.md'],
    daysAgo: 4,
    answer: 'Accounts lock automatically for 30 minutes after 5 consecutive incorrect password entries. You can either wait 30 minutes or click "Forgot Password" to unlock it immediately.',
  },
  {
    email: 'brian.v@example.com',
    text: 'My coffee machine glass carafe cracked after dropping it. Is this covered under warranty?',
    status: 'auto_resolved',
    tags: ['warranty'],
    urgency: 'low',
    confidence: 0.87,
    sources: ['warranty.md'],
    daysAgo: 5,
    answer: 'Standard 1-year warranty excludes accidental drops or impacts. However, if you purchased ShopEasy Care+, accidental damage is covered with a $25 deductible.',
  },
  {
    email: 'chloe.g@gmail.com',
    text: 'Do you ship to Germany or Australia?',
    status: 'auto_resolved',
    tags: ['shipping'],
    urgency: 'low',
    confidence: 0.82,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 5,
    answer: 'ShopEasy currently only ships internationally to Canada and the United Kingdom. We do not currently ship to Germany or Australia.',
  },
  {
    email: 'alex.n@yahoo.com',
    text: 'My card was declined at checkout with code 3D Secure failed.',
    status: 'auto_resolved',
    tags: ['payment'],
    urgency: 'medium',
    confidence: 0.85,
    sources: ['payment_issues.md'],
    daysAgo: 6,
    answer: '3D Secure failures occur when the bank verification SMS or app alert times out. Please ensure your mobile phone is reachable or try checking out with PayPal.',
  },
  {
    email: 'anna.f@example.com',
    text: 'How many gift cards can I apply to a single transaction?',
    status: 'auto_resolved',
    tags: ['payment'],
    urgency: 'low',
    confidence: 0.93,
    sources: ['payment_issues.md'],
    daysAgo: 6,
    answer: 'You may apply a maximum of 2 ShopEasy gift cards per order. Any remaining balance can be covered by credit card or PayPal.',
  },
  {
    email: 'tyler.r@gmail.com',
    text: 'Can I return an opened digital software product?',
    status: 'auto_resolved',
    tags: ['refund'],
    urgency: 'low',
    confidence: 0.90,
    sources: ['returns_and_refunds.md'],
    daysAgo: 6,
    answer: 'Opened software, digital licenses, and downloadable products are strictly non-returnable and non-refundable under ShopEasy policy.',
  },

  // --- Previous Week (Days 7 to 13 ago) ---
  {
    email: 'carlos.m@example.com',
    text: 'What are the cutoff hours for next day priority shipping?',
    status: 'auto_resolved',
    tags: ['shipping'],
    urgency: 'low',
    confidence: 0.93,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 7,
    answer: 'Overnight Priority orders must be placed before 1:00 PM Eastern Standard Time (EST) Monday through Friday.',
  },
  {
    email: 'rachel.b@gmail.com',
    text: 'I ordered the wrong dress size 45 minutes ago. How do I fix it?',
    status: 'auto_resolved',
    tags: ['cancellation'],
    urgency: 'medium',
    confidence: 0.88,
    sources: ['order_cancellation.md'],
    daysAgo: 7,
    answer: 'You are within the 60-minute window! Click "Cancel Order" in My Orders, and then place a new order for the desired size.',
  },
  {
    email: 'steven.l@work.com',
    text: 'Can I return personalized engraved mugs?',
    status: 'auto_resolved',
    tags: ['refund'],
    urgency: 'low',
    confidence: 0.92,
    sources: ['returns_and_refunds.md'],
    daysAgo: 8,
    answer: 'Personalized or customized items (including custom engravings) are strictly non-returnable under our refund policy.',
  },
  {
    email: 'hannah.q@outlook.com',
    text: 'How do I set up two factor authentication on my account?',
    status: 'auto_resolved',
    tags: ['login'],
    urgency: 'low',
    confidence: 0.94,
    sources: ['account_and_login.md'],
    daysAgo: 8,
    answer: 'Go to Account Settings > Security > Two-Factor Authentication. You can select either SMS verification codes or an authenticator app.',
  },
  {
    email: 'james.e@example.com',
    text: 'Does ShopEasy accept Cash on Delivery (COD)?',
    status: 'auto_resolved',
    tags: ['payment'],
    urgency: 'low',
    confidence: 0.95,
    sources: ['payment_issues.md'],
    daysAgo: 9,
    answer: 'ShopEasy does not accept Cash on Delivery (COD), personal checks, or wire transfers. All orders must be prepaid electronically.',
  },
  {
    email: 'grace.p@gmail.com',
    text: 'My fitness tracker stopped syncing Bluetooth after 4 months.',
    status: 'auto_resolved',
    tags: ['warranty'],
    urgency: 'medium',
    confidence: 0.89,
    sources: ['warranty.md'],
    daysAgo: 9,
    answer: 'Internal component and sensor malfunctions are covered under our 1-Year Limited Warranty. File a claim at support.shopeasy.com/warranty-portal.',
  },
  {
    email: 'nathan.c@yahoo.com',
    text: 'My package was stolen from my apartment lobby doorstep.',
    status: 'human_resolved',
    tags: ['shipping'],
    urgency: 'high',
    confidence: 0.35,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 10,
    summary: '1. Customer Wants: Replacement or refund for stolen package.\n2. AI Attempted: Claims must be reported within 14 days of delivery scan.\n3. Suggested Next Step: File carrier investigation claim and dispatch replacement unit.',
    human_reply: 'Hello Nathan, I am sorry to hear about the theft. Since you reported this within 14 days, I have processed a complimentary replacement order #REPL-9921 for you!',
  },
  {
    email: 'zoe.k@example.com',
    text: 'How long do refunds take to appear back in my PayPal balance?',
    status: 'auto_resolved',
    tags: ['refund', 'payment'],
    urgency: 'low',
    confidence: 0.94,
    sources: ['returns_and_refunds.md'],
    daysAgo: 10,
    answer: 'PayPal refunds are credited within 24 to 48 hours once our warehouse inspects and approves the returned items.',
  },
  {
    email: 'victor.s@gmail.com',
    text: 'How much do you charge for standard shipping on a $30 order?',
    status: 'auto_resolved',
    tags: ['shipping'],
    urgency: 'low',
    confidence: 0.92,
    sources: ['shipping_and_delivery.md'],
    daysAgo: 11,
    answer: 'Standard domestic shipping is a $4.99 flat rate for orders under $50.00. Shipping is free on orders $50.00 or higher.',
  },
  {
    email: 'megan.l@outlook.com',
    text: 'I lost my account recovery backup codes and cannot log in with 2FA.',
    status: 'escalated',
    tags: ['login'],
    urgency: 'high',
    confidence: 0.40,
    sources: ['account_and_login.md'],
    daysAgo: 11,
    summary: '1. Customer Wants: Manual identity verification to restore account access without 2FA backup codes.\n2. AI Attempted: Knowledge base contains self-service steps, but no manual 2FA reset protocol.\n3. Suggested Next Step: Request government ID verification to reset two-factor credentials.',
  },
  {
    email: 'ethan.w@example.com',
    text: 'Can I combine store credit and a credit card for checkout?',
    status: 'auto_resolved',
    tags: ['payment'],
    urgency: 'low',
    confidence: 0.88,
    sources: ['payment_issues.md'],
    daysAgo: 12,
    answer: 'Yes! Store credit and gift cards can be combined with major credit cards or PayPal to cover remaining cart balances.',
  },
  {
    email: 'brittany.h@gmail.com',
    text: 'Is return shipping free if ShopEasy sent me the wrong color jacket?',
    status: 'auto_resolved',
    tags: ['refund', 'shipping'],
    urgency: 'medium',
    confidence: 0.96,
    sources: ['returns_and_refunds.md'],
    daysAgo: 12,
    answer: 'Yes, return shipping is 100% free if the item was defective, damaged, or incorrectly shipped by ShopEasy. No return fee is deducted.',
  },
  {
    email: 'justin.f@yahoo.com',
    text: 'Do you offer a student discount or military discount promo code?',
    status: 'escalated',
    tags: ['other'],
    urgency: 'low',
    confidence: 0.18,
    sources: [],
    daysAgo: 13,
    summary: '1. Customer Wants: Inquiring about student or military discount verification.\n2. AI Attempted: Knowledge base documents do not cover promotional discounts or military programs.\n3. Suggested Next Step: Provide current seasonal promotional codes and invite to sign up for newsletter.',
  },
  {
    email: 'claire.v@example.com',
    text: 'My order has 3 items and one was out of stock. When do I get refunded for it?',
    status: 'auto_resolved',
    tags: ['cancellation', 'refund'],
    urgency: 'medium',
    confidence: 0.91,
    sources: ['order_cancellation.md'],
    daysAgo: 13,
    answer: 'When an item is out of stock, it is cancelled automatically and a full refund for that item is processed to your original payment method within 24 hours.',
  },
  {
    email: 'adam.r@gmail.com',
    text: 'How do I delete my ShopEasy account permanently?',
    status: 'auto_resolved',
    tags: ['login'],
    urgency: 'low',
    confidence: 0.90,
    sources: ['account_and_login.md'],
    daysAgo: 14,
    answer: 'You can delete your account by going to Account Settings > Privacy & Data > "Delete My Account". Note that this action permanently erases reward points and history.',
  },
];

async function seed(): Promise<void> {
  console.log('--- Seeding SupportSense Sample Data ---');

  // Clear existing demo records to prevent duplicates upon repeated seed runs
  db.exec('DELETE FROM feedback_pairs; DELETE FROM tickets; DELETE FROM reports;');

  const now = Date.now();
  const insertTicketStmt = db.prepare(`
    INSERT INTO tickets (
      customer_email, text, status, ai_answer, confidence,
      sources_json, summary, tags_json, urgency, human_reply,
      created_at, resolved_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertFeedbackStmt = db.prepare(`
    INSERT INTO feedback_pairs (ticket_id, ticket_text, human_reply, created_at)
    VALUES (?, ?, ?, ?)
  `);

  let insertedCount = 0;

  for (const item of SAMPLE_TICKETS) {
    const ticketTime = new Date(now - item.daysAgo * 24 * 60 * 60 * 1000).toISOString();
    const resolvedTime = item.status !== 'escalated'
      ? new Date(now - (item.daysAgo - 0.1) * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const info = insertTicketStmt.run(
      item.email,
      item.text,
      item.status,
      item.answer || null,
      item.confidence,
      JSON.stringify(item.sources),
      item.summary || null,
      JSON.stringify(item.tags),
      item.urgency,
      item.human_reply || null,
      ticketTime,
      resolvedTime
    );

    const ticketId = Number(info.lastInsertRowid);
    insertedCount++;

    if (item.status === 'human_resolved' && item.human_reply) {
      insertFeedbackStmt.run(ticketId, item.text, item.human_reply, resolvedTime || ticketTime);
    }
  }

  console.log(`Successfully seeded ${insertedCount} sample tickets into SQLite.`);

  // Generate an initial weekly report from the seeded dataset
  console.log('Generating baseline weekly analytics report from seeded records...');
  try {
    const report = await generateWeeklyReport();
    console.log(`Baseline report created successfully (Report ID #${report.id})`);
  } catch (err) {
    console.warn('Note: Could not reach Python service for AI insights; created mathematical report:', err);
  }

  console.log('--- Seeding Complete! ---');
}

seed().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
