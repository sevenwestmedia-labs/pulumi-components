import { StepFunctions, TemporaryCredentials } from 'aws-sdk'
import * as pulumi from '@pulumi/pulumi'

export interface InvokeStepFunctionArgs {
    stateMachineArn: string
    input?: string
    assumeRoleArn?: string
    region?: string
}

export async function invokeStepFunction({
    stateMachineArn,
    input,
    assumeRoleArn,
    region = 'ap-southeast-2',
}: InvokeStepFunctionArgs) {
    const stepFunctions = new StepFunctions({
        region: region,
        credentials: assumeRoleArn
            ? new TemporaryCredentials({
                  RoleSessionName: 'RunLambda',
                  RoleArn: assumeRoleArn,
              })
            : undefined,
    })
    try {
        const result = await stepFunctions
            .startSyncExecution({
                stateMachineArn,
                input,
            })
            .promise()

        if (result.error) {
            throw new Error(`Couldn't run ${stateMachineArn}: ${result.error}`)
        }

        return {
            error: result.error,
            output: result.output,
            executionArn: result.executionArn,
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (e: any) {
        await pulumi.log.error(e.message)
        throw e
    }
}
