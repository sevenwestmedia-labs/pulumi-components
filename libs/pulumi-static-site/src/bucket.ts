import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

export type S3BucketOptions = Partial<Omit<aws.s3.BucketArgs, 'tags'>>

interface BucketArgs extends S3BucketOptions {
    refererValue: pulumi.Input<string>
    getTags: (
        name: string,
    ) => {
        [key: string]: pulumi.Input<string>
    }
}

export class Bucket extends pulumi.ComponentResource {
    bucket: aws.s3.Bucket

    constructor(
        name: string,
        args: BucketArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('swm:pulumi-static-site:bucket/Bucket', name, {}, opts)

        const { refererValue, getTags, website, ...bucketOptions } = args

        this.bucket = new aws.s3.Bucket(
            name,
            {
                ...bucketOptions,
                website: pulumi.output(website).apply((website) => ({
                    indexDocument: 'index.html',
                    ...website,
                })),
                tags: getTags(name),
            },
            { parent: this },
        )

        const policy = pulumi
            .all([this.bucket.arn, refererValue])
            .apply(([bucketArn, refererValue]) =>
                aws.iam.getPolicyDocument(
                    {
                        version: '2012-10-17',
                        statements: [
                            {
                                sid: 'AllowCloudFrontReadGetObject',
                                effect: 'Deny',
                                principals: [{ type: '*', identifiers: ['*'] }],
                                actions: ['s3:GetObject'],
                                resources: [`${bucketArn}/*`],
                                conditions: [
                                    {
                                        test: 'StringNotEquals',
                                        variable: 'aws:Referer',
                                        values: [refererValue],
                                    },
                                ],
                            },
                        ],
                    },
                    { parent: this },
                ),
            )

        new aws.s3.BucketPolicy(
            name,
            { bucket: this.bucket.id, policy: policy.json },
            { parent: this },
        )
    }
}
