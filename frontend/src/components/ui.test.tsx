import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button, ConfirmDialog, Pagination } from './ui';

describe('Button', () => {
  it('вызывает onClick и блокируется при loading', async () => {
    const onClick = vi.fn();
    const { rerender } = render(<Button onClick={onClick}>Сохранить</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Сохранить' }));
    expect(onClick).toHaveBeenCalledTimes(1);

    rerender(
      <Button onClick={onClick} loading>
        Сохранить
      </Button>,
    );
    expect(screen.getByRole('button', { name: /Сохранить/ })).toBeDisabled();
  });
});

describe('ConfirmDialog', () => {
  it('показывает сообщение и вызывает onConfirm / onCancel', async () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Удалить?"
        message="Комната будет удалена"
        confirmLabel="Удалить"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByRole('dialog', { name: 'Удалить?' })).toBeInTheDocument();
    expect(screen.getByText('Комната будет удалена')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Удалить' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Отмена' }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('ничего не рендерит, когда закрыт', () => {
    render(
      <ConfirmDialog
        open={false}
        title="T"
        message="M"
        confirmLabel="OK"
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Pagination', () => {
  it('не показывается, если все элементы помещаются на одну страницу', () => {
    const { container } = render(
      <Pagination page={1} limit={10} total={5} onChange={() => undefined} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('блокирует «Назад» на первой странице и переключает страницы', async () => {
    const onChange = vi.fn();
    render(<Pagination page={1} limit={5} total={12} onChange={onChange} />);
    expect(screen.getByText('Страница 1 из 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Назад' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Вперёд' }));
    expect(onChange).toHaveBeenCalledWith(2);
  });

  it('блокирует «Вперёд» на последней странице', () => {
    render(<Pagination page={3} limit={5} total={12} onChange={() => undefined} />);
    expect(screen.getByRole('button', { name: 'Вперёд' })).toBeDisabled();
  });
});
