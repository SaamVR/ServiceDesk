import type { ReactNode } from "react";

export type DataTableAlign = "start" | "center" | "end";
export type DataTablePriority = "primary" | "secondary" | "optional";
export type DataTableSortDirection = "asc" | "desc";

export interface DataTableColumn<Row> {
  id: string;
  header: string;
  cell: (row: Row) => ReactNode;
  align?: DataTableAlign;
  priority?: DataTablePriority;
  sortable?: boolean;
  sortDirection?: DataTableSortDirection;
  sortHref?: string;
  width?: string;
}

export interface DataTableProps<Row> {
  caption: string;
  columns: readonly DataTableColumn<Row>[];
  rows: readonly Row[];
  getRowKey: (row: Row) => string;
  selectedRowKey?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  loading?: boolean;
  loadingRows?: number;
  renderMobileRow?: (row: Row) => ReactNode;
}

function SortHeader({
  label,
  sortable,
  direction,
  href,
}: {
  label: string;
  sortable?: boolean;
  direction?: DataTableSortDirection;
  href?: string;
}) {
  const ariaSort = direction === "asc" ? "ascending" : direction === "desc" ? "descending" : undefined;

  return (
    <span className="app-data-header-content" data-sortable={sortable || undefined}>
      {sortable && href ? (
        <a className="app-data-sort-link" href={href}>
          <span>{label}</span>
          <span className="app-data-sort-icon" aria-hidden="true">{direction === "asc" ? "↑" : direction === "desc" ? "↓" : "↕"}</span>
        </a>
      ) : (
        <span>{label}</span>
      )}
      {sortable && !href ? <span className="app-sr-only">Sortable column</span> : null}
      {ariaSort ? <span className="app-sr-only">Sorted {ariaSort}</span> : null}
    </span>
  );
}

export function DataTable<Row>({
  caption,
  columns,
  rows,
  getRowKey,
  selectedRowKey,
  emptyTitle = "No records found",
  emptyDescription = "There are no records to show for the current view.",
  loading = false,
  loadingRows = 5,
  renderMobileRow,
}: DataTableProps<Row>) {
  const skeletonRows = Array.from({ length: Math.max(1, loadingRows) }, (_, index) => index);

  return (
    <div className="app-data-table" aria-busy={loading || undefined}>
      <div className={renderMobileRow ? "app-data-table-desktop app-data-scroll" : "app-data-scroll"}>
        <table>
          <caption className="app-sr-only">{caption}</caption>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.id}
                  scope="col"
                  className={`app-data-align-${column.align ?? "start"} app-data-priority-${column.priority ?? "secondary"}`}
                  style={column.width ? { width: column.width } : undefined}
                  aria-sort={column.sortDirection === "asc" ? "ascending" : column.sortDirection === "desc" ? "descending" : undefined}
                >
                  <SortHeader
                    label={column.header}
                    sortable={column.sortable}
                    direction={column.sortDirection}
                    href={column.sortHref}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? skeletonRows.map((index) => (
              <tr key={`loading-${index}`} className="app-data-skeleton-row" aria-hidden="true">
                {columns.map((column) => (
                  <td key={column.id} className={`app-data-priority-${column.priority ?? "secondary"}`}>
                    <span className="app-skeleton app-skeleton-line" />
                  </td>
                ))}
              </tr>
            )) : rows.length ? rows.map((row) => {
              const rowKey = getRowKey(row);
              const selected = rowKey === selectedRowKey;
              return (
                <tr key={rowKey} className={selected ? "is-selected" : undefined} aria-selected={selected || undefined}>
                  {columns.map((column) => (
                    <td
                      key={column.id}
                      className={`app-data-align-${column.align ?? "start"} app-data-priority-${column.priority ?? "secondary"}`}
                      data-label={column.header}
                    >
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              );
            }) : (
              <tr>
                <td colSpan={columns.length} className="app-data-empty-cell">
                  <div className="app-data-empty">
                    <strong>{emptyTitle}</strong>
                    <span>{emptyDescription}</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {renderMobileRow ? (
        <div className="app-data-mobile" aria-label={caption}>
          {loading ? skeletonRows.slice(0, 3).map((index) => (
            <div className="app-data-mobile-card" key={`mobile-loading-${index}`} aria-hidden="true">
              <span className="app-skeleton app-skeleton-line" />
              <span className="app-skeleton app-skeleton-line app-skeleton-short" />
            </div>
          )) : rows.length ? rows.map((row) => {
            const rowKey = getRowKey(row);
            return (
              <article className={`app-data-mobile-card ${rowKey === selectedRowKey ? "is-selected" : ""}`.trim()} key={rowKey}>
                {renderMobileRow(row)}
              </article>
            );
          }) : (
            <div className="app-data-empty">
              <strong>{emptyTitle}</strong>
              <span>{emptyDescription}</span>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function DataCellStack({
  primary,
  secondary,
}: {
  primary: ReactNode;
  secondary?: ReactNode;
}) {
  return (
    <span className="app-data-cell-stack">
      <strong>{primary}</strong>
      {secondary ? <span>{secondary}</span> : null}
    </span>
  );
}

export function RowActions({ label = "Row actions", children }: { label?: string; children: ReactNode }) {
  return <div className="app-row-actions" aria-label={label}>{children}</div>;
}
