const express = require('express');
const index = require('.')
var bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json()); // for parsing application/json

app.post('/', (req, res) => {
  console.log(`Calling the handle.funcHandleHTTP method with req.body = ${JSON.stringify(req.body)}`)
  console.log(`Request headers= ${JSON.stringify(req.headers)}`)
  index.loadGenerator(req.body, res)
  console.log(`Reached the end of servelet call`)
});

// Constants
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

app.listen(PORT, HOST);
console.log(`Serverless-artillery listening at http://${HOST}:${PORT}`);
