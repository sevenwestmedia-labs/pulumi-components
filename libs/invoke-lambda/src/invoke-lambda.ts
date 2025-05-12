import {
    LambdaClient,
    InvokeCommand,
    InvokeCommandOutput,
} from '@aws-sdk/client-lambda'
import { STSClient, AssumeRoleCommand } from '@aws-sdk/client-sts'
import * as pulumi from '@pulumi/pulumi'

type _Blob = Uint8Array | Buffer

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
    try {
        let credentials

        if (assumeRoleArn) {
            const stsClient = new STSClient({ region })
            const assumeRoleCommand = new AssumeRoleCommand({
                RoleArn: assumeRoleArn,
                RoleSessionName: 'RunLambda',
            })

            const assumeRoleResponse = await stsClient.send(assumeRoleCommand)
            const assumedCredentials = assumeRoleResponse.Credentials

            if (!assumedCredentials) {
                throw new Error(
                    'Failed to assume role: No credentials returned',
                )
            }

            credentials = {
                accessKeyId:
                    assumedCredentials.AccessKeyId ??
                    (() => {
                        throw new Error('AccessKeyId is undefined')
                    })(),
                secretAccessKey:
                    assumedCredentials.SecretAccessKey ??
                    (() => {
                        throw new Error('SecretAccessKey is undefined')
                    })(),
                sessionToken: assumedCredentials.SessionToken,
            }
        }

        const lambdaClient = new LambdaClient({
            region,
            credentials,
        })

        const invokeCommand = new InvokeCommand({
            FunctionName: functionName,
            Payload: payload,
        })

        const result: InvokeCommandOutput = await lambdaClient.send(
            invokeCommand,
        )

        if (result.StatusCode !== 200) {
            throw new Error(
                result.FunctionError || `Couldn't run ${functionName}`,
            )
        }

        return {
            statusCode: result.StatusCode,
        }
    } catch (e: unknown) {
        if (e instanceof Error) {
            await pulumi.log.error(e.message)
        } else {
            await pulumi.log.error('An unknown error occurred')
        }
        throw e
    }
}
