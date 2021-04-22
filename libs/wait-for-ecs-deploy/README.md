# wait-for-ecs-deploy

Provides a pulumi resource which waits for an ECS deployment to complete. Once the deployment completes, it checks whether the deployment was successful.

If a deployment error is detected, a pulumi error is raised.

## TODO

- [ ] Document requirements (eg circuit breaker, etc)
- [ ] Document how it works under the hood, with expected behaviour
- [ ] Document known issues (eg if there's no circuit breaker)

## Running unit tests

Run `nx test wait-for-ecs-deploy` to execute the unit tests via [Jest](https://jestjs.io).
