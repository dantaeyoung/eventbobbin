#!/usr/bin/env npx tsx
/**
 * Benchmark script to compare performance between machines
 * Run on both your Mac M1 and VPS to compare results
 *
 * Usage: npx tsx scripts/benchmark.ts
 */

import { config } from 'dotenv';
config({ path: '.env.local' });

import { chromium } from 'playwright';
import OpenAI from 'openai';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { sql } from 'drizzle-orm';

const TEST_URL = 'https://www.nytimes.com/events';
const ITERATIONS = 3;

interface BenchmarkResult {
  name: string;
  times: number[];
  avg: number;
  min: number;
  max: number;
}

function formatMs(ms: number): string {
  return `${ms.toFixed(0)}ms`;
}

function summarize(name: string, times: number[]): BenchmarkResult {
  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const min = Math.min(...times);
  const max = Math.max(...times);
  return { name, times, avg, min, max };
}

function printResult(result: BenchmarkResult): void {
  console.log(`\n${result.name}:`);
  console.log(`  Runs: ${result.times.map(formatMs).join(', ')}`);
  console.log(`  Avg: ${formatMs(result.avg)} | Min: ${formatMs(result.min)} | Max: ${formatMs(result.max)}`);
}

async function benchmarkPlaywright(): Promise<BenchmarkResult> {
  console.log('\n--- Playwright Browser Benchmark ---');
  console.log(`Loading ${TEST_URL} ${ITERATIONS} times...`);

  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
    });
    const page = await context.newPage();

    const start = performance.now();

    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 60000 });
    await page.screenshot({ type: 'png' }); // Don't save, just render
    const content = await page.content();

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(`  Run ${i + 1}: ${formatMs(elapsed)} (${(content.length / 1024).toFixed(0)}KB HTML)`);

    await browser.close();
  }

  return summarize('Playwright (page load + screenshot)', times);
}

async function benchmarkLLM(): Promise<BenchmarkResult> {
  console.log('\n--- OpenAI LLM Benchmark ---');
  console.log(`Making ${ITERATIONS} extraction calls...`);

  if (!process.env.OPENAI_API_KEY) {
    console.log('  OPENAI_API_KEY not set, skipping');
    return summarize('OpenAI LLM', []);
  }

  const openai = new OpenAI();
  const times: number[] = [];

  const testContent = `
    Event: Summer Music Festival
    Date: July 15, 2025
    Location: Central Park, NYC
    Description: Annual outdoor concert featuring local bands.

    Event: Art Gallery Opening
    Date: August 1, 2025
    Location: Downtown Gallery
    Description: New exhibition of contemporary art.
  `;

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Extract events as JSON array with title, date, location, description fields.',
        },
        {
          role: 'user',
          content: testContent,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(`  Run ${i + 1}: ${formatMs(elapsed)}`);
  }

  return summarize('OpenAI LLM (gpt-4o-mini)', times);
}

async function benchmarkDatabase(): Promise<BenchmarkResult> {
  console.log('\n--- Neon Database Benchmark ---');
  console.log(`Making ${ITERATIONS} round-trip queries...`);

  if (!process.env.DATABASE_URL) {
    console.log('  DATABASE_URL not set, skipping');
    return summarize('Neon Database', []);
  }

  const client = neon(process.env.DATABASE_URL);
  const db = drizzle(client);
  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    // Simple query to test round-trip latency
    await db.execute(sql`SELECT COUNT(*) FROM sources`);
    await db.execute(sql`SELECT COUNT(*) FROM events`);
    await db.execute(sql`SELECT 1`);

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(`  Run ${i + 1}: ${formatMs(elapsed)} (3 queries)`);
  }

  return summarize('Neon Database (3 queries)', times);
}

async function benchmarkFullScrape(): Promise<BenchmarkResult> {
  console.log('\n--- Full Scrape Simulation Benchmark ---');
  console.log('Simulating complete scrape pipeline...');

  const times: number[] = [];

  for (let i = 0; i < ITERATIONS; i++) {
    const start = performance.now();

    // 1. Browser: Load page
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(TEST_URL, { waitUntil: 'networkidle', timeout: 60000 });
    const content = await page.evaluate(() => document.body.innerText);
    await browser.close();

    // 2. LLM: Extract (if available)
    if (process.env.OPENAI_API_KEY) {
      const openai = new OpenAI();
      await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'Extract any events mentioned as JSON.' },
          { role: 'user', content: content.slice(0, 4000) },
        ],
        response_format: { type: 'json_object' },
      });
    }

    // 3. Database: Write (just a read to simulate)
    if (process.env.DATABASE_URL) {
      const client = neon(process.env.DATABASE_URL);
      const db = drizzle(client);
      await db.execute(sql`SELECT COUNT(*) FROM events`);
    }

    const elapsed = performance.now() - start;
    times.push(elapsed);

    console.log(`  Run ${i + 1}: ${formatMs(elapsed)}`);
  }

  return summarize('Full Scrape Pipeline', times);
}

async function getSystemInfo(): Promise<void> {
  console.log('=== System Information ===');
  console.log(`Platform: ${process.platform}`);
  console.log(`Arch: ${process.arch}`);
  console.log(`Node: ${process.version}`);

  // Try to get more info
  const { execSync } = await import('child_process');
  try {
    if (process.platform === 'darwin') {
      const chip = execSync('sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "Unknown"').toString().trim();
      const mem = execSync('sysctl -n hw.memsize 2>/dev/null || echo "0"').toString().trim();
      console.log(`CPU: ${chip}`);
      console.log(`RAM: ${(parseInt(mem) / 1024 / 1024 / 1024).toFixed(0)}GB`);
    } else {
      const cpu = execSync('cat /proc/cpuinfo | grep "model name" | head -1 | cut -d: -f2 2>/dev/null || echo "Unknown"').toString().trim();
      const mem = execSync('free -b | grep Mem | awk \'{print $2}\' 2>/dev/null || echo "0"').toString().trim();
      console.log(`CPU: ${cpu}`);
      console.log(`RAM: ${(parseInt(mem) / 1024 / 1024 / 1024).toFixed(1)}GB`);
    }
  } catch {
    console.log('Could not get detailed system info');
  }
}

async function main(): Promise<void> {
  console.log('╔════════════════════════════════════════╗');
  console.log('║   EventBobbin Performance Benchmark    ║');
  console.log('╚════════════════════════════════════════╝\n');

  await getSystemInfo();

  const results: BenchmarkResult[] = [];

  results.push(await benchmarkPlaywright());
  results.push(await benchmarkLLM());
  results.push(await benchmarkDatabase());
  results.push(await benchmarkFullScrape());

  console.log('\n╔════════════════════════════════════════╗');
  console.log('║            Summary Results             ║');
  console.log('╚════════════════════════════════════════╝');

  for (const result of results) {
    if (result.times.length > 0) {
      printResult(result);
    }
  }

  console.log('\n--- Copy this for comparison ---');
  console.log(JSON.stringify({
    platform: process.platform,
    arch: process.arch,
    results: results.filter(r => r.times.length > 0).map(r => ({
      name: r.name,
      avgMs: Math.round(r.avg),
    })),
  }, null, 2));
}

main().catch(console.error);
