# @wanews/pulumi-apigateway-lambda-proxy

## 0.14.0

### Minor Changes

- 115e942: Upgraded dependencies

### Patch Changes

- Updated dependencies [115e942]
  - @wanews/pulumi-lambda@0.11.0

## 0.13.1

### Patch Changes

- ad9c1f6: Add aliases to existing component resources to allow using this module

## 0.13.0

### Minor Changes

- d652454: Allow clients to set an execution role on lambda proxy

## 0.12.2

### Patch Changes

- 8e34103: Fix region in apiGatewayHostname

## 0.12.1

### Patch Changes

- afd3eaa: Fixed bug in api gateway log group when apiGatewayAccessLoggingEnabled is turned on

## 0.12.0

### Minor Changes

- 95db968: Fixed dependencies being bundled, package.json incorrectly defined dependencies and missing information

### Patch Changes

- Updated dependencies [95db968]
  - @wanews/pulumi-lambda@0.10.0

## 0.11.0

### Minor Changes

- aa190ee: Expose lambdaFunction from apigateway-lambda-proxy

## 0.10.0

### Minor Changes

- dc6d4be: allow overriding default periods of API Gateway metric alarms

### Patch Changes

- 06ea1ce: fix ValidationError due to missing period

## 0.9.0

### Minor Changes

- ce5aebc: fix ConflictsWith error in @wanews/pulumi-apigateway-lambda-proxy

## 0.8.0

### Minor Changes

- fe06604: add metric alarms for API Gateway

## 0.7.0

### Minor Changes

- b66f5d5: Fixed being unable to import existing role

## 0.6.0

### Minor Changes

- d7bece3: Fixed lambda not having parent set

## 0.5.0

### Minor Changes

- e8a6e95: Allow pulumi inputs as arguments to lambda proxy

## 0.4.0

### Minor Changes

- 7a07483: Removed unneeded cert validation dependency
- 7a07483: Allow specifying of api gateway options
- 7a07483: Removed tslib

## 0.3.0

### Minor Changes

- f0ed3da: Add missing dependency

## 0.2.0

### Minor Changes

- 9990b6e: Improved docs and updated build tooling

## 0.1.0

### Minor Changes

- 4e92043: Initial release of apigateway lambda proxy
