import { problemCount, problemLine, type Problem } from "./use-board.js";

/** The problem list under a board: a heading and one line each. */
export function ProblemList({ problems }: { problems: Problem[] }) {
  return (
    <div className="tsquare-problems" role="note">
      <div className="tsquare-problems-title">{problemCount(problems.length)}</div>
      <ul className="tsquare-problems-list">
        {problems.map((p, i) => <li key={i} className="tsquare-problem">{problemLine(p)}</li>)}
      </ul>
    </div>
  );
}
