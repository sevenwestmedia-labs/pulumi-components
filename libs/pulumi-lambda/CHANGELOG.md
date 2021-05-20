# @wanews/pulumi-lambda

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
