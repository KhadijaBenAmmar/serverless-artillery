//const gcp = require('@google/cloudfunctions') // eslint-disable-line import/no-extraneous-dependencies
const {google} = require('googleapis')
const valid = require('./funcValid')

const cloudfunctions = google.cloudfunctions('v1')

const impl = {
  /**
   * Invoke a new instance of this function with the given event using the given invocation type.
   * @param event The event to invoke a new instance of this function with
   * @param type The type of invocation for the new instance
   * @returns {Promise<PromiseResult<Payload>>}
   */
  execute: (event, type) => {
    valid(event)

    const params = {
      FunctionName: event._funcAws.functionName, // eslint-disable-line no-underscore-dangle
      InvocationType: type || 'Event',
      Payload: JSON.stringify(event),
    }
    if (process.env.SERVERLESS_STAGE) {
      params.FunctionName += `:${process.env.SERVERLESS_STAGE}`
    }
    return ""
    /* return lambda.invoke(params).promise()
      .then((res) => {
        try {
          return JSON.parse(res.Payload)
        } catch (ex) {
          console.error(`Error parsing lambda execution payload:\n${res.Payload}\nCaused error:\n${ex.stack}`)
          return undefined // ignore error
        }
      })
      .catch((ex) => {
        console.error('Error invoking self:')
        console.error(ex.stack)
        return Promise.reject(new Error(`ERROR invoking self: ${ex.message}`))
      }) */
  },
}

module.exports = impl.execute
