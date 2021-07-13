import * as pulumi from '@pulumi/pulumi'
import * as sumologic from '@pulumi/sumologic'
//import * as aws from '@pulumi/aws'
//import * as lambda from '@wanews/pulumi-lambda'

export class LambdaSumo extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            //lambdaFunc: lambda.LambdaFunction
            //lambdaFunc: aws.lambda.Function
            //collectorId: pulumi.Input<number>
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:sumo/LambdaSumo', name, {}, opts)

        const collector = new sumologic.Collector(
            name,
            {
                description: 'testing pulumi sumologic module',
            },
            { parent: this },
        )
        const collectorId = collector.id.apply((id) => Number(id)) //TODO type mismatch?!
        collectorId.apply((collectorId) => {
            if (Number.isNaN(collectorId)) {
                throw new pulumi.ResourceError(
                    `non-numeric id ${collector.id} `,
                    this,
                )
            }
        })

        // cloudwatch logs
        new sumologic.HttpSource(
            `${name}-logs`,
            {
                collectorId,
                category: 'Spike/CloudWatch/Logs', //TODO
                // TODO set up SNS forwarding!
            },
            { parent: this },
        )

        // cloudwatch metrics
        new sumologic.CloudwatchSource(
            `${name}-metrics`,
            {
                collectorId,
                contentType: 'AwsCloudWatch',
                category: 'Spike/CloudWatch/Metrics', //TODO
                scanInterval: 60000, //TODO review this
                path: {
                    type: 'CloudWatchPath',
                    limitToRegions: [
                        //TODO get this dynamically
                        'ap-southeast-2',
                        'us-east-1',
                    ],
                    limitToNamespaces: ['AWS/Lambda'],
                    tagFilters: [
                        {
                            type: 'TagFilters',
                            namespace: 'AWS/Lambda',
                            tags: [
                                //'FunctionName=serverless-mono-thewest-dev-image-resizer', // TODO set this from args
                                'Project=image-resizer',
                                'Name=serverless-mono-thewest-dev-image-resizer',
                            ],
                        },
                    ],
                },
                paused: false,
                authentication: {
                    type: 'AWSRoleBasedAuthentication',
                    //TODO create role automatically
                    roleArn: 'arn:aws:iam::291971919224:role/sumo-testing',
                },
            },
            { parent: this },
        )

        //  x-ray traces
        new sumologic.AwsXraySource(
            `${name}-traces`,
            {
                collectorId,
                authentication: {
                    type: 'AWSRoleBasedAuthentication',
                    //TODO create role automatically
                    roleArn: 'arn:aws:iam::291971919224:role/sumo-testing',
                },
                category: 'Spike/CloudWatch/Traces', //TODO
                contentType: 'AwsXRay',
                scanInterval: 60000, //TODO review this
                paused: false,
                path: {
                    type: 'AwsXRayPath',
                    limitToRegions: ['ap-southeast-2'],
                    tagFilters: [
                        {
                            type: 'TagFilters',
                            namespace: 'AWS/Lambda',
                            tags: [
                                //'FunctionName=serverless-mono-thewest-dev-image-resizer', // TODO set this from args
                                'Project=image-resizer',
                                'Name=serverless-mono-thewest-dev-image-resizer',
                            ],
                        },
                    ],
                },
                //TODO is there no way to filter these????
            },
            { parent: this },
        )
    }
}
