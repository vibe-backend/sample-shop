// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import App from './App';
import { AuthProvider } from './auth';
import { ThemeProvider } from './theme';

function renderAt(path: string) {
  return render(
    <ThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>
    </ThemeProvider>,
  );
}

afterEach(cleanup);

describe('smoke render (mock mode)', () => {
  it('renders the product list with products', async () => {
    renderAt('/');
    expect(screen.getByRole('heading', { name: '精選好物' })).toBeTruthy();
    await waitFor(() => expect(screen.getByText('楓糖堅果燕麥脆片')).toBeTruthy(), { timeout: 5000 });
  });

  it('renders the login page with demo accounts', () => {
    renderAt('/login');
    expect(screen.getByRole('heading', { name: '登入' })).toBeTruthy();
    expect(screen.getByText('示範帳戶')).toBeTruthy();
  });

  it('redirects the cart to login when signed out', async () => {
    renderAt('/cart');
    await waitFor(() => expect(screen.getByRole('heading', { name: '登入' })).toBeTruthy());
  });

  it('applies the dark class from the saved theme', () => {
    localStorage.setItem('shop.theme', 'dark');
    renderAt('/login');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    localStorage.removeItem('shop.theme');
  });

  it('does not persist the default theme on first render', () => {
    localStorage.removeItem('shop.theme');
    renderAt('/login');
    expect(localStorage.getItem('shop.theme')).toBeNull();
  });
});
