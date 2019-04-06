// const axios = require('axios');

const valid = require('./funcValid')
const axios = require('axios')
const PubSub = require(`@google-cloud/pubsub`);
const pubsub = new PubSub();

const topicName = 'loadgeneratortopic3';


const impl = {
  pubSubInvocation: (event) => {
    const dataBuffer = Buffer.from(JSON.stringify(event))
    return pubsub
      .topic(topicName)
      .publisher()
      .publish(dataBuffer)
      .then(messageId => {
        if (event._trace) {
          console.log(`==== Message ${messageId} published.`);
        }
      })
      .catch(err => {
        console.error('ERROR while publishing message:', err);
        Promise.reject(err)
      })
  },
  httpInvocation: (event) => {
    // add the invocationTime in the event
    event._invocationTime = Date.now()
    const params = {
      functionUrl: event.functionUrl,
      functionName: event.functionName, // eslint-disable-line no-underscore-dangle
      payload: JSON.stringify(event),
      regionName: event.regionName,
      projectName: event.projectName
    }
    var functionUri = `https://${params.regionName}-${params.projectName}.cloudfunctions.net/${params.functionName}`
    if (params.functionUrl) {
      functionUri = "https://" + params.functionUrl;
    }

    if (event._trace) {
      console.log(`functionUrl to call: ${functionUri}`);
    }

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
  },
  /**
   * Invoke a new instance of this function with the given event using the given invocation type.
   * @param event The event to invoke a new instance of this function with
   * @param type The type of invocation for the new instance
   * @returns {Promise<PromiseResult<Payload>>}
   */
  execute: (event, type, loadGenFunctionIsCP = false) => {
    if (event._trace) {
      console.log(`In funcExec.js  with event: ${JSON.stringify(event)}`)
    }
    valid(event)
    if (loadGenFunctionIsCP)
    {
      return impl.httpInvocation(event);
    }
    return impl.httpInvocation(event)
  }
}

module.exports = impl.execute
