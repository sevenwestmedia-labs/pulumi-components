import fs from 'fs'
import path from 'path'

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { ECS } = require('aws-sdk')
jest.mock('aws-sdk')

import { waitForService } from './dynamic-resource-provider'

/**
 * Mock ECS client implements describeServices method, returning the specified
 * response. Also includes a dummy waitFor method.
 * @param describeServicesResponse the response to be returned by
 * describeServices
 * @returns a mock ECS client implementation, for use with jest mocking
 */
function mockedEcs(describeServicesResponse: unknown) {
    return () => ({
        describeServices: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue(describeServicesResponse),
        }),
        waitFor: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue(null),
        }),
    })
}

/**
 * Mock ECS client implements a dummy waitFor method that never resolves.
 * Also includes a dummy describeServices method
 * @returns a mock ECS client implementation, for use with jest mocking
 */
function mockedEcsDeploymentTimeout(describeServicesResponse: unknown) {
    return () => ({
        describeServices: jest.fn().mockReturnValue({
            promise: jest.fn().mockResolvedValue(describeServicesResponse),
        }),
        waitFor: jest.fn().mockReturnValue({
            promise: jest.fn(
                async () =>
                    await new Promise((resolve) => {
                        const timer = setTimeout(() => {
                            clearTimeout(timer)
                            resolve('done')
                        }, (1 << 31) - 1 /* maximum value for a 32-bit signed integer */)
                    }),
            ),
        }),
    })
}

describe('#waitForServices', () => {
    beforeEach(async (done) => {
        jest.resetAllMocks()
        done()
    })

    it('should return COMPLETED when a service is successfully deployed', async () => {
        const file = path.join(
            __dirname,
            '__mocks__',
            'ecs-describe-services-all-services-deployed.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ECS.mockImplementation(mockedEcs(json))

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService({
                    clusterName: cluster.clusterName,
                    serviceName: service.serviceName,
                    desiredTaskDef: service.taskDefinition,
                })
                await expect(result).resolves.toHaveProperty(
                    'status',
                    'COMPLETED',
                )
            }
        }
    })

    it('should return FAILED when one or more services has failed and a rollback is in progress', async () => {
        const file = path.join(
            __dirname,
            '__mocks__',
            'ecs-describe-services-failed-rollback-in-progress.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ECS.mockImplementation(mockedEcs(json))

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService({
                    clusterName: cluster.clusterName,
                    serviceName: service.serviceName,
                    desiredTaskDef: service.taskDefinition,
                })
                await expect(result).resolves.toHaveProperty('status', 'FAILED')
            }
        }
    })

    it('should return FAILED when a rollback has completed', async () => {
        const file = path.join(
            __dirname,
            '__mocks__',
            'ecs-describe-services-failed-rolled-back.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ECS.mockImplementation(mockedEcs(json))

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService({
                    clusterName: cluster.clusterName,
                    serviceName: service.serviceName,
                    desiredTaskDef: `${service.taskDefinition}2`,
                })
                await expect(result).resolves.toHaveProperty('status', 'FAILED')
            }
        }
    })

    /**
     * skipped because I couldn't get it working without jest.useFakeTimers()
     */
    it.skip('should time out if it takes too long', async () => {
        const file = path.join(
            __dirname,
            '__mocks__',
            'ecs-describe-services-all-services-deployed.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ECS.mockImplementation(mockedEcsDeploymentTimeout(json))
        //jest.useFakeTimers()

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService(
                    {
                        clusterName: cluster.clusterName,
                        serviceName: service.serviceName,
                        desiredTaskDef: service.taskDefinition,
                    },
                    10 /* timeout: 10ms */,
                )
                await expect(result).resolves.toHaveProperty('status', 'FAILED')
            }
        }
        //jest.runAllTimers()
    })
})

function getSampleResponseFromFile(filename: string) {
    const mockResponse = fs.readFileSync(filename).toString()
    const json = JSON.parse(mockResponse) as AWS.ECS.DescribeServicesResponse

    const clusterArns = json.services?.map((service) => service.clusterArn)

    if (clusterArns === undefined || clusterArns.length < 1) {
        throw new Error('clusterArns missing from mock response!')
    }

    let clusters: Array<{
        clusterName: string
        services: Array<{
            serviceName: string
            taskDefinition: string
        }>
    }> = []

    let serviceCount = 0

    for (const clusterArn of clusterArns) {
        if (clusterArn === undefined) {
            throw new Error('clusterArn missing from mock response!')
        }

        const clusterName = clusterArn?.replace(/.*\//, '')
        const services = json.services
            ?.filter((service) => service.clusterArn === clusterArn)
            .map((service) => ({
                serviceName: service.serviceName,
                taskDefinition: service.taskDefinition,
            }))

        if (
            services === undefined ||
            services.length < 1 ||
            services.some((s) => s.serviceName === undefined) ||
            services.some((s) => s.taskDefinition === undefined)
        ) {
            throw new Error('serviceNames missing from mock response!')
        }

        serviceCount += services.length

        clusters = [
            ...clusters,
            {
                clusterName,
                services: services as Array<{
                    serviceName: string
                    taskDefinition: string
                }>,
            },
        ]
    }

    return {
        clusters,
        json,
        mockResponse,
        serviceCount,
    }
}
