import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter, Route, Routes, Navigate } from 'react-router-dom'
import './index.css'
import { StudentApp } from './pages/StudentApp'
import { PartnerTerminal } from './pages/PartnerTerminal'
import { DemoConsole } from './pages/DemoConsole'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<StudentApp />} />
        <Route path="/partner" element={<PartnerTerminal />} />
        <Route path="/demo" element={<DemoConsole />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  </StrictMode>,
)
