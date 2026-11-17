# HoHo Manager Design Lab

The Design Lab is a separate, authenticated visual website/UI builder powered by Puck.

## Open it
- Visit `/design` after signing in.
- Use the **Design Lab** entry in the main studio header.
- It is separate from the Discord message/embed editor.

## Included setup
- Puck 0.24 configuration at `client/src/config/puck/designConfig.tsx`.
- Reusable blocks grouped into Layout, Typography, Marketing, and Media categories.
- Nested slot-based sections, containers, and grids.
- Root page settings for title, background, and content width.
- Desktop, laptop, tablet, and mobile canvas viewports.
- Separate Render-based preview using the same configuration.
- Browser-local draft autosave, JSON import/export, and starter reset.

## Available blocks
| Category | Blocks |
| --- | --- |
| Layout | Section, Container, Grid, Spacer, Divider |
| Typography | Heading, Text, Quote |
| Marketing | Hero, Button, Feature Card |
| Media | Image |

## Draft storage and publishing
Drafts are saved in browser localStorage under a key scoped to the authenticated user's ID. The Puck **Save draft** action writes to the same local draft store. JSON export/import is provided for backups and moving a design between browsers or devices.

There is not yet a server-side design persistence or public publishing endpoint. Save is local-only; it does not publish a public website or save to the HoHo Manager database.

## Dependency note
The client manifest declares `@puckeditor/core`. Your local install already generated its lockfile update; keep your generated `package-lock.json` change and commit it with the dependency update if it is not already present. The connected GitHub environment could not regenerate the lockfile.

## Main integration files
- `client/src/pages/DesignLabPage.tsx`
- `client/src/pages/design-lab.css`
- `client/src/config/puck/designConfig.tsx`
- `client/src/utils/puckDesignStorage.ts`
- `client/src/components/layout/StudioRouter.tsx`
- `client/src/components/layout/Header.tsx`
- `client/src/App.tsx`
