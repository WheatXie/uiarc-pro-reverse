import { Navigate, Route, Routes, useParams } from "react-router-dom";
import { HomePage } from "./site/HomePage";
import { ItemPage } from "./site/ItemPage";
import { DocsPage } from "./site/DocsPage";
import { ProPage } from "./site/ProPage";
import FramePage from "./frame/FramePage";

/**
 * The item page reads its slug from the route params. Keying it by slug forces a remount on
 * navigation, so view/tab/source state never leaks between two items.
 */
function ItemRoute({ kind }: { kind: "component" | "block" }) {
  const { slug = "" } = useParams();
  return <ItemPage key={`${kind}/${slug}`} kind={kind} slug={decodeURIComponent(slug)} />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/frame/:slug" element={<FramePage />} />
      <Route path="/" element={<HomePage />} />
      <Route path="/pro" element={<ProPage />} />
      <Route path="/docs" element={<Navigate to="/docs/introduction" replace />} />
      <Route path="/docs/:slug" element={<DocsPage />} />
      <Route path="/components/blocks/:slug" element={<ItemRoute kind="block" />} />
      <Route path="/components/:slug" element={<ItemRoute kind="component" />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
