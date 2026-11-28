# Getting started

1. Select your keyboard and the controller variant matching your hardware.
2. Start from the default layout or use **Import project** to open a Z-MapFlow JSON project or `.keymap`.
3. Select a layer on the left. Click an action in the palette and then a key, or drag the action onto the layout.
4. Click a key without a selected palette action to edit its parameters. **Escape** cancels palette selection.
5. Choose **Save** to persist the project locally.

See [Supported keyboards](./keyboards) for exact controllers, optional encoders/displays and the experimental wired Silakka54 port.

## Layout and palette

The bottom palette contains keys, modifiers, tap/hold, layers, Bluetooth, mouse, resources and language aliases. Searching expands a collapsed palette. Drag the divider to share space between the layout and palette; Home or double-click restores the automatic split.

Main actions are in the right sidebar with tooltips. Layers are on the left of the keyboard, with scrolling when needed. The app version appears discreetly in the header.

The Keys palette expands across the available window width while preserving minimum key widths. On narrower windows, scroll horizontally to reach the remaining keys. Select **Keyboard language** in the palette to access ABNT2 or an imported language; see [keyboard languages](./configuration#choose-the-keyboard-language).

## Behaviors, macros and combos

**Behaviors** provide reusable actions, including tap/hold, tap sequences and modifier-dependent alternatives. Each use may have different parameters. **Macros** run action sequences. **Combos** trigger an action when selected key positions are pressed together.

The editor validates parameter counts and types before assignment. Invalid drafts appear in red, preserve the last valid value and block saving. Use **Discard draft** in the key editor to close without applying invalid text. Firmware compilation checks additional hardware and module rules.

Behavior cards start collapsed. Their name, type, assignment and delete controls remain visible. Use the arrow beside a behavior to show its settings; each card opens independently. Applied edits survive collapsing. Correct invalid drafts before closing a card.

## Save and export

- **Save** persists the current project without building.
- **Build** uses the last saved revision.
- **Save and build** saves and builds that exact revision.
- **Export project** creates an editable JSON project.
- **Export keymap** writes ZMK files and required companion files.

**Discard** restores the last saved state, or the initial imported state before the first save.

## Language

Choose the interface language in **Settings → Application**. This does not change your operating system layout or the keycodes in your project. Existing layer and macro names are preserved.

## Support the project

**Star on GitHub** and **Buy me a coffee** remain visible in the header and open their respective pages in your browser. You can also [star the repository](https://github.com/Henriquex25/Z-MapFlow) or [support development](https://www.buymeacoffee.com/henriquemiranda) here. Support is optional; all features remain available.

The app may show a small, non-blocking star invitation after five launches and 30 minutes of active use. A separate donation invitation requires ten launches, two hours of active use and at least three launches after responding to the star invitation. Invitations wait until after the first minute of a session and are hidden during builds, flashing and other dialogs. Background or idle time does not count as active use.

Accepting, closing or choosing **No, thanks** permanently dismisses that invitation on this computer. The matching header button also dismisses it. The buttons remain available for later voluntary support. Counters and responses are stored locally, separately from keyboard projects, and survive updates. The app does not access your GitHub account, add stars automatically or process payments.

### Choosing actions and parameters

![Compact numbered macro steps and the action palette](/images/z-mapflow-contextual-palette.png)

Settings hides the action palette completely. Macros, Behaviors, Combos and Conditional layers start with it collapsed. Clicking any palette tab or entering a search expands it.

Choose the action type from the **Behavior** dropdown. For a key, layer, Bluetooth profile or other listed parameter, click its slot to open compatible options below, then click an option or drag it onto the slot. A key parameter accepts keycodes/shortcuts, while a complete action field can accept a compatible macro or behavior. Macros and Behaviors have their own palette tabs; invalid or recursive choices are filtered out. Numeric values keep their inputs, and advanced shortcut/ZMK entry remains available.

After clicking or dropping a palette action into an editor slot, selection ends and the palette collapses. Click another slot or palette tab to open it again. Escape ends selection without changing the field. Closing a resource card or switching views clears its destination. In the key editor, the dialog moves above the palette so you can click or drag without dropping onto the keyboard behind it.

Macro **Step mode** controls execution: **Tap** presses and releases, **Press** holds, **Release** releases, and **Wait** pauses. The **Behavior** dropdown chooses the key/action to execute. Steps appear as compact numbered rows, read from top to bottom. Click a row’s action slot to replace it; use its pencil icon to edit the behavior, individual parameters or advanced code. **Add step**, above the sequence, creates an empty numbered step. Click or drop an action into that new row. Timing defaults are under **Timing**. Use the up/down arrows to reorder steps. The header’s **Assign to keyboard** button assigns the complete macro; the **Macros** palette tab offers it for dragging.

New macros, behavior child actions and combo outputs start with empty action slots. Fill the required slots before assigning, saving or building. Existing imported actions are preserved. Supplementary explanations are available from the **?** buttons by hovering or focusing them; Escape dismisses the tooltip.
