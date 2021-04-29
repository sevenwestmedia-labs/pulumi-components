import * as pulumi from '@pulumi/pulumi'
import { EcsWaiter, EcsWaiterProps } from './dynamic-resource'

export type WaitForEcsDeploymentArgs = EcsWaiterProps

export class WaitForEcsDeployment extends pulumi.ComponentResource {
    public readonly clusterName: pulumi.Output<string>
    public readonly serviceName: pulumi.Output<string>
    public readonly desiredTaskDef: pulumi.Output<string>
    public readonly status: pulumi.Output<string>
    public readonly failureMessage: pulumi.Output<string>
    public readonly timeoutMs?: pulumi.Output<number>

    constructor(
        name: string,
        args: WaitForEcsDeploymentArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('swm:wait-for-ecs/WaitForEcsDeployment', name, {}, opts)

        const waiter = new EcsWaiter(name, args, opts)

        pulumi
            .all([waiter.status, waiter.failureMessage])
            .apply(([status, failureMessage]) => {
                if (status !== 'COMPLETED') {
                    throw new pulumi.ResourceError(
                        `ECS deployment failed: ${failureMessage}`,
                        this,
                    )
                }
            })

        this.status = waiter.status
        this.failureMessage = waiter.failureMessage
        this.clusterName = pulumi.output(args.clusterName)
        this.serviceName = pulumi.output(args.serviceName)
        this.desiredTaskDef = pulumi.output(args.desiredTaskDef)
        this.timeoutMs = args.timeoutMs
            ? pulumi.output(args.timeoutMs)
            : undefined
    }
}
