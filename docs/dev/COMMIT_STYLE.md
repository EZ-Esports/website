# Commit Message Style

## Format
```
<type>: <description>
```

## Common Types

| Type | Usage |
|------|-------|
| `feat` | New feature |
| `fix` | Bug fix |
| `chore` | Maintenance (deps, config, tooling) |
| `refactor` | Code restructuring (no behavior change) |
| `docs` | Documentation only |
| `style` | Code formatting (not CSS) |
| `test` | Adding/updating tests |
| `perf` | Performance improvements |
| `ci` | CI/CD changes |
| `build` | Build system or dependency changes |

## Examples
```bash
feat: add user authentication
fix: resolve memory leak in data processor
chore: update dependencies
refactor: simplify validation logic
docs: update README installation steps
```

## Breaking Changes
Add `!` after type or use `BREAKING CHANGE:` in commit body:
```bash
feat!: remove deprecated API endpoint
```