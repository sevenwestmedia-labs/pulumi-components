import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

export class DenyLogGroupCreationPolicy extends pulumi.ComponentResource {
    readonly policy: aws.iam.Policy

    constructor(
        name: string,
        // eslint-disable-next-line @typescript-eslint/ban-types
        _: {},
        opts?: pulumi.ComponentResourceOptions | undefined,
    ) {
        super('wanews:deny-log-group-create-policy', name, {}, opts)

        this.policy = new aws.iam.Policy('deny-log-group-creation', {
            name: 'deny-log-group-creation',
            policy: {
                Statement: [
                    {
                        Action: ['logs:CreateLogGroup'],
                        Effect: 'Deny',
                        Resource: '*',
                    },
                ],
                Version: '2012-10-17',
            },
        })
    }
}
