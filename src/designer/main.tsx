import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ShipDesigner } from './ShipDesigner'

const root = document.getElementById('designer-root')
if (!root) throw new Error('#designer-root not found')

createRoot(root).render(
  <StrictMode>
    <ShipDesigner />
  </StrictMode>
)
