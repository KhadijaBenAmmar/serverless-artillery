// const axios = require('axios');

const valid = require('./funcValid')
const PubSub = require(`@google-cloud/pubsub`);
const pubsub = new PubSub();

const topicName = 'loadgeneratortopic';


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

    const dataBuffer = Buffer.from(JSON.stringify(event));
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
      });
  }
}
module.exports = impl.execute
