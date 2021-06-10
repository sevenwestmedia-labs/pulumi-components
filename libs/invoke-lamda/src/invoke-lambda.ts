import { Lambda, TemporaryCredentials } from 'aws-sdk'
import * as pulumi from '@pulumi/pulumi'

export interface InvokeLambdaArgs {
    functionName: string
    assumeRoleArn?: string
    region?: string
}

export async function invokeLambda({
    functionName,
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
    } catch (e) {
        await pulumi.log.error(e.message)
        throw e
    }
}
