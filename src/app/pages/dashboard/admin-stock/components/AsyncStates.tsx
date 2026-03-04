interface TableStateRowProps {
  colSpan: number;
  kind: 'loading' | 'error' | 'empty';
  message: string;
}

export function TableStateRow({ colSpan, kind, message }: TableStateRowProps) {
  const classNameByKind: Record<TableStateRowProps['kind'], string> = {
    loading: 'text-[var(--text-secondary)]',
    error: 'text-[var(--error-main)]',
    empty: 'text-[var(--text-secondary)]',
  };

  return (
    <tr>
      <td colSpan={colSpan} className={`text-center text-sm ${classNameByKind[kind]}`}>
        {message}
      </td>
    </tr>
  );
}

interface InlineStateMessageProps {
  kind: 'loading' | 'error' | 'empty';
  message: string;
}

export function InlineStateMessage({ kind, message }: InlineStateMessageProps) {
  const classNameByKind: Record<InlineStateMessageProps['kind'], string> = {
    loading: 'text-[var(--text-secondary)]',
    error: 'text-[var(--error-main)]',
    empty: 'text-[var(--text-secondary)]',
  };

  return <p className={`text-sm ${classNameByKind[kind]}`}>{message}</p>;
}
