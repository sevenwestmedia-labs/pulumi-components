import * as pulumi from '@pulumi/pulumi'
import { _Blob } from 'aws-sdk/clients/lambda'
import { invokeStepFunctionProvider } from './invoke-step-function-provider'

export interface StepFunctionInvocationResourceInputs {
    stateMachineArn: pulumi.Input<string>
    payload?: pulumi.Input<_Blob>
    assumeRoleArn?: pulumi.Input<string>
    region?: pulumi.Input<string>
}

export class StepFunctionInvocation extends pulumi.dynamic.Resource {
    constructor(
        name: string,
        args: {
            stateMachineArn: pulumi.Input<string>
            assumeRoleArn?: pulumi.Input<string>
            region?: pulumi.Input<string>
        },
        opts?: pulumi.CustomResourceOptions,
    ) {
        const resourceArgs: StepFunctionInvocationResourceInputs = {
            stateMachineArn: args.stateMachineArn,
            assumeRoleArn: args.assumeRoleArn,
            region: args.region,
        }

        super(
            invokeStepFunctionProvider,
            name,
            { taskArn: undefined, ...resourceArgs },
            opts,
        )
    }

    public readonly /*out*/ taskArn!: pulumi.Output<string>
}
