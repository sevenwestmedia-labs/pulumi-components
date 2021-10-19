/* eslint-disable @typescript-eslint/no-var-requires */
const path = require('path')
const tsConfig = require(__dirname + '/../../../tsconfig.base.json')
const tsConfigPaths = require('tsconfig-paths')
const args = {
    baseUrl: path.resolve(__dirname + '/../../..'),
    paths: tsConfig.compilerOptions.paths,
}
tsConfigPaths.register(args)

module.exports = require('./main')
