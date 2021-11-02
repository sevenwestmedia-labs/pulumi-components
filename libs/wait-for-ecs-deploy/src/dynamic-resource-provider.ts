import * as pulumi from '@pulumi/pulumi'
import aws from 'aws-sdk'
import cuid from 'cuid'

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

    const ecs = new aws.ECS({
        region: inputs.awsRegion,
        credentials: inputs.assumeRole
            ? new aws.TemporaryCredentials({
                  RoleArn: inputs.assumeRole,
                  RoleSessionName: `wait-for-ecs.ecs.${cuid()}`,
              })
            : undefined,
    })

    // current circuit breakers don't catch all error conditions,
    // eg https://github.com/aws/containers-roadmap/issues/1206 --
    // this timeout will cause a deployment to fail after a certain
    // amount of time.
    await ecs
        .waitFor('servicesStable', {
            cluster: inputs.clusterName,
            services: [inputs.serviceName],
            $waiter: {
                delay: 6,
                maxAttempts: Math.max(1, Math.round(timeoutMs / (1000 * 6))),
            },
        })
        .promise()

    pulumi.log.debug(`waitForService: services are stable`)

    const services = await ecs
        .describeServices({
            cluster: inputs.clusterName,
            services: [inputs.serviceName],
        })
        .promise()
        .then((result) => result.services)

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
function hasFailed(service: aws.ECS.Service, desiredTaskDef?: string) {
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
