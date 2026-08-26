import styles from './shell.module.css';

export function PhoneFirstPlaceholder({ title }: { title: string }) {
  return (
    <section className={styles.placeholder}>
      <h1>{title}</h1>
      <p>This view is phone-first in the PWA until it is composed here.</p>
    </section>
  );
}
