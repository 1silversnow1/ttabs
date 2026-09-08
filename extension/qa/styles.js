// Lives inside the panel's shadow root, so nothing here can leak into the page
// under test — and nothing the page ships can reach in and restyle the panel.

export const PANEL_CSS = `
  :host { all: initial; }

  /* An author rule setting display beats the user-agent stylesheet's rule for
     [hidden], and several rules below set it — without this the hidden property
     the panel toggles everywhere would quietly do nothing. */
  [hidden] { display: none !important; }

  .panel {
    position: fixed;
    right: 16px;
    bottom: 16px;
    z-index: 2147483647;
    width: 420px;
    max-width: calc(100vw - 32px);
    max-height: 70vh;
    display: flex;
    flex-direction: column;
    font: 15px/1.4 -apple-system, system-ui, sans-serif;
    color: #1a1a1a;
    background: #fff;
    border: 1px solid #d0d0d0;
    border-radius: 8px;
    box-shadow: 0 6px 24px rgba(0, 0, 0, 0.18);
  }

  .head {
    display: flex;
    align-items: center;
    width: 100%;
    gap: 9px;
    padding: 9px 12px;
    border: 0;
    border-bottom: 1px solid #e6e6e6;
    background: none;
    font: inherit;
    color: inherit;
    text-align: left;
    /* The header both collapses the panel and drags it; the grab cursor is the
       only hint that the second is possible. */
    cursor: grab;
    /* Pointer events on a header that scrolls the page under a drag would fight
       each other on a touchscreen or a trackpad. */
    touch-action: none;
    user-select: none;
  }

  .panel.dragging .head { cursor: grabbing; }

  .task { font-weight: 600; }
  .count { color: #777; margin-left: auto; }

  .chevron {
    line-height: 1;
    color: #777;
  }

  /* Collapsed, the header is the whole panel: a small square icon-only
     button, so it stays clickable to expand without any body/foot below it. */
  .panel.collapsed {
    width: auto;
  }
  .panel.collapsed .head {
    width: 44px;
    height: 44px;
    padding: 0;
    justify-content: center;
    border-bottom: 0;
  }
  .panel.collapsed .task,
  .panel.collapsed .count {
    display: none;
  }
  .panel.collapsed .chevron { font-size: 20px; }

  .body { overflow-y: auto; padding: 5px 0; }

  .area {
    padding: 7px 12px 2px;
    color: #777;
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .case { padding: 4px 12px; }

  .row { display: flex; align-items: baseline; gap: 7px; }
  .row input { margin: 0; }
  .row input[type="checkbox"] { width: 16px; height: 16px; }

  .title {
    flex: 1;
    cursor: pointer;
    text-align: left;
    background: none;
    border: 0;
    padding: 0;
    font: inherit;
    color: inherit;
  }

  .case.outdated .title { text-decoration: line-through; color: #999; }

  /* The panel already indents secondary matter behind a left rule; the note
     reuses that vocabulary in amber, so a human's words read apart from the
     machine's. field-sizing grows it with what is typed — Chrome only, which
     is the whole audience of an unpacked Chrome extension, so no input handler
     measuring scrollHeight and no drag grip to ignore. */
  .quoted {
    display: block;
    box-sizing: border-box;
    width: calc(100% - 26px);
    margin: 5px 0 7px 26px;
    padding: 1px 0 1px 9px;
    font: inherit;
    color: #4a3a10;
    background: none;
    border: 0;
    border-left: 2px solid #f0dfae;
    resize: none;
    outline: none;
    overflow: hidden;
    field-sizing: content;
    min-height: 1.4em;
  }
  .quoted:focus { border-left-color: #d99b00; background: #fffdf6; }
  .quoted::placeholder { color: #b0a68a; }

  /* What the folded case shows instead of the field: the fold hides what to do,
     never what was found. */
  .comment-text {
    box-sizing: border-box;
    width: calc(100% - 26px);
    margin: 5px 0 7px 26px;
    padding-left: 9px;
    border-left: 2px solid #f0dfae;
    color: #6a5a2a;
    white-space: pre-wrap;
  }

  .badge {
    font-size: 12px;
    padding: 0 5px;
    border-radius: 3px;
    background: #eee;
    color: #666;
  }
  .badge.new { background: #e3f2e3; color: #2b6b2b; }
  .badge.updated { background: #fff3cd; color: #7a5c00; }
  .badge.full { background: #e3f2e3; color: #2b6b2b; }
  .badge.partial { background: #fff3cd; color: #7a5c00; }

  .count .hands-on {
    color: #b00020;
    font-weight: 600;
    margin-left: 4px;
  }

  .hide-covered {
    display: block;
    width: 100%;
    margin-bottom: 7px;
    padding: 5px 7px;
    font: inherit;
    font-size: 13px;
    color: #444;
    background: #f4f4f4;
    border: 1px solid #d0d0d0;
    border-radius: 5px;
    cursor: pointer;
  }
  .hide-covered.active {
    background: #e3f2e3;
    border-color: #2b6b2b;
    color: #2b6b2b;
  }

  .criteria {
    border-top: 1px solid #e6e6e6;
    margin-top: 7px;
    padding: 7px 12px;
    background: #fbfbfb;
  }
  .criteria h2 { margin: 0 0 5px; font-size: 13px; text-transform: uppercase; color: #555; }
  .criterion { margin-bottom: 7px; display: flex; align-items: baseline; gap: 7px; flex-wrap: wrap; }
  .criterion .summary { font-weight: 600; flex: 1 1 auto; }
  .criterion .meta { color: #666; font-size: 13px; flex-basis: 100%; }

  .badge.evidence-test, .badge.evidence-drive { background: #e3f2e3; color: #2b6b2b; }
  .badge.evidence-manual { background: #fff3cd; color: #7a5c00; }
  .badge.evidence-deferred { background: #eee; color: #888; }

  .details {
    margin: 5px 0 7px 26px;
    padding-left: 9px;
    border-left: 2px solid #eee;
    color: #444;
  }
  .details ol { margin: 0 0 5px; padding-left: 18px; }
  .details .expected { color: #222; }
  .details .covered { color: #5a6b7a; font-size: 12px; margin-top: 4px; }

  .error { color: #b00020; font-size: 13px; margin-left: 26px; }

  .discrepancies {
    border-top: 1px solid #e6e6e6;
    margin-top: 7px;
    padding: 7px 12px;
    background: #fcfaf5;
  }
  .discrepancies h2 { margin: 0 0 5px; font-size: 13px; text-transform: uppercase; color: #7a5c00; }
  .discrepancy { margin-bottom: 7px; }
  .discrepancy .summary { font-weight: 600; }
  .discrepancy .meta { color: #666; font-size: 13px; }

  .foot { padding: 9px 12px; border-top: 1px solid #e6e6e6; }
  .finish-error { margin: 0 0 7px; }

  .done {
    width: 100%;
    padding: 7px;
    font: inherit;
    color: #fff;
    background: #2b6b2b;
    border: 0;
    border-radius: 5px;
    cursor: pointer;
  }

  .ended { padding: 18px 12px; text-align: center; color: #777; }
`;
