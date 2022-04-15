import * as s3 from '@pulumi/aws-native/s3'
import * as iam from '@pulumi/aws-native/iam'
import input from '@pulumi/aws-native/types/input'
import * as pulumi from '@pulumi/pulumi'
import { BucketPolicy } from '@pulumi/aws-native/s3outposts'

export type S3BucketOptions = Partial<Omit<s3.BucketArgs, 'tags'>> & {
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
     *
     * Requires `alwaysDenyBadReferer: false`
     */
    permittedAccounts?: pulumi.Input<string[]>

    /**
     * If true, objects in the bucket will be owned by the bucket owner.
     *
     * If false, objects in the bucket will be owned by the object writer
     * (this is the default).
     */
    bucketOwnerPreferred?: pulumi.Input<boolean>

    /**
     * If true, deny requests with a bad Referer, even if they would otherwise
     * be permitted. Note that this will also affect you! So it may not be
     * desired. For backwards compatibility, is the default behaviour.
     *
     * If false, only deny requests with a bad Referer if they would not
     * otherwise be allowed. Required for permittedAccounts
     */
    alwaysDenyBadReferer?: pulumi.Input<boolean>
}

interface BucketArgs extends S3BucketOptions {
    /**
     * All s3:GetObject requests will be denied unless the request includes
     * a Referer header containing this value.
     *
     * This does not apply to accounts listed in permittedAccounts.
     */
    refererValue: pulumi.Input<string>

    getTags: (name: string) => pulumi.Input<input.s3.BucketTagArgs>
}

export class Bucket extends pulumi.ComponentResource {
    bucket: s3.Bucket

    constructor(
        name: string,
        args: BucketArgs,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('swm:pulumi-static-site:bucket/Bucket', name, {}, opts)

        const {
            refererValue,
            getTags,
            websiteConfiguration,
            ...bucketOptions
        } = args

        pulumi
            .all([args.permittedAccounts, args.alwaysDenyBadReferer])
            .apply(([permittedAccounts, alwaysDenyBadReferer]) => {
                if (
                    (alwaysDenyBadReferer ?? true) &&
                    (permittedAccounts ?? []).length > 0
                ) {
                    pulumi.log.warn(
                        '`permittedAccounts` requires ' +
                            '`alwaysDenyBadReferer: false`, otherwise ' +
                            '`permittedAccounts` will not be able to get ' +
                            'objects unless the referer is also set in ' +
                            'the request headers. To suppress this ' +
                            'warning, set `alwaysDenyBadReferer: false` ' +
                            'in `bucketOptions`.',
                    )
                }
            })

        this.bucket = new s3.Bucket(
            name,
            {
                ...bucketOptions,
                website: pulumi
                    .output(websiteConfiguration)
                    .apply((website) => ({
                        indexDocument: 'index.html',
                        ...website,
                    })),
                tags: getTags(name),
            },
            { parent: this },
        )

        const ownershipControls = new s3.BucketOwnershipControls(
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
                args.alwaysDenyBadReferer,
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
                    alwaysDenyBadReferer,
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars
                    _ownershipId,
                ]) =>
                    iam.getPolicyDocument(
                        {
                            version: '2012-10-17',
                            statements: [
                                ...(alwaysDenyBadReferer ?? true
                                    ? [
                                          {
                                              sid: 'AllowCloudFrontReadGetObject',
                                              effect: 'Deny',
                                              principals: [
                                                  {
                                                      type: '*',
                                                      identifiers: ['*'],
                                                  },
                                              ],
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
                                      ]
                                    : [
                                          {
                                              sid: 'AllowCloudFrontReadGetObject',
                                              effect: 'Allow',
                                              principals: [
                                                  {
                                                      type: '*',
                                                      identifiers: ['*'],
                                                  },
                                              ],
                                              actions: ['s3:GetObject'],
                                              resources: [`${bucketArn}/*`],
                                              conditions: [
                                                  {
                                                      test: 'StringEquals',
                                                      variable: 'aws:Referer',
                                                      values: [refererValue],
                                                  },
                                              ],
                                          },
                                      ]),
                                ...((permittedAccounts ?? []).length > 0
                                    ? [
                                          {
                                              sid: 'AllowIAMAccessToBucket',
                                              effect: 'Allow',
                                              principals: [
                                                  {
                                                      type: 'AWS',
                                                      identifiers:
                                                          permittedAccounts,
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
                                                      identifiers:
                                                          permittedAccounts,
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

        new BucketPolicy(
            name,
            { bucket: this.bucket.id, policy: policy.json },
            { parent: this },
        )
    }
}
