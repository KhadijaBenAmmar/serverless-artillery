// const axios = require('axios');

const valid = require('./funcValid')
const axios = require('axios')

const impl = {
  /**
   * Invoke a new instance of this function with the given event using the given invocation type.
   * @param event The event to invoke a new instance of this function with
   * @param type The type of invocation for the new instance
   * @returns {Promise<PromiseResult<Payload>>}
   */
  execute: (event, type) => {
    if (event._trace) {
      console.log(`In funcExec.js  with event: ${JSON.stringify(event)}`)
    }
    valid(event)

    const params = {
      functionName: event.functionName, // eslint-disable-line no-underscore-dangle
      payload: JSON.stringify(event),
      regionName: event.regionName,
      projectName: event.projectName
    }
    var functionUri = `https://${params.regionName}-${params.projectName}.cloudfunctions.net/${params.functionName}`

    return axios.post(functionUri, params.payload, {
      headers: {'Content-Type': 'application/json'}
    }).then((result) => {
      var data = result.data

      if (event._trace) {
        var executionId = result.headers['function-execution-id']
        var status = result.status;
        var statusText = result.statusText;
        console.log(`Invoked function with execution Id: ${executionId}, status: ${status}, statusText: ${statusText}`)
      }
      return data;
    })
  }
}
module.exports = impl.execute
