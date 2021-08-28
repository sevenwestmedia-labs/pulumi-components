import * as pulumi from '@pulumi/pulumi'
import { invokeStepFunctionProvider } from './invoke-step-function-provider'

export interface StepFunctionInvocationResourceInputs {
    stateMachineArn: pulumi.Input<string>
    input?: pulumi.Input<string>
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
            input?: pulumi.Input<string>
        },
        opts?: pulumi.CustomResourceOptions,
    ) {
        const resourceArgs: StepFunctionInvocationResourceInputs = {
            stateMachineArn: args.stateMachineArn,
            assumeRoleArn: args.assumeRoleArn,
            region: args.region,
            input: args.input,
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
