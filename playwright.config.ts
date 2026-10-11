import { defineConfig } from '@playwright/test';
export default defineConfig({testDir:'tests/e2e',fullyParallel:false,workers:1,retries:0,timeout:45000,
  use:{baseURL:'http://localhost:3000',viewport:{width:1536,height:1024},channel:'chrome',trace:'retain-on-failure'},
  reporter:[['list'],['json',{outputFile:'docs/verification/e2e-results.json'}]]});
