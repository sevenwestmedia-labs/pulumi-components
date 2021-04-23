import * as pulumi from '@pulumi/pulumi'
import { invokeLambdaProvider } from './invoke-lambda-provider'

export interface LambdaInvocationResourceInputs {
    functionName: pulumi.Input<string>
    assumeRoleArn: pulumi.Input<string>
    region?: pulumi.Input<string>
}

export class LambdaInvocation extends pulumi.dynamic.Resource {
    constructor(
        name: string,
        args: {
            functionName: pulumi.Input<string>
            assumeRoleArn: pulumi.Input<string>
            region?: pulumi.Input<string>
        },
        opts?: pulumi.CustomResourceOptions,
    ) {
        const resourceArgs: LambdaInvocationResourceInputs = {
            functionName: args.functionName,
            assumeRoleArn: args.assumeRoleArn,
            region: args.region,
        }

        super(
            invokeLambdaProvider,
            name,
            { taskArn: undefined, ...resourceArgs },
            opts,
        )
    }

    public readonly /*out*/ taskArn!: pulumi.Output<string>
}
