import * as pulumi from '@pulumi/pulumi'

import { invokeLambda, InvokeLambdaArgs } from './invoke-lambda'

export const invokeLambdaProvider: pulumi.dynamic.ResourceProvider = {
    async create(inputs: InvokeLambdaArgs) {
        await invokeLambda(inputs)

        return {
            id: 'not-needed',
        }
    },

    async update(
        _id,
        _oldInputs: InvokeLambdaArgs,
        newInputs: InvokeLambdaArgs,
    ) {
        const { statusCode } = await invokeLambda(newInputs)

        return {
            outs: { statusCode },
        }
    },

    async delete() {},

    async diff() {
        return {
            changes: true,
        }
    },
}
