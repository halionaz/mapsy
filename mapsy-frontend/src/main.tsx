import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import { App } from '@/app/App'

const root = document.getElementById('root')
if (!root) throw new Error('index.html에 #root 엘리먼트가 없음')

// StrictMode를 App 안이 아니라 여기서 씌운다 — App을 마운트하는 다른 것(테스트, 나중의
// Storybook)이 빠져나갈 길 없이 이중 호출 effect에 묶이지 않도록.
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
