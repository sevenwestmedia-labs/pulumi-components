import * as aws from '@pulumi/aws'
import { ApiArgs } from '@pulumi/aws/apigatewayv2/api'
import * as pulumi from '@pulumi/pulumi'
import { ResourceError } from '@pulumi/pulumi'
import { LambdaFunction } from '@wanews/pulumi-lambda'

export class ApiGatewayLambdaProxy extends pulumi.ComponentResource {
    stage: aws.apigatewayv2.Stage
    apiGateway: aws.apigatewayv2.Api
    invokeUrl: pulumi.Output<string>
    publicHostname: pulumi.Output<string>
    apiGatewayDomainName: aws.apigatewayv2.DomainName | undefined
    apiGatewayHostname: pulumi.Output<string>
    lambdaExecutionRole: aws.iam.Role

    constructor(
        name: string,
        {
            apiGatewayCertificateArn,
            hostname,

            lambdaOptions,
            apiGatewayOptions = {},
            getTags,

            apiGatewayAccessLoggingEnabled,
        }: {
            /** The custom hostname to map to the API Gateway */
            hostname?: pulumi.Input<string>
            /** If hostname is set must be specified */
            apiGatewayCertificateArn?: pulumi.Input<string>

            /**
             * Lambda options
             * @see https://www.pulumi.com/docs/reference/pkg/aws/lambda/function/#inputs
             */
            lambdaOptions: Omit<aws.lambda.FunctionArgs, 'role'>

            apiGatewayOptions?: Omit<ApiArgs, 'protocolType' | 'tags'>

            /** Callback to create tags for the resources created */
            getTags: (
                name: string,
            ) => {
                [key: string]: pulumi.Input<string>
            }

            /**
             * Enables API gateway logging
             *
             * WARNING: If your AWS account has a number of API gateways the managed resource policy may grow too big
             * and deployments start failing.
             */
            apiGatewayAccessLoggingEnabled?: boolean
        },
        opts?: pulumi.ResourceOptions,
    ) {
        super('lambda-apigateway-proxy', name, {}, opts)

        this.apiGateway = new aws.apigatewayv2.Api(
            `${name}-gateway`,
            {
                ...apiGatewayOptions,
                protocolType: 'HTTP',
                tags: getTags(name),
            },
            { parent: this },
        )

        this.invokeUrl = hostname
            ? pulumi.interpolate`https://${hostname}`
            : pulumi.interpolate`${this.apiGateway.apiEndpoint}`

        this.apiGatewayHostname = pulumi.interpolate`${this.apiGateway.id}.execute-api.ap-southeast-2.amazonaws.com`

        this.publicHostname = hostname
            ? pulumi.output(hostname)
            : this.apiGatewayHostname

        const lambdaFunction = new LambdaFunction(name, {
            getTags,
            lambdaOptions,
        })
        this.lambdaExecutionRole = lambdaFunction.executionRole

        new aws.lambda.Permission(
            `${name}-permission`,
            {
                action: 'lambda:InvokeFunction',
                principal: 'apigateway.amazonaws.com',
                function: lambdaFunction.function,
                sourceArn: pulumi.interpolate`${this.apiGateway.executionArn}/*/*`,
            },
            {
                dependsOn: [this.apiGateway, lambdaFunction.function],
                parent: this,
            },
        )

        const integration = new aws.apigatewayv2.Integration(
            `${name}-integration`,
            {
                apiId: this.apiGateway.id,
                integrationType: 'AWS_PROXY',
                integrationUri: lambdaFunction.function.arn,
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

        const apiGatewayLogGroup = apiGatewayAccessLoggingEnabled
            ? new aws.cloudwatch.LogGroup(
                  `${name}-api-logs`,
                  {
                      name: `/aws/lambda/apigateway-${lambdaFunction.function.name}`,
                      retentionInDays: 14,
                  },
                  {
                      parent: this,
                  },
              )
            : undefined

        this.stage = new aws.apigatewayv2.Stage(
            `${name}-gateway-stage`,
            {
                apiId: this.apiGateway.id,
                name: '$default',
                routeSettings: [],
                autoDeploy: true,
                accessLogSettings: apiGatewayLogGroup
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

        if (hostname) {
            if (!apiGatewayCertificateArn) {
                throw new ResourceError(
                    'Must specify apiGatewayCertificateArn if desiredHostname is set',
                    this,
                )
            }
            this.apiGatewayDomainName = new aws.apigatewayv2.DomainName(
                `${name}-apigateway-domain`,
                {
                    domainName: hostname,
                    domainNameConfiguration: {
                        certificateArn: apiGatewayCertificateArn,
                        endpointType: 'REGIONAL',
                        securityPolicy: 'TLS_1_2',
                    },
                    tags: getTags(name),
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
            apiGatewayHostname: this.apiGatewayHostname,
        })
    }
}
