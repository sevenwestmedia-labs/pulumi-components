import * as pulumi from '@pulumi/pulumi'
import { invokeLambdaProvider } from './invoke-lambda-provider'

type _Blob = Uint8Array | Buffer

export interface LambdaInvocationResourceInputs {
    functionName: pulumi.Input<string>
    payload?: pulumi.Input<_Blob>
    assumeRoleArn?: pulumi.Input<string>
    region?: pulumi.Input<string>
}

export class LambdaInvocation extends pulumi.dynamic.Resource {
    constructor(
        name: string,
        args: {
            functionName: pulumi.Input<string>
            assumeRoleArn?: pulumi.Input<string>
            region?: pulumi.Input<string>
            payload?: pulumi.Input<_Blob>
        },
        opts?: pulumi.CustomResourceOptions,
    ) {
        const resourceArgs: LambdaInvocationResourceInputs = {
            functionName: args.functionName,
            assumeRoleArn: args.assumeRoleArn,
            region: args.region,
            payload: args.payload,
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
