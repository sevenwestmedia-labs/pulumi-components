import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { Thresholds, MetricAlarms } from './metric-alarms'

/**
 * - removes sumo logging
 * - adds a default execution role (but still allows it to be overridden)
 * - updates default runtime node12 --> node14
 * - removes all aws.lambda.Permission (allowInvocationBy)
 */

export class LambdaFunction extends pulumi.ComponentResource {
    readonly function: aws.lambda.Function
    readonly executionRole: aws.iam.Role
    readonly logGroup: aws.cloudwatch.LogGroup

    constructor(
        name: string,
        args: {
            lambdaOptions: Omit<aws.lambda.FunctionArgs, 'role'>

            executionRoleArn?: pulumi.Input<string>

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
             * If enabled, metric alarms will be created, and alerts will be raised to the
             * SNS topic provided. Optional thresholds can be set.
             * Default: disabled
             */
            monitoring?:
                | {
                      enabled: true
                      thresholds?: Thresholds
                      snsTopicArn: pulumi.Input<string>
                  }
                | {
                      enabled: false
                      thresholds?: undefined
                      snsTopicArn?: undefined
                  }
        },
        opts?: pulumi.ComponentResourceOptions | undefined,
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
            },
        )

        const roleName = `${name}-role`

        this.executionRole = args.executionRoleArn
            ? aws.iam.Role.get(roleName, args.executionRoleArn, undefined, {
                  parent: this,
              })
            : new aws.iam.Role(
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
                  { parent: this },
              )

        new aws.iam.RolePolicyAttachment(
            `${name}-attach-execution-policy`,
            {
                role: this.executionRole.name,
                policyArn: aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
            },
            { parent: this },
        )

        this.function = new aws.lambda.Function(
            name,
            {
                name,
                runtime: 'nodejs14.x',
                role: this.executionRole.arn,
                ...(args.lambdaOptions || {}),
                tags: args.getTags(name),
            },
            {
                parent: this,
                dependsOn: [this.logGroup],
            },
        )

        if (args.monitoring?.enabled) {
            new MetricAlarms(name, {
                snsTopicArn: args.monitoring.snsTopicArn,
                thresholds: args.monitoring.thresholds,
                lambdaFunctionName: this.function.name,
            })
        }
    }
}
