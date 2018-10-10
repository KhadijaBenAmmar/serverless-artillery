const fs = require('fs')
const { safeLoad } = require('js-yaml')
const merge = require('lodash.merge')
const omit = require('lodash.omit')
const path = require('path')
const promisify = require('util-promisify')
const util = require('util')


var instanceVar = 0
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

  addMetadataToInput: (input, { functionName, regionName, projectName }) =>
    Object.assign(
      {},
      input,
      {
        functionName: functionName,
        regionName: regionName,
        projectName: projectName
      }
    ),
  getTimeBufferMs: (input) =>
  {
    if (input && input._split) {
      if ('timeBufferInMilliseconds' in input._split) {
        return input._split.timeBufferInMilliseconds
      }
    }
    return maxTimeoutBuffer
  },
  createHandlerPubSubEvent: (
    {
      createUnhandledRejectionHandler,
      handleTimeout,
      mergeAndInvoke,
      addMetadataToInput,
      readTimeout,
      getFunctionName,
      getRegionName,
      getProjectName
    } = impl
  ) =>
    taskHandler2 =>
      (event, callback) => {

        var eventContext = event;
        if (event.context) {
          console.log("Found event.context")
          eventContext = event.context;
        }
        else
        {
          console.log("Didn't find event.context")
        }
        // log event age
        var eventAge = 0;
        if (eventContext.timestamp)
        {
          eventAge = Date.now() - Date.parse(eventContext.timestamp);
          console.log(`==== Event age is ${eventAge}ms`)
        }
        var eventId = ""
        if (eventContext.eventId)
        {
          eventId = eventContext.eventId
        }

        const context = {
          'functionName': getFunctionName(),
          'regionName': getRegionName(),
          'projectName': getProjectName()
        }
        const eventData = event.data;

        var input;
        // In case of GCF->GCF call, the data comes in event.data.data and is base64 encoded
        if (eventData.data) {
          actualInput = Buffer.from(eventData.data, 'base64').toString()
          input = JSON.parse(actualInput)
        }
        else {
          input = eventData;
        }


        const finished = impl.callbackOnce(callback)
        const onUnhandledRejection =
          createUnhandledRejectionHandler(finished)
        process.on('unhandledRejection', onUnhandledRejection)
        process.on('unhandledException', onUnhandledRejection);
        const timeBufferMs = impl.getTimeBufferMs(input)
        let timeout
        const then = Date.now()
        readTimeout().then(functionTimeoutMillis => {
          timeout = setTimeout(
            () => handleTimeout(finished), functionTimeoutMillis - timeBufferMs - (Date.now()  - then)
          )
        })
        mergeAndInvoke(taskHandler2, addMetadataToInput(input, context))
          .catch(ex => `Error executing handler: ${ex.message}`)
          .then((result) => {
            process.removeListener('unhandledRejection', onUnhandledRejection)
            process.removeListener('unhandledException', onUnhandledRejection)
            clearTimeout(timeout)
            console.log(`mergeAndInvoke returned, calling finished() with result: ${JSON.stringify(result)}`)
            finished(result)
          })
      },
  getRegionName: () => process.env.FUNCTION_REGION, // GCF environment variable
  getProjectName: () => process.env.GCP_PROJECT, // GCF environment variable
  getFunctionName: () => process.env.FUNCTION_NAME, // GCF environment variable
  readTimeout: (directory = __dirname) =>
    readFileAsync(path.join(directory, 'serverless.yml'))
      .then(safeLoad)
      .then((service) => {
          var effectiveTimout = service.functions.loadGenerator.timeout || service.provider.timeout
          if (effectiveTimout) {
            effectiveTimout = effectiveTimout.slice(0, -1)
            effectiveTimout = parseInt(effectiveTimout)
            return Promise.resolve(effectiveTimout * 1000)
          }
          return Promise.resolve(60000)
        }
      ),
  createHandlerHttp: (
    {
      createUnhandledRejectionHandler,
      handleTimeout,
      mergeAndInvoke,
      addMetadataToInput,
      readTimeout,
      getFunctionName,
      getRegionName,
      getProjectName
    } = impl
  ) =>
    taskHandler =>
       (request, response) => {
        var functionExecutionStartTime = Date.now();
        instanceVar = instanceVar + 1
         var isColdStart = (instanceVar === 1)


         var input = request.body;
         var httpEventAge = -1
        // Calculate event delay due to network + cold start + GCF delays
         if (input._invocationTime) {
           httpEventAge = functionExecutionStartTime - Number(input._invocationTime)
           console.log(`==== HTTP Event age = ${httpEventAge}ms. With coldstart = ${isColdStart}`)
         }
         const callback = (error, result) =>
         {
           if (error) {
             response.json(error)
           }
           else {
             response.json(result)
           }
         }

         if (input._trace)
         {
           console.log(`Coldstart: ${isColdStart}. event age = ${httpEventAge} \n. Request = ${JSON.stringify(input)}`)
           console.log(`Coldstart= ${isColdStart}. id= ${input._id}. event age = ${httpEventAge} \n Request headers= ${JSON.stringify(request.headers)}`)
         }


         console.log(`Function instance used = ${instanceVar} time(s)`)
         const context = {
            'functionName': getFunctionName(),
            'regionName': getRegionName(),
            'projectName': getProjectName()
          }

        const finished = impl.callbackOnce(callback)
        const onUnhandledRejection =
          createUnhandledRejectionHandler(finished)
        process.on('unhandledRejection', onUnhandledRejection)
        process.on('unhandledException', onUnhandledRejection);
        const timeBufferMs = impl.getTimeBufferMs(input)
        let timeout
        const then = Date.now()
        readTimeout().then(functionTimeoutMillis => {
          var sleepTimeMs = functionTimeoutMillis - timeBufferMs - (Date.now() - then)
          if (input._trace) {
            console.log(`timeout time = ${sleepTimeMs}ms`)
          }
          timeout = setTimeout(() => handleTimeout(finished), sleepTimeMs)
        })
        mergeAndInvoke(taskHandler, addMetadataToInput(input, context))
          .catch(ex => `Error executing handler: ${ex.message}`)
          .then((result) => {
            process.removeListener('unhandledRejection', onUnhandledRejection)
            process.removeListener('unhandledException', onUnhandledRejection)
            clearTimeout(timeout)
            finished(result)
          })
      },
}

module.exports = {
  funcHandlePubSubEvent: impl.createHandlerPubSubEvent(),
  funcHandleHTTP: impl.createHandlerHttp()
}

/* test-code */
module.exports.impl = impl
/* end-test-code */
