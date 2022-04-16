import { Lambda, TemporaryCredentials } from 'aws-sdk'
import * as pulumi from '@pulumi/pulumi'
import { _Blob } from 'aws-sdk/clients/lambda'

export interface InvokeLambdaArgs {
    functionName: string
    payload?: _Blob
    assumeRoleArn?: string
    region?: string
}

export async function invokeLambda({
    functionName,
    payload,
    assumeRoleArn,
    region = 'ap-southeast-2',
}: InvokeLambdaArgs) {
    const lambda = new Lambda({
        region: region,
        credentials: assumeRoleArn
            ? new TemporaryCredentials({
                  RoleSessionName: 'RunLambda',
                  RoleArn: assumeRoleArn,
              })
            : undefined,
    })
    try {
        const result = await lambda
            .invoke({
                FunctionName: functionName,
                Payload: payload,
            })
            .promise()

        if (result.StatusCode !== 200) {
            throw new Error(
                result.FunctionError || `Couldn't run ${functionName}`,
            )
        }

        return {
            statusCode: result.StatusCode,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        await pulumi.log.error(e.message)
        throw e
    }
}
