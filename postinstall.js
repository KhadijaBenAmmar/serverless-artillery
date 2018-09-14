const path = require('path')

const npm = require('./lib/npm')

const installPathLambda = path.join(__dirname, 'lib', 'lambda')
const installPathGcf = path.join(__dirname, 'lib', 'gcf')

npm.install(installPathLambda) // will throw out and fail install if this times out or returns a non-zero result
npm.install(installPathGcf) // will throw out and fail install if this times out or returns a non-zero result
