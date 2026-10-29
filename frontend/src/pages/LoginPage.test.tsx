import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import LoginPage from './LoginPage';

const login = vi.fn();

vi.mock('../auth/AuthContext', () => ({
  useAuth: () => ({ login, user: null, loading: false, isAdmin: false }),
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>,
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    login.mockReset();
  });

  it('показывает ошибки валидации и не отправляет пустую форму', async () => {
    renderPage();
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Введите корректный email')).toBeInTheDocument();
    expect(screen.getByText('Обязательное поле')).toBeInTheDocument();
    expect(login).not.toHaveBeenCalled();
  });

  it('вызывает login с нормализованным email', async () => {
    login.mockResolvedValue(undefined);
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), '  Ivan@Example.com ');
    await userEvent.type(screen.getByLabelText('Пароль'), 'Password1!');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    await waitFor(() => expect(login).toHaveBeenCalledWith('ivan@example.com', 'Password1!'));
  });

  it('показывает сообщение сервера при неверных данных', async () => {
    login.mockRejectedValue({
      response: { data: { error: { message: 'Неверный email или пароль' } } },
    });
    renderPage();
    await userEvent.type(screen.getByLabelText('Email'), 'ivan@example.com');
    await userEvent.type(screen.getByLabelText('Пароль'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: 'Войти' }));
    expect(await screen.findByText('Неверный email или пароль')).toBeInTheDocument();
  });
});
