import * as pulumi from '@pulumi/pulumi'
import { dynamicProvider } from './dynamic-resource-provider'

export interface EcsWaiterProps {
    clusterName: pulumi.Input<string>
    serviceName: pulumi.Input<string>
    desiredTaskDef: pulumi.Input<string>
    timeoutMs?: pulumi.Input<number>
    awsRegion?: pulumi.Input<string>
    assumeRole?: pulumi.Input<string>
}

export class EcsWaiter extends pulumi.dynamic.Resource {
    public readonly clusterName!: pulumi.Output<string>
    public readonly serviceName!: pulumi.Output<string>
    public readonly desiredTaskDef!: pulumi.Output<string>
    public readonly status!: pulumi.Output<string>
    public readonly failureMessage!: pulumi.Output<string>
    public readonly timeoutMs!: pulumi.Output<number>

    constructor(
        name: string,
        props: EcsWaiterProps,
        opts?: pulumi.CustomResourceOptions,
    ) {
        super(
            dynamicProvider,
            name,
            {
                status: undefined,
                failureMessage: undefined,
                timeoutMs: undefined,
                awsRegion: undefined,
                assumeRole: undefined,
                ...props,
            },
            opts,
        )
    }
}
