import styles from "./RecordDirectorySearch.module.css";
import { normalizeDirectoryQuery } from "./record-directory";

export function RecordDirectorySearch({
  label,
  search,
  visible,
  total,
}: {
  label: string;
  search?: string;
  visible: number;
  total: number;
}) {
  const query = normalizeDirectoryQuery(search);
  return (
    <form className={styles.searchForm} role="search" aria-label={"Search " + label} method="get">
      <div className={styles.searchField}>
        <label htmlFor="record-directory-search">Search {label}</label>
        <input
          id="record-directory-search"
          name="search"
          type="search"
          autoComplete="off"
          defaultValue={query}
          maxLength={100}
          placeholder={"Find by name, service or status"}
        />
      </div>
      <button type="submit">Find records</button>
      {query ? <a href="?">Clear</a> : null}
      <p className={styles.resultCount} aria-live="polite">
        {query ? visible + " of " + total + " records" : total + " records"}
      </p>
    </form>
  );
}
