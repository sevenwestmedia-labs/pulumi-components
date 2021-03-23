import * as path from 'path'
import * as aws from '@pulumi/aws'
import { ManagedPolicy } from '@pulumi/aws/types/enums/iam'
import * as pulumi from '@pulumi/pulumi'
import { ResourceError } from '@pulumi/pulumi'

export class LambdaHost extends pulumi.ComponentResource {
    stage: aws.apigatewayv2.Stage
    apiGateway: aws.apigatewayv2.Api
    invokeUrl: pulumi.Output<string>
    publicHostname: pulumi.Output<string>
    apiGatewayDomainName: aws.apigatewayv2.DomainName | undefined
    apiGatewayHostname: pulumi.Output<string>

    constructor(
        name: string,
        {
            policy,
            apiGatewayCertificateArn,
            desiredHostname,

            apiGatewayAccessLoggingEnabled,
        }: {
            policy: aws.iam.Policy
            desiredHostname?: string
            apiGatewayCertificateArn?: string

            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }

            apiGatewayAccessLoggingEnabled: boolean
        },
        opts?: pulumi.ResourceOptions,
    ) {
        super('swm:lambda-host', name, {}, opts)

        const lambdaName = `${name}`

        const lambdaRole = new aws.iam.Role(
            `${name}-test-client-role`,
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
            },
            { parent: this },
        )

        new aws.iam.RolePolicyAttachment(
            `${name}-lambda-policy`,
            {
                role: lambdaRole,
                policyArn: policy.arn,
            },
            { parent: this },
        )

        new aws.iam.RolePolicyAttachment(
            `${name}-lambda-execution-policy`,
            {
                role: lambdaRole,
                policyArn: ManagedPolicy.AWSLambdaBasicExecutionRole,
            },
            { parent: this },
        )

        this.apiGateway = new aws.apigatewayv2.Api(
            `${name}-gateway`,
            {
                protocolType: 'HTTP',
                tags: getResourceTags(name),
            },
            { parent: this },
        )

        this.invokeUrl = desiredHostname
            ? pulumi.interpolate`https://${desiredHostname}`
            : pulumi.interpolate`${this.apiGateway.apiEndpoint}`

        this.apiGatewayHostname = pulumi.interpolate`${this.apiGateway.id}.execute-api.ap-southeast-2.amazonaws.com`

        this.publicHostname = desiredHostname
            ? pulumi.output(desiredHostname)
            : this.apiGatewayHostname

        /**
         * Normally the log group would be created on-demand once the Lambda has
         * been hit. But because we want to create a log subscription to Sumo
         * Logic we need to make sure it's created first.
         */
        const logGroup = new aws.cloudwatch.LogGroup(
            `${name}-log-group`,
            {
                name: `/aws/lambda/${lambdaName}`,
                retentionInDays: 14,
            },
            {
                parent: this,
            },
        )
        if (sumoLambdaArn) {
            new LogToSumo(
                `${name}-sumo-logger`,
                {
                    sumoLambdaArn: sumoLambdaArn,
                    logGroupName: logGroup.name,
                    logGroupArn: logGroup.arn,
                },
                { parent: this },
            )
        }
        const lambda = new aws.lambda.Function(
            lambdaName,
            {
                name: lambdaName,
                code: new pulumi.asset.FileArchive(
                    path.resolve(process.cwd(), 'lambda-dist'),
                ),
                runtime: 'nodejs12.x',
                role: lambdaRole.arn,
                memorySize: 512,
                handler: 'bundle.handler',
                timeout: 15,
                environment: {
                    variables: {
                        OIDC_CLIENTS_TABLE: openIdConnectClientsTable.name,
                        OIDC_INTERACTION_SESSION_TABLE:
                            openIdConnectInteractionSessionReplayTable.name,
                        OIDC_TOKEN_CODE_TABLE: openIdConnectTokenCodeTable.name,
                        APP_SETTINGS_FILE: `./config.${environment}.js`,
                        PUBLIC_URL: this.invokeUrl,
                        LOG_LEVEL: logLevel,
                        ENVIRONMENT: environment,
                        NODE_ENV: 'production',
                        COGNITO_USER_POOL: cognitoUserPool.id,
                        COGNITO_USER_POOL_CLIENT: cognitoUserPoolClient.id,
                        PORT: '1234',
                    },
                },
            },
            { parent: this, dependsOn: [logGroup] },
        )

        new aws.lambda.Permission(
            `${name}-permission`,
            {
                action: 'lambda:InvokeFunction',
                principal: 'apigateway.amazonaws.com',
                function: lambda,
                sourceArn: pulumi.interpolate`${this.apiGateway.executionArn}/*/*`,
            },
            { dependsOn: [this.apiGateway, lambda], parent: this },
        )

        const integration = new aws.apigatewayv2.Integration(
            `${name}-integration`,
            {
                apiId: this.apiGateway.id,
                integrationType: 'AWS_PROXY',
                passthroughBehavior: 'NEVER',
                integrationUri: lambda.arn,
            },
            { parent: this },
        )

        const route = new aws.apigatewayv2.Route(
            `${name}-route`,
            {
                apiId: this.apiGateway.id,
                routeKey: 'ANY /{proxy+}',
                target: pulumi.interpolate`integrations/${integration.id}`,
            },
            { parent: this },
        )

        const apiGatewayLogGroup = new aws.cloudwatch.LogGroup(
            `${name}-api-logs`,
            {
                name: `/aws/lambda/apigateway-${lambdaName}`,
                retentionInDays: 14,
            },
            {
                parent: this,
            },
        )

        this.stage = new aws.apigatewayv2.Stage(
            `${name}-gateway-stage`,
            {
                apiId: this.apiGateway.id,
                name: '$default',
                routeSettings: [],
                autoDeploy: true,
                accessLogSettings: apiGatewayAccessLoggingEnabled
                    ? {
                          destinationArn: apiGatewayLogGroup.arn,
                          format: JSON.stringify({
                              requestId: '$context.requestId',
                              ip: '$context.identity.sourceIp',
                              requestTime: '$context.requestTime',
                              httpMethod: '$context.httpMethod',
                              routeKey: '$context.routeKey',
                              status: '$context.status',
                              protocol: '$context.protocol',
                              responseLength: '$context.responseLength',
                              error: '$context.error.message',
                              integrationError:
                                  '$context.integrationErrorMessage',
                          }),
                      }
                    : undefined,
            },
            { dependsOn: [route], parent: this },
        )

        if (desiredHostname) {
            if (!apiGatewayCertificateArn) {
                throw new ResourceError(
                    'Must specify apiGatewayCertificateArn if desiredHostname is set',
                    this,
                )
            }
            this.apiGatewayDomainName = new aws.apigatewayv2.DomainName(
                `${name}-apigateway-domain`,
                {
                    domainName: desiredHostname,
                    domainNameConfiguration: {
                        certificateArn: apiGatewayCertificateArn,
                        endpointType: 'REGIONAL',
                        securityPolicy: 'TLS_1_2',
                    },
                    tags: getResourceTags(name),
                },
                { parent: this },
            )

            new aws.apigatewayv2.ApiMapping(
                `${name}-api-mapping`,
                {
                    apiId: this.apiGateway.id,
                    domainName: this.apiGatewayDomainName.id,
                    stage: this.stage.name,
                },
                { parent: this },
            )
        }

        this.registerOutputs({
            invokeUrl: this.invokeUrl,
            publicHostname: this.publicHostname,
        })
    }
}
