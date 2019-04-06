const express = require('express');
const axios = require('axios')
const index = require('.')
const app = express();
//
// impl = {
//   httpInvocation: (payload, functionUri = "http://localhost:49160/") => {
//     // add the invocationTime in the event
//
//
//     return axios.post(functionUri, payload, {
//       headers: {'Content-Type': 'application/json'}
//     }).then((result) => {
//       var data = result.data
//       console.log(`Response Data ${data}`);
//       console.log(`Response headers: ${JSON.stringify(result.headers)}`)
//       return data;
//     })
//   },
//
// };
//
// impl.httpInvocation("{\"hello\": \"world\"}")


req = {body: {}, header:(string) => ""};
res = {json: () => console.log('invoked json method')};

console.log(`Calling the handle.funcHandleHTTP method`)
index.loadGenerator(req, res, true)
// httpHandle = handle.funcHandleHTTP()
// httpHandle(req.body, res)

console.log(`Reached the end of servelet call`)

// recur = 2;
//
// impl = {
//   func1: func2 => (one, two) => {
//     console.log(`Inside. one: ${one}, two: ${two}`)
//     console.log(`First log: ${typeof impl.func1}`)
//     console.log(`2nd log : ${typeof impl.func1()}`)
//     console.log(`===`)
//     if (recur >= 1) {
//       recur --;
//       impl.mergeAndInvoke(impl.func1)
//     }
//     return {}
//   },
//   mergeAndInvoke: (taskHandler) => {
//     taskHandler('x')
//   }
// }
//
// t = impl.func1()
// t('a', 'b')

