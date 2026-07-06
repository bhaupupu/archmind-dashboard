#!/usr/bin/env node

const ATLAS_URL = process.env.ATLAS_URL || 'http://localhost:3001';
const ATLAS_TOKEN = process.env.ATLAS_TOKEN;
const ORG = process.env.ATLAS_ORG || 'fixtures/sample-org';

if (!ATLAS_TOKEN) {
  console.error('Error: ATLAS_TOKEN environment variable is required.');
  process.exit(1);
}

const args = process.argv.slice(2);
const command = args[0];

async function main() {
  if (command === 'analyze') {
    const prompt = args.slice(1).join(' ');
    if (!prompt) {
      console.error('Usage: atlas analyze <prompt>');
      process.exit(1);
    }
    console.log(`Analyzing impact of: "${prompt}"...`);
    const res = await fetch(`${ATLAS_URL}/v1/analyses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ATLAS_TOKEN}`
      },
      body: JSON.stringify({ prompt, org: ORG })
    });
    
    if (!res.ok) {
      console.error(`API Error: ${res.status}`, await res.text());
      process.exit(1);
    }
    
    const data = await res.json() as any;
    console.log(`Analysis complete (ID: ${data.analysisId})`);
    for (const r of data.affectedRepos) {
      console.log(`- ${r.repoId}: ${r.disposition}`);
    }
  } else if (command === 'pr') {
    const analysisId = args[1];
    const repoId = args[2];
    if (!analysisId || !repoId) {
      console.error('Usage: atlas pr <analysisId> <repoId>');
      process.exit(1);
    }
    console.log(`Initiating autonomous PR for ${repoId}...`);
    const res = await fetch(`${ATLAS_URL}/v1/autonomous/pr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ATLAS_TOKEN}`
      },
      body: JSON.stringify({ analysisId, repoId })
    });
    
    if (!res.ok) {
      console.error(`API Error: ${res.status}`, await res.text());
      process.exit(1);
    }
    
    const data = await res.json() as any;
    console.log(`PR Generated Successfully!`);
    console.log(`URL: ${data.url}`);
  } else {
    console.log(`
Atlas CLI - Engineering Intelligence CI/CD Tool

Usage:
  atlas analyze <prompt>            Analyze cross-repo impact
  atlas pr <analysisId> <repoId>    Autonomously generate a Pull Request

Environment Variables:
  ATLAS_TOKEN   (Required) Enterprise API Token
  ATLAS_URL     (Optional) API Base URL (default: http://localhost:3001)
  ATLAS_ORG     (Optional) Organization Context
    `);
  }
}

main().catch(err => {
  console.error('Unhandled Error:', err);
  process.exit(1);
});
