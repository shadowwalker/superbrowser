# Keep browser lifetime outside automation scripts

Superbrowser uses one Chrome Dev process launched separately from its automation scripts. Scripts connect through local CDP, while the user can sign in through the same open browser window and retain tabs between runs. Scripts must release their own connections without closing the browser, so browser cleanup cannot follow the usual launch-and-close pattern used by isolated automation runs.
