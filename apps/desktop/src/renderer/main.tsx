import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Workbench } from './workbench/Workbench.js';
import './styles.css';
import './explorer.css';
createRoot(document.getElementById('root')!).render(<StrictMode><Workbench /></StrictMode>);
