const { getJestProjects } = require('@nrwl/jest')

module.exports = {
    projects: [
        ...getJestProjects(),
        '<rootDir>/apps/sample-pulumi-static-site',
    ],
}
