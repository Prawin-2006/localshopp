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

- Orders are placed and status-changed only through the `place_order` / `update_order_status` database functions, so stock decrements and totals stay atomic and server-trusted.
- Roles live in `user_roles`; admin is granted only via `claim_first_admin` (first account) or by an existing admin — never from signup metadata.
- AI features call the Lovable AI Gateway from server functions in `src/lib/ai.functions.ts`; product suggestions are filtered against real catalog ids before returning.
- Resolve catalog photography in the shared product thumbnail with seller images taking precedence, so all product surfaces use consistent pictures without changing catalog data.
