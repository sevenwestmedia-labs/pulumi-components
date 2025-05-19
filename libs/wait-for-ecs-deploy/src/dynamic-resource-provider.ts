import * as pulumi from '@pulumi/pulumi'
import cuid from 'cuid'
import {
    ECSClient,
    DescribeServicesCommand,
    waitUntilServicesStable,
    Service,
} from '@aws-sdk/client-ecs'
import { fromTemporaryCredentials } from '@aws-sdk/credential-providers'

export interface State {
    clusterName: pulumi.Input<string>
    serviceName: pulumi.Input<string>
    status: pulumi.Input<string> //'COMPLETED' | 'FAILED'
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

/**
 * Wait for ECS to stabilize, then check to see if the latest deployment(s)
 * were successful. A timeout is treated as a failed deployment.
 * @param inputs inputs
 * @returns a State object representing the deployment result.
 */
export async function waitForService(inputs: Inputs) {
    const timeoutMs = inputs.timeoutMs ?? 180000
    pulumi.log.debug(`waitForService: timeoutMs is ${timeoutMs}`)

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
    const delay = 2

    await waitUntilServicesStable(
        {
            client: ecsClient,
            maxWaitTime: delay * maxAttempts, // in seconds
            minDelay: 6, // seconds between retries
            maxDelay: 6,
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

    if (!services) {
        throw new Error('No services found!')
    }

    const failedServices = services.filter((s) =>
        hasFailed(s, inputs.desiredTaskDef),
    )

    const failureMessage =
        failedServices.length > 0
            ? `One or more services failed to deploy: ${failedServices.map(
                  (service) => service.serviceName,
              )}`
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

/**
 * Check whether a deployment has failed. Checks rolloutState and
 * rolloutStateReason to see if the circuit breaker has triggered.
 *
 * Note that rollbacks trigger a new deployment; if rollbacks are
 * enabled, you should also provide a desiredTaskDef to detect the
 * rollback.
 *
 * @param service the esc service object to examine
 * @param desiredTaskDef optional task definition to check
 * @returns boolean true if the deployment failed
 */
function hasFailed(service: Service, desiredTaskDef?: string) {
    // primary deployment does not match the desired taskDef
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
