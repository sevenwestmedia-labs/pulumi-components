# WANews Pulumi Components

Contains reusable Pulumi ComponentResources or DynamicResources we have written.

## Add a new component

```
nx generate @wanews/nx-typescript-project-references:library \
  --name=pulumi-<name> \
  --package \
  --packageName=@wanews/pulumi-<name>
```

## Testing

Ensure you have a AWS_PROFILE set which can create resources
