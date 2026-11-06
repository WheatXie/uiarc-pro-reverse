import { Navigate, Route, Routes } from 'react-router-dom'
import { Sidebar } from '@/site/Sidebar'
import { ComponentPage } from '@/pages/ComponentPage'
import { DocsPage, HomePage } from '@/pages/HomePage'

export default function App() {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />
      <main className="scroll-thin flex-1 overflow-y-auto bg-white">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/docs" element={<Navigate to="/docs/introduction" replace />} />
          <Route path="/docs/:slug" element={<DocsPage />} />
          <Route path="/components/:slug" element={<ComponentPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}
