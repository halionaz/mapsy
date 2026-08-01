import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/app/App'

const root = document.getElementById('root')
if (!root) throw new Error('#root element not found in index.html')

// StrictMode is assembled here rather than inside App so that anything else
// mounting App — tests, a future Storybook — isn't forced into double-invoked
// effects with no way out.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
