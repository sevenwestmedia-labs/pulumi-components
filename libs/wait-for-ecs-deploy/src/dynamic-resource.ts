import * as pulumi from '@pulumi/pulumi'
import { dynamicProvider, Inputs } from './dynamic-resource-provider'

export interface EcsWaiterProps extends Omit<Inputs, 'timeoutMs'> {
    timeoutMs?: number
}

export class EcsWaiter extends pulumi.dynamic.Resource {
    public readonly status!: pulumi.Output<string>
    public readonly failureMessage!: pulumi.Output<string>

    constructor(
        name: string,
        props: EcsWaiterProps,
        opts?: pulumi.CustomResourceOptions,
    ) {
        props.timeoutMs = props.timeoutMs ?? 180000

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
