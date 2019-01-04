const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs'))
const os = require('os')
const path = require('path')
const slsArt = require('../lib/')

const constants = {
  bootstrap_error :
    `Error occured. Serverless-Artillery requires either Google Cloud Platform (GCP) or Amazon Web Service (AWS) to operate. 
   1) Learn how to setup GCP by following the instructions here: https://serverless.com/framework/docs/providers/google/guide/credentials/ 
   2) OR, Learn how to set up AWS provider credentials in our docs here: <http://bit.ly/aws-creds-setup>.)`
}

class CommandNotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CommandNotFoundError'
  }
}
const impl = {
  validateCloudProviderValue: (options) => {
    if (options['cloud-provider'] === slsArt.cloudProvider.aws || options['cloud-provider'] === slsArt.cloudProvider.google)
    {
      return options['cloud-provider'];
    }
    else {
      throw new Error(
        `Invalid cloud-provider value: ${options['cloud-provider']}. Valid values are ` +
        `\'${slsArt.cloudProvider.google}\' or \'${slsArt.cloudProvider.aws}\'`)
    }
  },
  runCommand: (options) => {
    const command = options._[0]

    if (options.debug) {
      console.log(`options were:${os.EOL}${JSON.stringify(options, null, 2)}`)
    }

    if (!(command in slsArt)) {
      throw new CommandNotFoundError(`The command ${command} is not recognized`)
    }

    var cloudProvider = impl.validateCloudProviderValue(options);
    if (cloudProvider) {
      if (options.debug) {
        console.log(
          `command that will be executed: slsArt[${command}](${cloudProvider}, ${JSON.stringify(options)})
      with process args: ${process.argv}`)
      }
      return slsArt[command](cloudProvider, options)
    }
    throw new Error(bootstrap_error)
  }
}

module.exports = impl.runCommand
module.exports.CommandNotFoundError = CommandNotFoundError

// TODO remove before publishing?
/* test-code */
module.exports.impl = impl
/* end-test-code */
