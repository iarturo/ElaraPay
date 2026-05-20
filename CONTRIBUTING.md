# Contributing to ElaraPay

Thanks for considering a contribution. ElaraPay is open source and we welcome help.

## Quick start

```bash
git clone https://github.com/iarturo/ElaraPay
cd ElaraPay/contracts
forge install
forge test
```

## Where to start

Check our [good first issues](https://github.com/iarturo/ElaraPay/labels/good%20first%20issue).
These are scoped tasks ideal for first-time contributors.

## Commit style

- feat: add subscription support
- fix: prevent double payment on retry
- docs: update README architecture diagram
- test: add coverage for refund flow

## Pull requests

1. Fork the repo and create a branch from `main`
2. Add tests for any new functionality
3. Ensure `forge test` passes
4. Open PR with description of WHY, not just WHAT

## What we look for

- Tests for the frontend (we have none — high priority)
- Additional stablecoins (USDT, DAI)
- L2 deployments (Optimism, Arbitrum)
- Translations (Spanish, Portuguese)

## Response time

We commit to responding to all PRs and issues within 48h.
