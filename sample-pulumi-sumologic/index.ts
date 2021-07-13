import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import * as sumo from '@wanews/pulumi-sumologic'

new sumo.LambdaSumo('foo', {})
