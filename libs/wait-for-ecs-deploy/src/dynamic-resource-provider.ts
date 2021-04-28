import * as pulumi from '@pulumi/pulumi'
import aws from 'aws-sdk'
import cuid from 'cuid'

export interface State {
    clusterName: pulumi.Input<string>
    serviceName: pulumi.Input<string>
    status: pulumi.Input<string> //'COMPLETED' | 'FAILED'
    failureMessage: pulumi.Input<string>
    desiredTaskDef: pulumi.Input<string>
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
        outs: await waitForService(inputs, inputs.timeoutMs),
    }),
    update: async (_id: unknown, _olds: unknown, news: Inputs) => ({
        outs: await waitForService(news),
    }),
}

/**
 * Wait for ECS to stabilize, then check to see if the latest deployment(s)
 * were successful. A timeout is treated as a failed deployment.
 * @param inputs inputs
 * @param timeoutMs timeout
 * @returns a State object representing the deployment result.
 */
export async function waitForService(inputs: Inputs, timeoutMs = 180000) {
    const retval = await Promise.race([
        // current circuit breakers don't catch all error conditions,
        // eg https://github.com/aws/containers-roadmap/issues/1206 --
        // this timeout will cause a deployment to fail after a certain
        // amount of time.
        new Promise<pulumi.UnwrappedObject<State>>((resolve) => {
            const timer = setTimeout(() => {
                clearTimeout(timer)
                const result: pulumi.UnwrappedObject<State> = {
                    status: 'FAILED',
                    failureMessage: `Timed out after ${
                        timeoutMs / 1000
                    } seconds`,
                    clusterName: inputs.clusterName,
                    serviceName: inputs.serviceName,
                    desiredTaskDef: inputs.desiredTaskDef,
                }
                // note that this is _always_ printed
                //TODO cancel this timeout when the main promise resolves!
                pulumi.log.debug(
                    `reached timeout, returning ${JSON.stringify(result)}`,
                )
                resolve(result)
            }, timeoutMs)
        }),
        (async () => {
            const ecs = new aws.ECS({
                region: inputs.awsRegion,
                credentials: inputs.assumeRole
                    ? new aws.TemporaryCredentials({
                          RoleArn: inputs.assumeRole,
                          RoleSessionName: `wait-for-ecs.ecs.${cuid()}`,
                      })
                    : undefined,
            })

            await ecs
                .waitFor('servicesStable', {
                    cluster: inputs.clusterName,
                    services: [inputs.serviceName],
                })
                .promise()
                .catch((err) => {
                    throw new pulumi.RunError(err)
                })

            pulumi.log.debug(`services are stable`)

            const services = await ecs
                .describeServices({
                    cluster: inputs.clusterName,
                    services: [inputs.serviceName],
                })
                .promise()
                .then((result) => result.services)
                .catch((err) => {
                    throw new pulumi.RunError(err)
                })

            if (!services) {
                throw new pulumi.RunError('No services found!')
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

            const result: pulumi.UnwrappedObject<State> = {
                clusterName: inputs.clusterName,
                serviceName: inputs.serviceName,
                desiredTaskDef: inputs.desiredTaskDef,
                failureMessage,
                status,
            }

            pulumi.log.debug(`successful return: ${JSON.stringify(result)}`)

            return result
        })().catch((err) => {
            throw err
        }),
    ])
    pulumi.log.debug(`return retval: ${JSON.stringify(retval)}`)
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
