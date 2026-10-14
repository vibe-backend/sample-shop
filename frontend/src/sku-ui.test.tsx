// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
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

const radio = (name: string) => screen.getByRole('radio', { name }) as HTMLButtonElement;

describe('SKU selector (mock mode)', () => {
  it('requires full selection, updates price/stock live and disables sold-out specs', async () => {
    renderAt('/products/p_003');
    await waitFor(() => expect(screen.getByRole('heading', { name: '亞麻帆布托特包' })).toBeTruthy(), { timeout: 5000 });
    const price = () => screen.getByTestId('price').textContent ?? '';
    expect(price()).toMatch(/320\.00.*380\.00/);
    // 橄欖綠 has no stock in any size.
    expect(radio('橄欖綠').disabled).toBe(true);

    fireEvent.click(screen.getByRole('button', { name: '加入購物車' }));
    expect(screen.getByRole('alert').textContent).toBe('請選擇顏色、尺寸');

    fireEvent.click(radio('黑色'));
    expect(radio('黑色').getAttribute('aria-checked')).toBe('true');
    expect(radio('大').disabled).toBe(true); // 黑色／大 sold out
    fireEvent.click(radio('標準'));
    expect(price()).toMatch(/320\.00/);
    expect(price()).not.toMatch(/360/);
    expect(screen.getByTestId('stock').textContent).toContain('庫存 5 件');

    fireEvent.click(radio('黑色')); // deselect
    fireEvent.click(radio('米白'));
    fireEvent.click(radio('大'));
    expect(price()).toMatch(/360\.00/);
    expect(screen.getByTestId('stock').textContent).toContain('庫存 4 件');
  });
});
