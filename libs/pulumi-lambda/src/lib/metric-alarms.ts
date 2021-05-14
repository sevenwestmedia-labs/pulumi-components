import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

export const defaultThresholds = {
    avgDurationMs: 3000,
    maxDurationMs: 15000,
    errorRatePercent: 2,
    throttles: 1,
    concurrents: 450,
}

export interface Thresholds {
    /**
     * Alert if the average duration is greater than this
     * Default: 3000ms (3 seconds)
     */
    avgDurationMs?: pulumi.Input<number>
    /**
     * Alert if the max duration is greater than this
     * Default: not used (undefined) if timeoutMs is set
     */
    maxDurationMs?: pulumi.Input<number>
    /**
     * Alert if the max duration
     * Default: not used (undefined)
     */
    timeoutMs?: pulumi.Input<number>
    /**
     * Alert if the error rate exceeds this
     * (default: 2 percent)
     */
    errorRatePercent?: pulumi.Input<number>
    /**
     * Throttles are bad mkay
     * default: 1 throttle in the last 5 minutes
     */
    throttles?: pulumi.Input<number>
    /**
     * Alert if concurrent executions exceeds this
     * This has a cost implication, but it can also
     * cause throttles if it rises too fast
     * default: more than 450 concurrents at any
     * time in the past 5 minutes
     */
    concurrents?: pulumi.Input<number>
}

/**
 * Provides common metric alarms for a lambda function
 */
export class MetricAlarms extends pulumi.ComponentResource {
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
             * Set custom thresholds for the alarms
             */
            thresholds?: Thresholds
        },
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super('wanews:lambda/MetricAlarms', name, {}, opts)

        new aws.cloudwatch.MetricAlarm(
            `${name}-err-rate`,
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
                threshold:
                    args.thresholds?.errorRatePercent ??
                    defaultThresholds.errorRatePercent,
                alarmDescription: pulumi.interpolate`threshold: error rate >= ${
                    args.thresholds?.errorRatePercent ??
                    defaultThresholds.errorRatePercent
                }%: ${args.lambdaFunctionName}`,
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )

        new aws.cloudwatch.MetricAlarm(
            `${name}-duration-avg`,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Duration',
                statistic: 'Average',
                period: 60,
                evaluationPeriods: 2,
                datapointsToAlarm: 2,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold:
                    args.thresholds?.avgDurationMs ??
                    defaultThresholds.avgDurationMs,
                alarmDescription: pulumi.interpolate`threshold: avg duration >= ${
                    args.thresholds?.avgDurationMs ??
                    defaultThresholds.avgDurationMs
                }: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'missing',
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )

        if (
            args.thresholds?.maxDurationMs ??
            args.thresholds?.timeoutMs === undefined
        ) {
            new aws.cloudwatch.MetricAlarm(
                `${name}-duration-max`,
                {
                    namespace: 'AWS/Lambda',
                    metricName: 'Duration',
                    statistic: 'Maximum',
                    period: 60,
                    evaluationPeriods: 2,
                    datapointsToAlarm: 2,
                    comparisonOperator: 'GreaterThanOrEqualToThreshold',
                    threshold:
                        args.thresholds?.maxDurationMs ??
                        defaultThresholds.maxDurationMs,
                    alarmDescription: pulumi.interpolate`threshold: max duration >= ${
                        args.thresholds?.maxDurationMs ??
                        defaultThresholds.maxDurationMs
                    }: ${args.lambdaFunctionName}`,
                    dimensions: {
                        FunctionName: args.lambdaFunctionName,
                        Resource: args.lambdaFunctionName,
                    },
                    alarmActions: [args.snsTopicArn],
                    okActions: [args.snsTopicArn],
                    insufficientDataActions: [args.snsTopicArn],
                    treatMissingData: 'missing',
                },
                {
                    parent: this,
                    deleteBeforeReplace: true,
                },
            )
        }

        if (args.thresholds?.timeoutMs !== undefined) {
            new aws.cloudwatch.MetricAlarm(
                `${name}-timeout`,
                {
                    namespace: 'AWS/Lambda',
                    metricName: 'Duration',
                    statistic: 'Maximum',
                    period: 60,
                    evaluationPeriods: 2,
                    datapointsToAlarm: 2,
                    comparisonOperator: 'GreaterThanOrEqualToThreshold',
                    threshold: args.thresholds.timeoutMs,
                    alarmDescription: pulumi.interpolate`timeout: max duration >= ${args.thresholds.timeoutMs}: ${args.lambdaFunctionName}`,
                    dimensions: {
                        FunctionName: args.lambdaFunctionName,
                        Resource: args.lambdaFunctionName,
                    },
                    alarmActions: [args.snsTopicArn],
                    okActions: [args.snsTopicArn],
                    insufficientDataActions: [args.snsTopicArn],
                    treatMissingData: 'missing',
                },
                {
                    parent: this,
                    deleteBeforeReplace: true,
                },
            )
        }

        new aws.cloudwatch.MetricAlarm(
            `${name}-throttles`,
            {
                namespace: 'AWS/Lambda',
                metricName: 'Throttles',
                statistic: 'Sum',
                period: 60,
                evaluationPeriods: 5,
                datapointsToAlarm: 1,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold:
                    args.thresholds?.throttles ?? defaultThresholds.throttles,
                alarmDescription: pulumi.interpolate`threshold: throttles >= ${
                    args.thresholds?.throttles ?? defaultThresholds.throttles
                }: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )

        new aws.cloudwatch.MetricAlarm(
            `${name}-concurrents`,
            {
                namespace: 'AWS/Lambda',
                metricName: 'ConcurrentExecutions',
                statistic: 'Maximum',
                period: 60,
                evaluationPeriods: 5,
                datapointsToAlarm: 1,
                comparisonOperator: 'GreaterThanOrEqualToThreshold',
                threshold:
                    args.thresholds?.concurrents ??
                    defaultThresholds.concurrents,
                alarmDescription: pulumi.interpolate`threshold: concurrents >= ${
                    args.thresholds?.concurrents ??
                    defaultThresholds.concurrents
                }: ${args.lambdaFunctionName}`,
                dimensions: {
                    FunctionName: args.lambdaFunctionName,
                    Resource: args.lambdaFunctionName,
                },
                alarmActions: [args.snsTopicArn],
                okActions: [args.snsTopicArn],
                insufficientDataActions: [args.snsTopicArn],
                treatMissingData: 'notBreaching',
            },
            {
                parent: this,
                deleteBeforeReplace: true,
            },
        )
    }
}
