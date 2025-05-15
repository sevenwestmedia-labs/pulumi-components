import fs from 'fs'
import path from 'path'
import { ECSClient, DescribeServicesCommand } from '@aws-sdk/client-ecs'
import { mockClient } from 'aws-sdk-client-mock'
import { waitForService } from './dynamic-resource-provider'

const ecsMock = mockClient(ECSClient)

jest.setTimeout(25000)

describe('#waitForServices', () => {
    beforeEach(() => {
        ecsMock.reset()
    })

    it('should return COMPLETED when a service is successfully deployed', async () => {
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

    it('should return FAILED when one or more services has failed and a rollback is in progress', async () => {
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

    it('should time out if it takes too long', async () => {
        const file = path.join(
            __dirname,
            '__data__',
            'ecs-describe-services-all-services-deployed.json',
        )
        const { json, clusters, serviceCount } = getSampleResponseFromFile(file)
        expect.assertions(serviceCount)

        // Simulate a long-running operation by returning a promise that never resolves
        ecsMock
            .on(DescribeServicesCommand)
            .callsFake(() => new Promise(() => {}))

        for (const cluster of clusters) {
            for (const service of cluster.services) {
                const result = waitForService({
                    clusterName: cluster.clusterName,
                    serviceName: service.serviceName,
                    desiredTaskDef: service.taskDefinition,
                    timeoutMs: 20000,
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

    if (!clusterArns || clusterArns.length < 1) {
        throw new Error('clusterArns missing from mock response!')
    }

    const clusters: Array<{
        clusterName: string
        services: Array<{
            serviceName: string
            taskDefinition: string
        }>
    }> = []

    let serviceCount = 0

    for (const clusterArn of clusterArns) {
        if (!clusterArn) {
            throw new Error('clusterArn missing from mock response!')
        }

        const clusterName = clusterArn.replace(/.*\//, '')
        const services = json.services
            ?.filter((service) => service.clusterArn === clusterArn)
            .map((service) => ({
                serviceName: service.serviceName,
                taskDefinition: service.taskDefinition,
            }))

        if (
            !services ||
            services.length < 1 ||
            services.some((s) => !s.serviceName) ||
            services.some((s) => !s.taskDefinition)
        ) {
            throw new Error('serviceNames missing from mock response!')
        }

        serviceCount += services.length

        clusters.push({
            clusterName,
            services: services as Array<{
                serviceName: string
                taskDefinition: string
            }>,
        })
    }

    return {
        clusters,
        json,
        mockResponse,
        serviceCount,
    }
}
