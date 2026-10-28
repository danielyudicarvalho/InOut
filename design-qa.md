# Reversal detail reference review — 2026-10-28

final result: blocked

Source: user attachment `image(20261028-205324).png`, 930 × 610, containing laptop and phone mockups. The comparison crops the laptop screen to (39,50)–(617,565), excluding the bezel, and scales it proportionally beside the browser capture. No claim of pixel-identical viewport normalization.

Implementation: `/lancamento` reversal branch, rendered through a temporary fixture harness using the production `ReversalDetail` component and layout. The fixture routes were removed before the final production build. This is not authenticated API integration evidence.

Evidence:

- Local browser capture (excluded from publication): browser viewport 1363 × 936, CSS density 1.
- Local comparison board (excluded from publication): full-view source/implementation comparison board. Text and reconciliation are readable without a focused crop.
- Responsive browser inspection used a 390 × 844 CSS iframe; this verifies web responsiveness, not React Native or physical devices.

State: registered expense reversal, original −R$320.00, compensation +R$320.00, net R$0.00; reason and audit populated with fixture data.

## Findings and comparison history

1. [P1, fixed] Mobile header overlapped the summary due to a global `header { position: absolute }` rule. Added a scoped static position to the reversal hero; the second 390 px browser capture showed header and summary in normal flow with no overlap.
2. [P2, fixed] Browser-default blue underlined links and a CSS collision with the reversal dialog changed the intended palette and reconciliation grouping. Scoped link styling and separate detail selectors; desktop re-capture verified green links and three distinct reconciliation cells.
3. [P2, open] Artwork and shell differ from the reference: reused the existing Pipo reversal illustration and existing Ninho navigation. The book/ribbon illustration, botanical sidebar scenery, and residence switcher shown in the mock are not reproduced. Visual fidelity acceptance remains pending.
4. [P2, open] Phone mock uses a compact original-entry row and persistent bottom actions. The responsive implementation wraps the original row and uses document-flow actions; native actions also remain in the scroll flow. The content remains accessible, but exact density/footer fidelity is not accepted.

## Required fidelity surfaces

- Typography: serif display headings, sans-serif metadata; sizes adapt at 700 px. Existing app fonts retained. Exact mock typeface matching remains unverified.
- Spacing/layout: desktop cards and two-column metadata reproduced; 390 px content stacks. Fixed header overlap confirmed. Mock/device normalization is approximate, and phone density differs.
- Colors/tokens: cream background, terracotta original, green compensation and muted info bands. Signed amounts and labels communicate direction independently of color.
- Images: real existing Pipo raster and installed icon libraries used; Pipo subject differs from the book illustration. No simulated artwork.
- Copy/content: original link, correction reason, recorded date, actor and per-account reconciliation implemented. Actor uses the actual API user identifier rather than inventing a display name. Device timezone is explicitly labeled. Legacy blank reasons show “Motivo não informado”.

## Interaction and technical verification

- Original-entry CTA navigated to `/lancamento` with household, transaction, period and currency preserved; the real route reached its authentication gate. Full authenticated destination verification is blocked by absent API/session configuration.
- Browser logs checked: only extension metadata errors observed, no application errors during the fixture inspection.
- Shared finance tests cover fetching the linked original, missing-original failure, signed per-account transfer reconciliation and rejection of wrong account/currency/amount/missing leg. Existing duplicate-reversal safeguards still pass.
- Android/iOS device verification and real API integration remain pending.

## Implementation checklist

- Resolve the remaining artwork/shell and compact footer differences against the reference.
- Capture and compare physical or emulated Android/iOS screens.
- Verify original/history navigation using a configured authenticated API session.

This report does not mark visual QA or end-to-end integration as passed. Prior login QA was also pending before this task.
