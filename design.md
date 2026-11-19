# Kick TV interface system

The app is a TV workbench with a charcoal shell, content-led catalogs and clean video playback. The accepted brief and implementation backlog are in `docs/TV-UX-UI-PLAN.md`.

Use one system across every screen. `app/tokens.css` owns semantic colors, spacing, fonts and radii; `app/tv-ui.css` owns the scoped shell and components. Existing styles continue to support advanced playback/chat tools during migration. Use sRGB fallbacks for older webOS engines and progressive OKLCH enhancement only where supported.

Use the system sans serif stack, regular-width body text, 48px page titles, 28px actions, and a 24px minimum for useful catalog information at the 1920×1080 logical canvas. Four columns in Standard, three in Large. Use an 8px spacing scale and 64px horizontal safe area. No remote font dependency.

Focus is an immediate white 4px ring. Playing, saved, enabled and selected states use separate markers; Kick green is a restrained brand/action accent. Live uses a dot and a label. Buttons stay on one line; long content titles receive bounded wrapping. Panels use opaque surfaces instead of expensive blur effects.

Basic arrows, OK and Back must complete all core tasks. First OK reveals playback controls; timeline changes preview until OK. Explicit panels remain visible until dismissed. One modal owner at a time; Back restores its trigger. Preserve catalog item identity across asynchronous refreshes.

No decorative imagery, auto-playing preview video, focus-ring animation or video-plane resizing animation. Respect reduced motion. Validate on physical supported TVs as well as the isolated desktop fixtures. Desktop results do not certify the webOS video plane.
