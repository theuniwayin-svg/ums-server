const { MongoClient } = require('mongodb');
const axios = require('axios');
require('dotenv').config();

async function run() {
  try {
    // We can just use the Service file or make a raw request. 
    // It's easier to use the service directly.
    const { LeadsService } = require('./src/modules/leads/leads.service.ts'); // Can't require TS directly in Node without ts-node
  } catch (e) {
  }
}
run();
