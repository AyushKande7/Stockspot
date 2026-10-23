<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Application architecture
- Keep catalogue comparisons and basket calculations in pure, testable client-safe modules; this keeps shopper pricing rules consistent and independently verifiable.
- Load Google Maps JavaScript asynchronously inside a client-only map component; keep map credentials in public browser configuration and never use Places or server credentials in the browser.
- Keep account profile fields separate from authorization; all shopper/store-owner privileges remain determined by the protected role table.
- Place password recovery on a public TanStack route and distinguish browser connectivity failures from actual not-found routes.
