# wait-for-ecs-deploy

Provides a pulumi resource which waits for an ECS deployment to complete. Once the deployment completes, it checks whether the deployment was successful.

If a deployment error is detected, a pulumi error is raised.

## Usage

This module requires an ECS service with circuit breaker enabled.

```ts
import * as aws from '@pulumi/aws'

import { WaitForEcsDeployment } from '@wanews/pulumi-wait-for-ecs-deploy'

const cluster = new aws.ecs.Cluster('cluster', {
  //...
})

const service = new aws.ecs.Service('service', {
  deploymentController: {
    type: 'ECS',
  },
  deploymentCircuitBreaker: {
    enable: true,
    rollback: true,
  },
})

const deployment = new WaitForEcsDeployment('wait-for-deployment', {
  clusterName: cluster.name,
  serviceName: service.name,
  awsRegion: 'ap-southeast-2', // optional
  assumeRole: 'arn:aws:iam::12345678:role/myRole', // optional
})

pulumi.all([d.status, d.failureMessage]).apply(([status, failureMessage]) => {
  console.log(`deployment completed with status ${status}: ${failureMessage}`)
})
```

The WaitForEcsDeployment resource will wait for the ECS deployment to complete, and then return status to `COMPLETE` or `FAILED`.

By default, it will fail after three minutes and treat the deployment as failed.

## Known issues

- Some failure modes are not yet supported by circuit breakers. To catch these conditions, set timeout appropriately.

## Tests

Run `yarn nx test wait-for-ecs-deploy` to execute the unit tests via [Jest](https://jestjs.io).

These tests use

## Under the hood

Each ECS service has two deployments:

- `ACTIVE`: if a deployment is in progress, this is the deployment
- `PRIMARY`: this is the deployment currently receiving traffic

When ecs.CreateService or ecs.UpdateService is called:

1. a new deployment is created
2. each task in the `PRIMARY` deployment is replaced by a new task in the `ACTIVE` deployment
3. once the new task becomes healthy, the task in `PRIMARY` is torn down
4. finally, once all tasks are replaced, the `ACTIVE` deployment becomes the new `PRIMARY` deployment.

If a new task does not become healthy at step 3, then it is deleted and recreated. By default, this happends undefinitely until a replacement task becomes healthy. However, if circuit breaker is enabled, then when too many tasks fail to become healthy, then the `ACTIVE` deployment is stopped. If rollback is enabled, the last healthy deployment is re-deployed.

This module uses ecs.DescribeServices to detect errors that occur during a deployment.

A successful deployment is where all deployments are COMPLETED:

```json
{
  "services": [
    {
      "deployments": [
        {
          "status": "PRIMARY",
          "taskDefinition": "arn:aws:ecs:ap-southeast-2:291971919224:task-definition/news-thewest-pr713-web-app-task-definition:3",
          "rolloutState": "COMPLETED",
          "rolloutStateReason": "ECS deployment ecs-svc/6405940160831029548 completed."
        }
      ]
    }
  ]
}
```

A failed deployment has `rolloutState: FAILED`:

```json
{
  "services": [
    {
      "deployments": [
        {
          "status": "ACTIVE",
          "taskDefinition": "arn:aws:ecs:ap-southeast-2:291971919224:task-definition/news-thewest-pr713-web-app-task-definition:3",
          "rolloutState": "FAILED",
          "rolloutStateReason": "ECS deployment circuit breaker: tasks failed to start."
        }
      ]
    }
  ]
}
```

If rollbacks are enabled, it will also show the task is being rolled back:

```json
{
  "services": [
    {
      "deployments": [
        {
          "status": "PRIMARY",
          "taskDefinition": "arn:aws:ecs:ap-southeast-2:291971919224:task-definition/news-thewest-pr713-web-app-task-definition:2",
          "rolloutState": "IN_PROGRESS",
          "rolloutStateReason": "ECS deployment circuit breaker: rolling back to deploymentId ecs-svc/6405940160831029548."
        },
        {
          "status": "ACTIVE",
          "taskDefinition": "arn:aws:ecs:ap-southeast-2:291971919224:task-definition/news-thewest-pr713-web-app-task-definition:3",
          "rolloutState": "IN_PROGRESS",
          "rolloutStateReason": "ECS deployment ecs-svc/1281894607538416024 in progress."
      ]
    }
  ]
}
```

Once the rollback is complete, it will show that the previous version is once again the PRIMARY deployment:

```json
{
  "services": [
    {
      "deployments": [
        {
          "status": "PRIMARY",
          "taskDefinition": "arn:aws:ecs:ap-southeast-2:291971919224:task-definition/news-thewest-pr713-web-app-task-definition:2",
          "rolloutState": "COMPLETED",
          "rolloutStateReason": "ECS deployment ecs-svc/6405940160831029548 completed."
        }
      ]
    }
  ]
}
```

However, the rollback can be detected by examining the taskDefinition in the deployment; in this case, revision 3 was deployed, but the last successful deployment is revision 2.
