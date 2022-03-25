import * as aws from '@pulumi/aws'
import * as pulumi from '@pulumi/pulumi'

export type S3BucketOptions = Partial<Omit<aws.s3.BucketArgs, 'tags'>> & {
    /**
     * A list of account numbers which need access to the bucket.
     * Example: ['11111111', '22222222', ...]
     *
     * Accounts in this list will be allowed to use IAM to grant access to
     * resources in this bucket.
     *
     * Note that any accounts NOT in this list will be unable to perform
     * s3:GetObject, even if they would be otherwise permitted by ACLs, UNLESS
     * the request includes a Referer header containing refererValue.
     */
    permittedAccounts?: pulumi.Input<string[]>

    /**
     * If true, objects in the bucket will be owned by the bucket owner.
     *
     * If false, objects in the bucket will be owned by the object writer
     * (this is the default).
     */
    bucketOwnerPreferred?: pulumi.Input<boolean>
}

interface BucketArgs extends S3BucketOptions {
    /**
     * All s3:GetObject requests will be denied unless the request includes
     * a Referer header containing this value.
     *
     * This does not apply to accounts listed in permittedAccounts.
     */
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

        const ownershipControls = new aws.s3.BucketOwnershipControls(
            name,
            {
                bucket: this.bucket.id,
                rule: {
                    objectOwnership: pulumi
                        .output(args.bucketOwnerPreferred)
                        .apply(
                            (bucketOwnerPreferred) =>
                                bucketOwnerPreferred ?? false,
                        )
                        .apply((bucketOwnerPreferred) =>
                            bucketOwnerPreferred
                                ? 'BucketOwnerPreferred'
                                : 'ObjectWriter',
                        ),
                },
            },
            { parent: this },
        )

        const policy = pulumi
            .all([
                this.bucket.arn,
                refererValue,
                args.permittedAccounts,

                // This is not used, but hopefully fixes the error below.
                //
                // OperationAborted: A conflicting conditional operation is
                // currently in progress against this resource. Please try
                // again.
                ownershipControls.id,
            ])
            .apply(
                ([
                    bucketArn,
                    refererValue,
                    permittedAccounts,
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    _ownershipId,
                ]) =>
                    aws.iam.getPolicyDocument(
                        {
                            version: '2012-10-17',
                            statements: [
                                {
                                    sid: 'AllowCloudFrontReadGetObject',
                                    effect: 'Deny',
                                    principals: [
                                        { type: '*', identifiers: ['*'] },
                                    ],
                                    actions: ['s3:GetObject'],
                                    resources: [`${bucketArn}/*`],
                                    conditions: [
                                        {
                                            test: 'StringNotEquals',
                                            variable: 'aws:Referer',
                                            values: [refererValue],
                                        },
                                        ...((permittedAccounts ?? []).length > 0
                                            ? [
                                                  {
                                                      test: 'StringNotEquals',
                                                      variable:
                                                          'aws:SourceAccount',
                                                      values: permittedAccounts,
                                                  },
                                              ]
                                            : []),
                                    ],
                                },
                                ...((permittedAccounts ?? []).length > 0
                                    ? [
                                          {
                                              sid: 'AllowIAMAccessToBucket',
                                              effect: 'Allow',
                                              principals: [
                                                  {
                                                      type: 'AWS',
                                                      identifiers: permittedAccounts,
                                                  },
                                              ],
                                              actions: ['s3:*'],
                                              resources: [`${bucketArn}/*`],
                                          },
                                          {
                                              sid: 'AllowIAMAccessToListBucket',
                                              effect: 'Allow',
                                              principals: [
                                                  {
                                                      type: 'AWS',
                                                      identifiers: permittedAccounts,
                                                  },
                                              ],
                                              actions: ['s3:ListBucket'],
                                              resources: [bucketArn],
                                          },
                                      ]
                                    : []),
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
