// Vercel Node builder will call this file.
// We load your existing Express app and export it as the handler.
const app = require('../server');


// Vercel provides req/res, so we just export the handler.
module.exports = app;

