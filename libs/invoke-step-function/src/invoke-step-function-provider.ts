import * as pulumi from '@pulumi/pulumi'

import {
    invokeStepFunction,
    InvokeStepFunctionArgs,
} from './invoke-step-function'

export const invokeStepFunctionProvider: pulumi.dynamic.ResourceProvider = {
    async create(inputs: InvokeStepFunctionArgs) {
        const { output, executionArn, error } = await invokeStepFunction(inputs)

        return {
            id: 'not-needed',
            output,
            executionArn,
            error,
        }
    },

    async update(
        _id,
        _oldInputs: InvokeStepFunctionArgs,
        newInputs: InvokeStepFunctionArgs,
    ) {
        const { output, executionArn, error } = await invokeStepFunction(
            newInputs,
        )

        return {
            outs: { output, executionArn, error },
        }
    },

    async delete() {},

    async diff() {
        return {
            changes: true,
        }
    },
}
