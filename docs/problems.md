# Problems

Wireframe text can have mistakes: a misspelled component, a prop that doesn't exist, a broken line. When it does, every component can show the problems, tell your code about them, or both.

## Shown by default

By default, `<Wireframe>` lists the problems under the board, and `<WireframeViewer>` over the bottom of it:

```text
2 problems in this wireframe
• line 3: unknown component "buton" (did you mean button?)
• line 4: Input: fullWidth is a Button prop, not an Input one; an Input already fills its width (width=… sets a fixed one), so remove it (bare words it accepts: text, password, search, email, date, code, open, error, grow)
```

Each line has the line number in the wireframe text and a message, with a "did you mean" when there's a close match. If the text was valid before, the last good board stays visible above the list, dimmed. The markup is `<div class="tsquare-problems" role="note">` with a `tsquare-problems-title` heading and a `tsquare-problems-list` of `tsquare-problem` items, styled by the stylesheet and easy to restyle (see [Styling](styling.md)).

## onProblems

`onProblems` is called with the problems when the text has some, and with `[]` once they're fixed:

```tsx
import { Wireframe, type Problem } from "@tsquare-js/react";

export function Sketch({ text }: { text: string }) {
  const log = (problems: Problem[]) => {
    if (problems.length) console.warn("wireframe problems", problems);
  };
  return <Wireframe source={text} onProblems={log} />;
}
```

Each problem is `{ line, message }`: the line number (1-based) and the message, as in the list.

It's called only when the problems change, not on every render, and never for valid text that never had problems. It's not called while `streaming` is set: half-written text always has problems, so they're reported once the text is complete.

## Hide them and handle them yourself

`showProblems={false}` hides the list. Use it when your app does something better with the problems than showing them, typically in a chat, where the model that wrote the wireframe can fix it. Send the problems back as the next message, and its reply has a corrected board. `repairPrompt` and `formatIssues` from the `tsquare` package write that message, in the wording tsquare's tests measured:

```bash
npm install tsquare
```

```tsx
import Markdown from "react-markdown";
import { formatIssues, repairPrompt } from "tsquare";
import { WireframeStreaming, createTsquareComponents } from "@tsquare-js/react";

declare function sendToModel(message: string): void; // your chat's "send a message"

const components = createTsquareComponents({
  showProblems: false,
  onProblems: (problems) => {
    // "The wireframe has these problems: line 3: … Reply with the corrected wireframe in a single code block."
    if (problems.length) sendToModel(repairPrompt(formatIssues(problems)));
  },
});

export function Reply({ text, streaming }: { text: string; streaming: boolean }) {
  return (
    <WireframeStreaming value={streaming}>
      <Markdown components={components}>{text}</Markdown>
    </WireframeStreaming>
  );
}
```

The messages name the line and the valid options, which is usually enough for a model to fix its wireframe in one round: in tsquare's tests, 27 of 28 broken wireframes from Claude models were valid after one round. `tsquare` is already installed as a dependency of `@tsquare-js/react`; listing it yourself lets you import from it (strict package managers like pnpm require that). More on the loop: [Using it with AI](https://tsquare.dev/docs/ai#the-repair-loop).

With `showProblems={false}` and no valid board yet, the component shows nothing. Show your own message next to it if you want one ("Fixing the wireframe…"), based on what `onProblems` told you.
