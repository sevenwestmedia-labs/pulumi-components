import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

/**
 * Provides an opinionated set of recommended alarms for a lambda function.
 *
 * Raise alarms for the following:
 *  - function has timed out (calculated using max duration)
 *  - function error rate exceeded (default: 2%)
 *  - function has too many concurrent executions (default: 450 concurrents)
 *  - function has been throttled (default: one or more throttles have occurred)
 */
export class RecommendedAlarms extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Set thresholds for the alarms
             */
            thresholds: {
                timeoutMs: pulumi.Input<number>
                errorRatePercent?: pulumi.Input<number>
                concurrents?: pulumi.Input<number>
                throttles?: pulumi.Input<number>
            }
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/RecommendedAlarms', name, {}, opts)

        new FunctionTimeoutAlarm(name, {
            snsTopicArn: args.snsTopicArn,
            lambdaFunctionName: args.lambdaFunctionName,
            getTags: args.getTags,
            timeoutMs: args.thresholds.timeoutMs,
        })

        new ErrorRateAlarm(name, {
            snsTopicArn: args.snsTopicArn,
            lambdaFunctionName: args.lambdaFunctionName,
            getTags: args.getTags,
            errorRatePercent: args.thresholds.errorRatePercent,
        })

        new ConcurrentExecutionsAlarm(name, {
            snsTopicArn: args.snsTopicArn,
            lambdaFunctionName: args.lambdaFunctionName,
            getTags: args.getTags,
            concurrents: args.thresholds.concurrents,
        })

        new FunctionThrottledAlarm(name, {
            snsTopicArn: args.snsTopicArn,
            lambdaFunctionName: args.lambdaFunctionName,
            getTags: args.getTags,
            throttles: args.thresholds.throttles,
        })
    }
}

/** raise an alarm if the error rate exceeds errorRatePercent */
export class ErrorRateAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Alert if the error rate exceeds this
             * (default: 2 percent)
             */
            errorRatePercent?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/ErrorRateAlarm', name, {}, opts)

        const threshold = args.errorRatePercent ?? 2
        const resourceName = `${name}-err-rate`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                metricQueries: [
                    {
                        id: 'errorRate',
                        label: 'Error rate (%)',
                        expression: '100 * errors / MAX([errors, invocations])',
                        returnData: true,
                    },
                    {
                        id: 'errors',
                        label: 'Errors',
                        metric: {
                            namespace: 'AWS/Lambda',
                            metricName: 'Errors',
                            stat: 'Sum',
                            dimensions: {
                                FunctionName: args.lambdaFunctionName,
                                Resource: args.lambdaFunctionName,
                            },
                            period: 60,
                        },
                    },
                    {
                        id: 'invocations',
                        label: 'Invocations',
                        metric: {
                            namespace: 'AWS/Lambda',
                            metricName: 'Invocations',
                            stat: 'Sum',
                            dimensions: {
                                FunctionName: args.lambdaFunctionName,
                                Resource: args.lambdaFunctionName,
                            },
                            period: 60,
                        },
                    },
                ],
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`threshold: error rate >= ${threshold}%: ${args.lambdaFunctionName}`,
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if a function times out */
export class FunctionTimeoutAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Alert if the max duration is greater than this
             * Default: not used (undefined)
             */
            timeoutMs: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/FunctionTimeoutAlarm', name, {}, opts)

        const threshold = pulumi
            .output(args.timeoutMs)
            .apply((timeout) => timeout - 1)
        const resourceName = `${name}-timeout`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Maximum',
                period: 60,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`timeout: max duration >= ${threshold}: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'missing',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if concurrent executions is exceeded */
export class ConcurrentExecutionsAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Alert if concurrent executions exceeds this
             * This has a cost implication, but it can also
             * cause throttles if it rises too fast
             * default: more than 450 concurrents at any
             * time in the past 5 minutes
             */
            concurrents?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/ConcurrentExecutionsAlarm', name, {}, opts)

        const threshold = args.concurrents ?? 450
        const resourceName = `${name}-concurrents`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                namespace: 'AWS/Lambda',
                metricName: 'ConcurrentExecutions',
                statistic: 'Maximum',
                period: 60,
                evaluationPeriods: 5,
                datapointsToAlarm: 1,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`threshold: concurrents >= ${threshold}: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if a function has been throttled */
export class FunctionThrottledAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Throttles are bad mkay
             * default: 1 throttle in the last 5 minutes
             */
            throttles?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/FunctionThrottledAlarm', name, {}, opts)

        const threshold = args.throttles ?? 1
        const resourceName = `${name}-throttled`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Throttles',
                statistic: 'Sum',
                period: 60,
                evaluationPeriods: 5,
                datapointsToAlarm: 1,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`threshold: throttled >= ${threshold}: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if the maximum duration exceeds maxDurationMs */
export class MaxDurationAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Alert if the max duration is greater than this
             * Default: not used (undefined)
             */
            maxDurationMs?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/MaxDurationAlarm', name, {}, opts)

        const threshold = args.maxDurationMs ?? 15000
        const resourceName = `${name}-duration-max`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Maximum',
                period: 60,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`threshold: max duration >= ${threshold}: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'missing',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}

/** raise an alarm if the average duration exceeds avgDurationMs */
export class AvgDurationAlarm extends pulumi.ComponentResource {
    constructor(
        name: string,
        args: {
            /**
             * Alerts will be sent to this SNS topic
             */
            snsTopicArn: pulumi.Input<string>
            /**
             * The name of the function to monitor
             */
            lambdaFunctionName: pulumi.Input<string>
            /**
             * Alert if the average duration is greater than this
             * Default: 3000ms (3 seconds)
             */
            avgDurationMs?: pulumi.Input<number>
            /**
             * a callback function that returns tags for
             * each resource
             */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/AvgDurationAlarm', name, {}, opts)

        const threshold = args.avgDurationMs ?? 3000
        const resourceName = `${name}-duration-avg`

        new aws.cloudwatch.MetricAlarm(
            resourceName,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Average',
                period: 60,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold,
                alarmDescription: pulumi.interpolate`threshold: avg duration >= ${threshold}: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'missing',
                tags: args.getTags(resourceName),
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}
