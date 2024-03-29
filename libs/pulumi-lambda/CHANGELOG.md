# @wanews/pulumi-lambda

## 0.11.1

### Patch Changes

- 512a118: bump dependencies to fix tsc error

## 0.11.0

### Minor Changes

- 115e942: Upgraded dependencies

## 0.10.0

### Minor Changes

- 95db968: Fixed dependencies being bundled, package.json incorrectly defined dependencies and missing information

## 0.9.0

### Minor Changes

- a1c7ba8: Allow delay of lambda update so IAM is consistent using delayLambdaDeployment

## 0.8.1

### Patch Changes

- da3dcd1: fix noisy timeout/avg/maxDuration alarms

## 0.8.0

### Minor Changes

- 9c47835: allow existing resources to be moved into this module using aliases

## 0.7.0

### Minor Changes

- ef71abd: Allow role object to be passed as well as name to fix race condition where role hasn't been created yet

## 0.6.0

### Minor Changes

- b66f5d5: Fixed being unable to import existing role

## 0.5.1

### Patch Changes

- b354dbb: fix missing `{parent: this}` in RecommendedAlarms

## 0.5.0

### Minor Changes

- f19f985: add optional metric alarms

## 0.4.0

### Minor Changes

- 7a07483: Removed tslib

## 0.3.0

### Minor Changes

- 9990b6e: Improved docs and updated build tooling

## 0.2.0

### Minor Changes

- e587792: Allow execution role argument to be an arn

## 0.1.1

### Patch Changes

- 134e587: Add ability to pass execution role into lambda

## 0.1.0

### Minor Changes

- feff537: Initial release of lambda resource

### Patch Changes

- 4b84919: Fixed dist not being included in package
