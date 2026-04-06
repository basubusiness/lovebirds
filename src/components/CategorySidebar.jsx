/**
 * CategorySidebar.jsx
 *
 * Left sidebar navigation showing category tree with item counts.
 * Used by Inventory and Patterns tabs.
 * Clicking a subcategory scrolls to it and highlights it.
 */

import styles from '../App.module.css';

export default function CategorySidebar({
  topLevel,
  childrenOf,
  itemsByCategory, // map of categoryId → count
  activeId,
  onSelect,
}) {
  const total = Object.values(itemsByCategory).reduce((a, b) => a + b, 0);

  return (
    <aside className={styles.sidebar}>
      {/* All items */}
      <div className={styles.sidebarSection}>
        <button
          className={`${styles.sidebarItem} ${!activeId ? styles.sidebarItemActive : ''}`}
          onClick={() => onSelect(null)}
        >
          <span>All items</span>
          <span className={styles.sidebarCount}>{total}</span>
        </button>
      </div>

      {topLevel.map(topCat => {
        const subs  = childrenOf(topCat.id);
        const topCount = subs.reduce((s, sub) => s + (itemsByCategory[sub.id] ?? 0), 0)
          + (itemsByCategory[topCat.id] ?? 0);
        if (topCount === 0) return null;

        return (
          <div key={topCat.id} className={styles.sidebarSection}>
            <div className={styles.sidebarTopCat}>
              <span className={styles.sidebarTopCatIcon}>{topCat.icon}</span>
              {topCat.name}
            </div>
            {subs.map(sub => {
              const count = itemsByCategory[sub.id] ?? 0;
              if (count === 0) return null;
              return (
                <button
                  key={sub.id}
                  className={`${styles.sidebarItem} ${activeId === sub.id ? styles.sidebarItemActive : ''}`}
                  onClick={() => onSelect(sub.id)}
                >
                  <span>{sub.icon} {sub.name}</span>
                  <span className={styles.sidebarCount}>{count}</span>
                </button>
              );
            })}
            {/* Items directly under top-level (no subcategory) */}
            {(itemsByCategory[topCat.id] ?? 0) > 0 && (
              <button
                className={`${styles.sidebarItem} ${activeId === topCat.id ? styles.sidebarItemActive : ''}`}
                onClick={() => onSelect(topCat.id)}
              >
                <span>Other {topCat.name}</span>
                <span className={styles.sidebarCount}>{itemsByCategory[topCat.id]}</span>
              </button>
            )}
          </div>
        );
      })}

      {/* Uncategorized */}
      {(itemsByCategory['uncategorized'] ?? 0) > 0 && (
        <div className={styles.sidebarSection}>
          <button
            className={`${styles.sidebarItem} ${activeId === 'uncategorized' ? styles.sidebarItemActive : ''}`}
            onClick={() => onSelect('uncategorized')}
          >
            <span>📦 Uncategorized</span>
            <span className={styles.sidebarCount}>{itemsByCategory['uncategorized']}</span>
          </button>
        </div>
      )}
    </aside>
  );
}
