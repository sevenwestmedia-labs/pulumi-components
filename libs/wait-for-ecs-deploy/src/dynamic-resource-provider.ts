import {
    ECSClient,
    DescribeServicesCommand,
    waitUntilServicesStable,
    Service,
} from '@aws-sdk/client-ecs'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'
import cuid from 'cuid'
import * as pulumi from '@pulumi/pulumi'

export interface State {
    clusterName: pulumi.Input<string>
    serviceName: pulumi.Input<string>
    status: pulumi.Input<string> // 'COMPLETED' | 'FAILED'
    failureMessage: pulumi.Input<string>
    desiredTaskDef: pulumi.Input<string>
    timeoutMs: pulumi.Input<number>
}

export interface Inputs {
    clusterName: string
    serviceName: string
    desiredTaskDef: string
    timeoutMs?: number
    awsRegion?: string
    assumeRole?: string
}

export const dynamicProvider: pulumi.dynamic.ResourceProvider = {
    create: async (inputs: Inputs) => ({
        id: cuid(),
        outs: await waitForService(inputs),
    }),
    update: async (_id: unknown, _olds: unknown, news: Inputs) => ({
        outs: await waitForService(news),
    }),
}

export async function waitForService(inputs: Inputs): Promise<State> {
    const timeoutMs = inputs.timeoutMs ?? 180000 // returns 3 minutes (180 seconds or 180000 ms) if the left hand operator is undefined

    const ecsClient = new ECSClient({
        region: inputs.awsRegion,
        credentials: inputs.assumeRole
            ? fromTemporaryCredentials({
                  params: {
                      RoleArn: inputs.assumeRole,
                      RoleSessionName: `wait-for-ecs.ecs.${cuid()}`,
                  },
              })
            : undefined,
    })

    const maxAttempts = Math.max(1, Math.round(timeoutMs / (1000 * 6)))

    await waitUntilServicesStable(
        {
            client: ecsClient,
            maxWaitTime: timeoutMs / 1000, // Total wait time in seconds
            maxDelay: 6, // Maximum delay between attempts in seconds
        },
        {
            cluster: inputs.clusterName,
            services: [inputs.serviceName],
        },
    )

    pulumi.log.debug(`waitForService: services are stable`)

    const describeCommand = new DescribeServicesCommand({
        cluster: inputs.clusterName,
        services: [inputs.serviceName],
    })

    const describeResponse = await ecsClient.send(describeCommand)
    const services = describeResponse.services

    if (!services || services.length === 0) {
        throw new Error('No services found!')
    }

    const failedServices = services.filter((s) =>
        hasFailed(s, inputs.desiredTaskDef),
    )

    const failureMessage =
        failedServices.length > 0
            ? `One or more services failed to deploy: ${failedServices
                  .map((service) => service.serviceName)
                  .join(', ')}`
            : ''

    const status = failedServices.length > 0 ? 'FAILED' : 'COMPLETED'

    const retval: pulumi.UnwrappedObject<State> = {
        clusterName: inputs.clusterName,
        serviceName: inputs.serviceName,
        desiredTaskDef: inputs.desiredTaskDef,
        failureMessage,
        status,
        timeoutMs,
    }

    pulumi.log.debug(
        `waitForService: successful return: ${JSON.stringify(retval)}`,
    )

    return retval
}

function hasFailed(service: Service, desiredTaskDef?: string): boolean {
    if (
        service.deployments?.some(
            (deployment) =>
                deployment.status === 'PRIMARY' &&
                deployment.taskDefinition !== desiredTaskDef &&
                deployment.rolloutState === 'COMPLETED',
        )
    ) {
        return true
    }

    if (
        service.deployments?.some(
            (deployment) => deployment.rolloutState === 'FAILED',
        )
    ) {
        return true
    }

    if (
        service.deployments?.some(
            (deployment) =>
                deployment.rolloutState === 'IN_PROGRESS' &&
                ((deployment.rolloutStateReason ?? '').includes(
                    'rolling back',
                ) ||
                    (deployment.rolloutStateReason ?? '').includes(
                        'rolled back',
                    ) ||
                    (deployment.rolloutStateReason ?? '').includes(
                        'circuit breaker',
                    )),
        )
    ) {
        return true
    }

    return false
}
