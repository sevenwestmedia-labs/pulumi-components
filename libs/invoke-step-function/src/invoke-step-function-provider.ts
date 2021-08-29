import * as pulumi from '@pulumi/pulumi'

import {
    invokeStepFunction,
    InvokeStepFunctionArgs,
} from './invoke-step-function'

export const invokeStepFunctionProvider: pulumi.dynamic.ResourceProvider = {
    async create(inputs: InvokeStepFunctionArgs) {
        const { executionArn } = await invokeStepFunction(inputs)

        return {
            id: 'not-needed',
            executionArn,
        }
    },

    async update(
        _id,
        _oldInputs: InvokeStepFunctionArgs,
        newInputs: InvokeStepFunctionArgs,
    ) {
        const { executionArn } = await invokeStepFunction(newInputs)

        return {
            outs: { executionArn },
        }
    },

    async delete() {},

    async diff() {
        return {
            changes: true,
        }
    },
}
