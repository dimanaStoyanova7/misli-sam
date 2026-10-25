import Shell from "../Shell";

// One shell for all teacher screens. It lives in the layout so its state (the material
// you are working on) survives moving between addresses; the pages themselves are empty.
export default function AppLayout() {
  return <Shell />;
}
