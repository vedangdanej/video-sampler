#!/usr/bin/env node

import { main } from './cli/main.js';

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
