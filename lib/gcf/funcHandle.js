const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')
const promisify = require('util-promisify')
const util = require('util')


const {
  MAX_TIMEOUT_BUFFER_IN_MILLISECONDS: maxTimeoutBuffer,
  MERGE_FIELD: mergeFileField,
  DEFAULT_MAX_CHUNK_DURATION_IN_SECONDS: defaultMaxChunkDurationInSeconds
} = require('./funcDef')
const valid = require('./funcValid')

const readFileAsync = promisify(fs.readFile)

const impl = {
  createUnhandledRejectionHandler: (finish, error = console.error) => (ex) => {
    error([
      '###############################################################',
      '##             !! Unhandled promise rejection !!             ##',
      '##                                                           ##',
      '## Please report this and the following stack trace at:      ##',
      '## https://github.com/Nordstrom/serverless-artillery/issues  ##',
      '###############################################################',
      ex.stack.split('\n').map(line => `## ${line}`).join('\n'),
      '###############################################################',
    ].join('\n'))
    finish(
      `##!! Unhandled promise rejection: ${
        ex.message
      }, please report to https://github.com/Nordstrom/serverless-artillery/issues !!##`)
  },

  handleTimeout: (finish, error = console.error) => {
    error([
      '################################################################',
      '##                   !! Function Timeout !!                   ##',
      '## This probably results from a dropped response or unforseen ##',
      '## overly long response time from the target and likely an    ##',
      '## error.  To handle the circumstance but avoid additional,   ##',
      '## redundant, executions of your script success was reported  ##',
      '## to the function as a service infrastructure.               ##',
      '################################################################',
    ].join('\n'))
    finish('Error: function timeout')
  },

  getMergeFilePath: (
    mergeFileInput,
    resolve = path.resolve,
    dirname = __dirname
  ) => {
    const reject = message => Promise.reject(new Error(message))
    if (!mergeFileInput || typeof mergeFileInput !== 'string') {
      return reject(`'${typeof mergeFileInput}' is not a valid path.`)
    }
    const absolutePath = resolve(mergeFileInput)
    if (!absolutePath.startsWith(dirname)) {
      return reject(`Merge file ${absolutePath} is not a local file path.`)
    }
    return Promise.resolve(absolutePath)
  },

  readMergeFile: (
    mergeFilePath,
    readFile = readFileAsync,
    error = console.error,
    getMergeFilePath = impl.getMergeFilePath
  ) =>
    getMergeFilePath(mergeFilePath)
      .then(readFile)
      .then(safeLoad)
      .catch((ex) => {
        error('Failed to read merge file.', mergeFilePath, ex.stack)
        throw ex
      }),

  mergeIf: (input, readMergeFile = impl.readMergeFile, field = mergeFileField) =>
    (field in input
      ? readMergeFile(input[field])
        .then(inputData => merge({}, inputData, omit(input, [field])))
      : Promise.resolve(input)),

  mergeAndInvoke: (
    taskHandler,
    input,
    mergeIf = impl.mergeIf,
    error = console.error
  ) =>
    mergeIf(input)
      .then((event) => {
        valid(event)
        return taskHandler(event)
          .catch((ex) => {
            error(ex.stack)
            return `Error executing task: ${ex.message}`
          })
      })
      .catch((ex) => {
        error(ex.stack)
        return `Error validating event: ${ex.message}`
      }),

  callbackOnce: (callback) => {
    let hasCalledBack = false
    return (result) => {
      if (hasCalledBack) {
        return
      }
      hasCalledBack = true
      callback(undefined, result)
    }
  },

  addMetadataToInput: (input, { functionName }) =>
    Object.assign(
      {},
      input,
      {
        _funcAws: { functionName },
      }
    ),

  createHandler: (
    {
      createUnhandledRejectionHandler,
      handleTimeout,
      mergeAndInvoke,
      addMetadataToInput,
      readTimeout,
    } = impl,
    timeoutMs = maxTimeoutBuffer
  ) =>
    taskHandler =>
       (request, response) => {
        const callback = (error, result) =>
        {
          console.log(`Callback called with error: ${error}, result = ${JSON.stringify(result)}`)
          if (error) {
            response.json(error)
          }
          else {
            response.json(result)
          }
        }
        console.log(`request: ${util.inspect(request)}`)
        //console.log(`request body: ${JSON.stringify(request.body)}`)
        input = request.body
        const finished = impl.callbackOnce(callback)
        const onUnhandledRejection =
          createUnhandledRejectionHandler(finished)
        process.on('unhandledRejection', onUnhandledRejection)
        process.on('unhandledException', onUnhandledRejection)
        let timeout
        const then = Date.now()
        readTimeout().then(amountMs => {
          timeout = setTimeout(
              () => handleTimeout(finished), amountMs - timeoutMs - (Date.now()  - then)
              // TODO: Find how to find with GCF on how to find remaining function execution time
           )
          })
        mergeAndInvoke(taskHandler, input)
          .catch(ex => `Error executing handler: ${ex.message}`)
          .then((result) => {
            process.removeListener('unhandledRejection', onUnhandledRejection)
            process.removeListener('unhandledException', onUnhandledRejection)
            clearTimeout(timeout)
            finished(result)
          })
      },
  readTimeout: (directory = __dirname) =>
    readFileAsync(path.join(directory, 'serverless.yml'))
      .then(safeLoad)
      .then((service) => {
          console.trace(`service.functions.loadGenerator.timeout: ${service.functions.loadGenerator.timeout}`)
          console.trace(`service.provider.timeout: ${service.provider.timeout}`)
          var effectiveTimeOut = service.functions.loadGenerator.timeout || service.provider.timeout
          if (effectiveTimeOut) {
            effectiveTimeOut = effectiveTimeOut.slice(0, -1)
            effectiveTimeOut = parseInt(effectiveTimeOut)
            return Promise.resolve(effectiveTimeOut * 1000)
          }
          return Promise.resolve(60000)
        }
      )
}

module.exports = impl.createHandler()

/* test-code */
module.exports.impl = impl
/* end-test-code */
