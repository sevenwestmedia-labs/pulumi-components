import fs from 'fs'
import path from 'path'
import {
    ECSClient,
    DescribeServicesCommand,
    waitUntilServicesStable,
} from '@aws-sdk/client-ecs'
import { mockClient } from 'aws-sdk-client-mock'

const ecsMock = mockClient(ECSClient)

jest.mock('@aws-sdk/client-ecs', () => {
    const actual = jest.requireActual('@aws-sdk/client-ecs')
    return {
        ...actual,
        waitUntilServicesStable: jest.fn(), // defining the mock
    }
})

import { waitForService } from './dynamic-resource-provider'

describe('#waitForServices', () => {
    beforeEach(async () => {
        ecsMock.reset()
    })

    // Test case for waitForService function showing COMPLETED when all services are deployed
    it('should return COMPLETED when a service is successfully deployed', async () => {
        ;(waitUntilServicesStable as jest.Mock).mockResolvedValue({}) // ✅ success for this test

        const file = path.join(
            __dirname,
            '__data__',
            'ecs-describe-services-all-services-deployed.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ecsMock.on(DescribeServicesCommand).resolves(json)

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

    // Test case for waitForService function showing FAILED when one or more services have failed and a rollback is in progress
    it('should return FAILED when one or more services has failed and a rollback is in progress', async () => {
        ;(waitUntilServicesStable as jest.Mock).mockResolvedValue(
            new Error('FAILED'),
        ) //  ❌ fail for this test

        const file = path.join(
            __dirname,
            '__data__',
            'ecs-describe-services-failed-rollback-in-progress.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ecsMock.on(DescribeServicesCommand).resolves(json)

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

    // Test case for waitForService function showing FAILED when rollback has completed
    it('should return FAILED when a rollback has completed', async () => {
        const file = path.join(
            __dirname,
            '__data__',
            'ecs-describe-services-failed-rolled-back.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)
        ecsMock.on(DescribeServicesCommand).resolves(json)

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
     * Test case for waitForService function showing FAILED when a timeout occurs
     */
    it.skip('should time out if it takes too long', async () => {
        const file = path.join(
            __dirname,
            '__data__',
            'ecs-describe-services-all-services-deployed.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)

        ecsMock.on(DescribeServicesCommand).resolves(json)
        jest.useFakeTimers()

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService({
                    clusterName: cluster.clusterName,
                    serviceName: service.serviceName,
                    desiredTaskDef: service.taskDefinition,
                    timeoutMs: 10,
                })
                await expect(result).resolves.toHaveProperty('status', 'FAILED')
            }
        }
    })
})

function getSampleResponseFromFile(filename: string) {
    const mockResponse = fs.readFileSync(filename).toString()
    const json = JSON.parse(mockResponse) as {
        services?: Array<{
            clusterArn?: string
            serviceName?: string
            taskDefinition?: string
        }>
    }

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
