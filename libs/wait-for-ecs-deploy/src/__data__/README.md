# `__data__`

These are mock responses from the aws ecs.DescribeServices API.
They were created using `aws ecs describe-services`.
They are used to mock the aws sdk in unit tests.

- `ecs-describe-services-all-services-deployed.json`: run after a successful deployment.
- `ecs-describe-services-failed-rollback-in-progress.json`: run after a failed deployment, while rollback is in progress.
- `ecs-describe-services-failed-rolled-back.json`: run after a failed deployment, after the rollback has completed.
