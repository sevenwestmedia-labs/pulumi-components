import * as pulumi from '@pulumi/pulumi'

pulumi.runtime.setMocks({
    newResource: function (
        args: pulumi.runtime.MockResourceArgs,
    ): {
        id: string
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        state: any
    } {
        return {
            id: args.inputs.name + '_id',
            state: args.inputs,
        }
    },
    call: function (args: pulumi.runtime.MockCallArgs) {
        return args.inputs
    },
})

describe('parent resource', () => {
    it.todo('should raise a pulumi error when an ECS deployment fails')
})
