import * as pulumi from '@pulumi/pulumi'
import { dynamicProvider } from './dynamic-resource-provider'

export interface EcsWaiterProps {
    clusterName: pulumi.Input<string>
    serviceName: pulumi.Input<string>
    awsRegion?: string
    assumeRole?: string
}

export class EcsWaiter extends pulumi.dynamic.Resource {
    public readonly status!: pulumi.Output<string>
    public readonly failureMessage!: pulumi.Output<string | undefined>

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
                ...props,
            },
            opts,
        )
    }
}
