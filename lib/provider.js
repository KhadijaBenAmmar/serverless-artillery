const BbPromise = require('bluebird')
const fs = BbPromise.promisifyAll(require('fs'))
const os = require('os')
const path = require('path')
const slsArt = require('../lib/')

const constants = {
  bootstrap_error :
    `Error occured. Serverless-Artillery requires either Google Cloud Platform (GCP) or Amazon Web Service (AWS) to operate. 
   1) Learn how to setup GCP by following the instructions here: https://serverless.com/framework/docs/providers/google/guide/credentials/ 
   2) OR, Learn how to set up AWS provider credentials in our docs here: <http://bit.ly/aws-creds-setup>.)`,
  gcpCredentialFileArg: "--gcp-creds-file",
  cloudPlatformArg: "--cloud-platform"
}

class CommandNotFoundError extends Error {
  constructor(message) {
    super(message)
    this.name = 'CommandNotFoundError'
  }
}
const impl = {
  determineCloudPlatform: (options) => {
    if (options && options.cloud_platform) {
      if (options.verbose) {
        console.log(`cloud_platform argument already exists, value = ${options.cloud_platform}`)
      }
      if (options.cloud_platform === slsArt.cloudPlatform.aws || options.cloud_platform === slsArt.cloudPlatform.gcp)
      {
        return BbPromise.resolve(options.cloud_platform)
      }
      else {
        throw new Error(
          `Invalid cloud_platform value: ${options.cloud_platform}. Valid values are ` +
          `\'${slsArt.cloudPlatform.gcp}\' or \'${slsArt.cloudPlatform.aws}\'`)
      }
    }
    var availableProviders = {}
    const gcpServerlessLoader = slsArt.impl.serverlessLoader(slsArt.cloudPlatform.gcp)
      .then((serverless) => {
        const authClient = serverless.getProvider('google').getAuthClient()
        if (authClient != null) {
          return true
        }
        return false
      }
    ).catch((ex) => {
        if (options.debug) {
          console.log(ex)
        }
        return false
    })

    const awsServerlessLoader = slsArt.impl.serverlessLoader(slsArt.cloudPlatform.aws)
      .then((serverless) => {
        const awsProvider = serverless.getProvider(slsArt.cloudPlatform.aws)
        const credentials = awsProvider.getCredentials()
        if (credentials.accessKey && credentials.accessKey != 'undefined'
          && credentials.secretAccessKey && credentials.secretAccessKey != 'undefined') {
          return true
        }
        return false
      }
    ).catch((ex) => {
      if (options.debug) {
        console.log(ex)
      }
      return false
    })

    return BbPromise.all([gcpServerlessLoader, awsServerlessLoader])
      .then( ([gcloudExists, awsExists]) => {
        // if both exists, it is ambiguous, so an error
        if (gcloudExists && awsExists) {
          throw new Error(`Not able to determine the cloud platform since both the ~/.aws and ~/.gcloud directories exist. ` +
            `${constants.bootstrap_error}`)
        }
        if (gcloudExists) {
          console.log('Determining gcp as cloud platform since ~/.gcloud exists')
          return slsArt.cloudPlatform.gcp
        }

        if (awsExists) {
          console.log('Determining aws as cloud platform since ~/.aws exists')
          return slsArt.cloudPlatform.aws
        }

        // none of the cloud platform directories exist, throw an error
        throw new Error(constants.bootstrap_error)
      }
    )
  },
  findServiceAccountCredentialsFileForGCPPlatform: (cloudPlatform, options) => {
    if (cloudPlatform === slsArt.cloudPlatform.aws) {
      throw new Error(`No credentials file required for cloud platform = ${cloudPlatform}. Returning`)
    }
    if (options && options.gcp_creds_file) {
      throw new Error(`gcp_creds_file argument already exists. That one should be used instead`)
    }
    const homeDir = os.homedir()
    const defaultGcloudDir = path.join(homeDir, ".gcloud")
    const jsonFiles = []
    if (fs.existsSync(defaultGcloudDir)) {
      var stat = fs.lstatSync(defaultGcloudDir);
      if (stat.isDirectory()) {
        fs.readdirSync(defaultGcloudDir).forEach(fileName => {
          if (fileName.endsWith(".json")) {
            jsonFiles.push(fileName)
          }
        })
      }
      else {
        throw new Error(`.gcloud file exists but is not a directory in the home=${homeDir} directory. ${constants.bootstrap_error}`)
      }
    }
    else {
      throw new Error(`.gcloud directory does not exist in home=${homeDir} directory. ${constants.bootstrap_error}`)
    }

    if (jsonFiles.length === 1) {
      const jsonCredFile = path.join(defaultGcloudDir, jsonFiles[0])
      if (options.verbose) {
        console.log(`Returning the file ${jsonCredFile} as the credentials file for GCP platform`)
      }
      return jsonCredFile
    }
    else if (jsonFiles.length > 1) {
      throw new Error(`Multiple json files in ${defaultGcloudDir} = ${JSON.stringify(jsonFiles)}, ` +
        `Set the path to the file explicitly by using the argument ${cloudPlatformArgs.gcpCredentialFileArg}. ${os.EOL} ${constants.bootstrap_error}`)
    }
    else {
      throw new Error(`No service account credential json file present in ` +
        `the default gcloud directory: ${defaultGcloudDir}. ${constants.bootstrap_error}`)
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

    return impl.determineCloudPlatform(options)
      .then ((cloudPlatform) => {
        // set the credentials file argument
        if (cloudPlatform === slsArt.cloudPlatform.gcp && (options && !options.gcp_creds_file)) {
          var serviceAccountCredentialsFile = provider.findServiceAccountCredentialsFileForGCPPlatform(cloudPlatform, options)
          if (!serviceAccountCredentialsFile) {
            throw new Error(`No service account credentials file present for the GCP cloud platform. ${constants.bootstrap_error}`)
          }
          process.argv.push(`${cloudPlatformArgs.gcpCredentialFileArg}`)
          process.argv.push(serviceAccountCredentialsFile)
        }

        if (options.debug) {
          console.log(
            `command that will be executed: slsArt[${command}](${cloudPlatform}, ${JSON.stringify(options)})
      with process args: ${process.argv}`)
        }

        return slsArt[command](cloudPlatform, options)
      })
  }
}

module.exports = impl.runCommand
module.exports.CommandNotFoundError = CommandNotFoundError

// TODO remove before publishing?
/* test-code */
module.exports.impl = impl
/* end-test-code */
