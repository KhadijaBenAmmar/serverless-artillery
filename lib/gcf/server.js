const express = require('express');
const index = require('.')
var bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json()); // for parsing application/json

var requestCount = 0;
app.post('/', (req, res) => {
  if (req.headers && req.headers['_trace']) {
    console.log(`Calling the handle.funcHandleHTTP method with req.body = ${JSON.stringify(req.body)}`)
    console.log(`Request headers= ${JSON.stringify(req.headers)}`)
  }

  requestCount ++;
  console.log(`Function instance used = ${requestCount} time(s)`)

  index.loadGenerator(req, res, requestCount===1)
  if (req.headers && req.headers['_trace']) {
    console.log(`Reached the end of servelet call`)
  }
});

// Constants
const PORT = process.env.PORT || 8080;
const HOST = process.env.HOST || '0.0.0.0';

var server = app.listen(PORT, HOST);
server.timeout = 240000;
console.log(`Serverless-artillery listening at http://${HOST}:${PORT}`);
