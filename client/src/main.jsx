import React from 'react'
import ReactDOM from 'react-dom/client'
import { RouterProvider } from 'react-router-dom'
import { router } from './routes'
// QUAN TRỌNG: Phải import file này để nhận màu nền và Tailwind
import './index.css' 
import { HelmetProvider } from 'react-helmet-async';
import { ThemeProvider } from './context/ThemeContext';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <HelmetProvider>
          <RouterProvider router={router} />
      </HelmetProvider>
    </ThemeProvider>
  </React.StrictMode>,
)
