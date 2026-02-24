# cf-deploy Example

Copy `cf-deploy.yml` to your project root and customize it.

## Quick Start

```sh
# 1. Clone cf-deploy into your project
git clone --depth 1 https://github.com/joeblew999/cf-deploy.git .src/cf-deploy

# 2. Copy and edit the config
cp .src/cf-deploy/example/cf-deploy.yml ./cf-deploy.yml
# Edit cf-deploy.yml with your worker name, domain, etc.

# 3. Copy the version picker to your web directory
cp .src/cf-deploy/web/version-picker.js ./public/version-picker.js

# 4. Use
bun .src/cf-deploy/bin/cf-deploy.ts upload --version 1.0.0
bun .src/cf-deploy/bin/cf-deploy.ts versions-json
bun .src/cf-deploy/bin/cf-deploy.ts smoke
bun .src/cf-deploy/bin/cf-deploy.ts promote
```

## Version Picker

Add to your HTML:

```html
<script type="module" src="/version-picker.js"></script>
<cf-version-picker></cf-version-picker>
```

Optional attributes:

```html
<cf-version-picker
  health-path="/api/health"
  manifest-path="/versions.json"
  local-port="8788"
></cf-version-picker>
```

## Task Runner Integration

### go-task

```yaml
tasks:
  "cf:upload":
    cmds: [bun .src/cf-deploy/bin/cf-deploy.ts upload]
  "cf:promote":
    cmds: [bun .src/cf-deploy/bin/cf-deploy.ts promote]
  "cf:smoke":
    cmds: [bun .src/cf-deploy/bin/cf-deploy.ts smoke]
```

### npm scripts

```json
{
  "scripts": {
    "deploy:upload": "bun .src/cf-deploy/bin/cf-deploy.ts upload",
    "deploy:promote": "bun .src/cf-deploy/bin/cf-deploy.ts promote"
  }
}
```

### Makefile

```makefile
CF = bun .src/cf-deploy/bin/cf-deploy.ts
upload:  ; $(CF) upload
promote: ; $(CF) promote
smoke:   ; $(CF) smoke
```
