import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './app';
import { ChakraProvider, defaultSystem } from '@chakra-ui/react';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <ChakraProvider value={defaultSystem}>
      <App />
    </ChakraProvider>
  </React.StrictMode>
);

window.addEventListener('contextmenu', (e) => {
  e.preventDefault();
  operation.rightClick();
});
