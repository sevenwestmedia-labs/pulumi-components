import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { ResourceError } from '@pulumi/pulumi'

export class LambdaFunction extends pulumi.ComponentResource {
    readonly function: aws.lambda.Function
    readonly executionRole: pulumi.Output<aws.iam.Role>
    readonly logGroup: aws.cloudwatch.LogGroup

    constructor(
        name: string,
        args: {
            lambdaOptions: Omit<aws.lambda.FunctionArgs, 'role'>

            /**
             * Role must already exist, otherwise preview will fail
             *
             * If you are creating the role in the same program, use executionRole
             */
            executionRoleName?: string
            executionRole?: aws.iam.Role

            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }

            /**
             * Log groups are automatically created by lambda,
             * if you need to import an existing log group an existing log group resource id can be specified here
             * Once imported, this param needs to be removed
             **/
            logGroupImport?: string

            /**
             * If you are making IAM policy changes, you can delay the
             * update/create of the lambda to ensure they are consistent
             */
            delayLambdaDeployment?: boolean
        },
        opts?:
            | (pulumi.ComponentResourceOptions & {
                  /**
                   * Some versions of pulumi and/or aws-sdk are unable to delete log groups D:<
                   * This provides a way to alias them, so they don't need to be deleted &
                   * recreated. More info:
                   * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
                   */
                  logGroupAliases?: pulumi.ComponentResourceOptions['aliases']

                  /**
                   * Allow an existing aws.iam.Role resource to be migrated into this module,
                   * without module without being deleted & recreated. More info:
                   * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
                   */
                  executionRoleAliases?: pulumi.ComponentResourceOptions['aliases']

                  /**
                   * Allow an existing aws.iam.RolePolicyAttachment resource to be migrated
                   * into this module without being deleted & recreated. More info:
                   * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
                   */
                  rolePolicyAttachmentAliases?: pulumi.ComponentResourceOptions['aliases']

                  /**
                   * Allow an existing aws.lambda.Function resource to be migrated
                   * into this module without being deleted & recreated. More info:
                   * https://www.pulumi.com/docs/intro/concepts/resources/#aliases
                   */
                  functionAliases?: pulumi.ComponentResourceOptions['aliases']
              })
            | undefined,
    ) {
        super('wanews:lambda', name, {}, opts)

        if (name.length > 64) {
            throw new Error(
                `lambda name is longer than 64 characters, up will fail for ${name}`,
            )
        }

        const logGroupName = `${name}-log-group`
        /**
         * Normally the log group would be created on-demand once the Lambda has
         * been hit. But because we want to create a log subscription to Sumo
         * Logic we need to make sure it's created first.
         */
        this.logGroup = new aws.cloudwatch.LogGroup(
            logGroupName,
            {
                name: `/aws/lambda/${name}`,
                retentionInDays: 14,
                tags: args.getTags(logGroupName),
            },
            {
                parent: this,
                import: args.logGroupImport,
                aliases: opts?.logGroupAliases,
            },
        )

        if (args.executionRole && args.executionRoleName) {
            throw new ResourceError(
                'Cannot specify both executionRole and executionRoleName',
                this,
            )
        }

        const roleName = `${name}-role`

        this.executionRole = args.executionRoleName
            ? pulumi
                  .output(args.executionRoleName)
                  .apply((role) =>
                      aws.iam.getRole(
                          { name: role },
                          {
                              parent: this,
                              async: true,
                          },
                      ),
                  )
                  .apply((result) =>
                      aws.iam.Role.get(result.name, result.id, undefined, {
                          parent: this,
                      }),
                  )
            : args.executionRole
            ? pulumi.output(args.executionRole)
            : pulumi.output(
                  new aws.iam.Role(
                      roleName,
                      {
                          assumeRolePolicy: {
                              Version: '2012-10-17',
                              Statement: [
                                  {
                                      Action: 'sts:AssumeRole',
                                      Principal: {
                                          Service: 'lambda.amazonaws.com',
                                      },
                                      Effect: 'Allow',
                                  },
                              ],
                          },
                          tags: args.getTags(name),
                      },
                      {
                          parent: this,
                          aliases: opts?.executionRoleAliases,
                      },
                  ),
              )

        new aws.iam.RolePolicyAttachment(
            `${name}-attach-execution-policy`,
            {
                role: this.executionRole.name,
                policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
            },
            { parent: this, aliases: opts?.rolePolicyAttachmentAliases },
        )

        this.function = new aws.lambda.Function(
            name,
            {
                name,
                runtime: 'nodejs14.x',
                role: this.executionRole.arn.apply(async (arn) => {
                    if (args.delayLambdaDeployment) {
                        console.log('waiting for IAM changes to propagate')
                        await new Promise((resolve) =>
                            setTimeout(resolve, 30_000),
                        )
                    }
                    return arn
                }),
                ...(args.lambdaOptions || {}),
                tags: args.getTags(name),
            },
            {
                parent: this,
                dependsOn: [this.logGroup],
                aliases: opts?.functionAliases,
            },
        )
    }
}
