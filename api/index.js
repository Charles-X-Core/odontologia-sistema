/**
 * Vercel Serverless Function — Root entry point
 * Requires the Express app from backend/
 */
const app = require('../backend/api/index.js');
module.exports = app;
