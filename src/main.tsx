import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import { queryClient } from '@/lib/queryClient'
import { AuthProvider } from '@/contexts/AuthContext'
import { WorkspaceProvider } from '@/contexts/WorkspaceContext'
import { AppProvider } from '@/contexts/AppContext'
import { mesAtualRef } from '@/lib/dates'
import App from '@/App'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <WorkspaceProvider>
          <AppProvider mesInicial={mesAtualRef()}>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </AppProvider>
        </WorkspaceProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
)
