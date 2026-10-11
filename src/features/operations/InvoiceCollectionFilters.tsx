import { invoiceQueueHref, invoiceQueueOptions, type InvoiceQueue } from "./invoice-collection-queue";
import styles from "./InvoiceCollectionFilters.module.css";
export function InvoiceCollectionFilters({queue,search,counts,visible}:{
  queue:InvoiceQueue; search:string; counts:Record<InvoiceQueue,number>;visible:number;
}) {
  return (
    <section className={styles.controls} aria-label="Invoice collection filters">
      <nav className={styles.tabs} aria-label="Invoice statuses">
        {invoiceQueueOptions.map(option => (
          <a href={invoiceQueueHref(option.key,search)} key={option.key}
            aria-current={queue===option.key?"page":undefined}>
            {option.label} <span aria-hidden="true">{counts[option.key]}</span>
          </a>
        ))}
      </nav>
      <form method="get" role="search" className={styles.searchForm}>
        {queue!=="all" ? <input type="hidden" name="queue" value={queue}/> : null}
        <label htmlFor="invoice-collection-search">Find invoice by customer, service or status</label>
        <div className={styles.searchRow}>
          <input type="search" id="invoice-collection-search" name="search"
            maxLength={100} defaultValue={search} placeholder="Search actual invoice records"/>
          <button type="submit">Search</button>
        </div>
        <div className={styles.results} aria-live="polite">
          <span>{visible} invoice{visible===1?"":"s"} in this view</span>
          {search ? <a href={invoiceQueueHref(queue,"")}>Clear search</a> : null}
        </div>
      </form>
    </section>
  );
}
