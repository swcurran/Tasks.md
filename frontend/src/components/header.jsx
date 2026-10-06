import { createMemo, createSignal, For, Show } from "solid-js";
import { IconEllipsisVertical } from "@stackoverflow/stacks-icons/icons";
import { clickOutside } from "../utils";

/**
 *
 * @param {Object} props
 * @param {string} props.sort
 * @param {string} props.search
 * @param {string} props.filteredTag
 * @param {string[]} props.tagOptions
 * @param {Function} props.onSearchChange
 * @param {Function} props.onTagChange
 * @param {Function} props.onNewLanBtnClick
 * @param {Function} props.viewMode
 * @param {Function} props.onViewModeChange
 * @param {boolean} props.selectionMode
 * @param {Function} props.onSelectionModeChange
 * @param {boolean} props.isDoneView
 * @param {boolean} props.urgentOnly
 * @param {number} props.urgentCount
 * @param {Function} props.onUrgentOnlyChange
 * @param {string} props.doneViewToggleHref
 * @param {Function} props.t
 * @param {string} props.locale
 * @param {Function} props.onLocaleChange
 */
export function Header(props) {
  const [showMoreMenu, setShowMoreMenu] = createSignal(false);

  const filterSelect = createMemo(() => {
    if (!props.tagOptions.length) {
      return null;
    }
    return (
      <>
        <div class="app-header__group-item-label">{props.t()('header.filterByTag')}:</div>
        <select
          onChange={props.onTagChange}
          value={props.filteredTag || "none"}
        >
          <option value="none">{props.t()('header.filterNone')}</option>
          <For each={props.tagOptions}>
            {(tag) => <option value={tag}>{tag}</option>}
          </For>
        </select>
      </>
    );
  });

  function handleNewLaneBtnClick() {
    setShowMoreMenu(false);
    props.onNewLaneBtnClick();
  }

  return (
    <header class="app-header">
      <input
        placeholder={props.t()('header.searchPlaceholder')}
        type="text"
        onInput={(e) => props.onSearchChange(e.target.value)}
        class="search-input"
      />
      <Show when={!props.isDoneView}>
        <button
          type="button"
          onClick={() => props.onUrgentOnlyChange(!props.urgentOnly)}
          class={props.urgentOnly ? "button--urgent" : ""}
          aria-pressed={props.urgentOnly}
          title={props.t()('header.urgentTitle')}
        >
          {props.t()('header.urgent', { count: props.urgentCount })}
        </button>
      </Show>
      <div class="app-header__group-item">
        {filterSelect()}
      </div>
      <Show when={!props.isDoneView}>
        <div class="app-header__group-item">
          <div class="app-header__group-item-label">{props.t()('header.sortBy')}:</div>
          <select onChange={props.onSortChange} value={props.sort}>
            <option value="none">{props.t()('header.sort.manually')}</option>
            <option value="name:asc">{props.t()('header.sort.nameAsc')}</option>
            <option value="name:desc">{props.t()('header.sort.nameDesc')}</option>
            <option value="tags:asc">{props.t()('header.sort.tagsAsc')}</option>
            <option value="tags:desc">{props.t()('header.sort.tagsDesc')}</option>
            <option value="due:asc">{props.t()('header.sort.dueAsc')}</option>
            <option value="due:desc">{props.t()('header.sort.dueDesc')}</option>
            <option value="lastUpdated:desc">{props.t()('header.sort.lastUpdated')}</option>
            <option value="createdFirst:asc">{props.t()('header.sort.createdFirst')}</option>
          </select>
        </div>
      </Show>
      <button
        type="button"
        onClick={() => props.onSelectionModeChange?.(!props.selectionMode)}
        class={props.selectionMode ? "button--active" : ""}
      >
        {props.selectionMode ? props.t()('header.exitSelection') : props.t()('header.selectCards')}
      </button>
      <button
        type="button"
        onClick={() => window.location.assign(props.doneViewToggleHref)}
      >
        {props.isDoneView ? props.t()('header.showActive') : props.t()('header.showDone')}
      </button>
      {/* Less used options */}
      <div
        class="app-header__more"
        use:clickOutside={() => setShowMoreMenu(false)}
        onKeyDown={(e) => e.key === "Escape" && setShowMoreMenu(false)}
      >
        <button
          type="button"
          class="app-header__more-btn"
          title={props.t()('header.moreOptions')}
          aria-expanded={showMoreMenu()}
          onClick={() => setShowMoreMenu(!showMoreMenu())}
        >
          <span innerHTML={IconEllipsisVertical} />
        </button>
        <Show when={showMoreMenu()}>
          <div class="app-header__more-menu">
            <Show when={!props.isDoneView}>
              <button
                type="button"
                onClick={handleNewLaneBtnClick}
                disabled={props.selectionMode}
              >
                {props.t()('header.newLane')}
              </button>
            </Show>
            <label class="app-header__more-menu-item">
              <span>{props.t()('header.viewMode')}</span>
              <select onChange={props.onViewModeChange} value={props.viewMode}>
                <option value="extended">{props.t()('header.view.extended')}</option>
                <option value="regular">{props.t()('header.view.regular')}</option>
                <option value="compact">{props.t()('header.view.compact')}</option>
                <option value="tight">{props.t()('header.view.tight')}</option>
              </select>
            </label>
            <label class="app-header__more-menu-item">
              <span>{props.t()('header.locale')}</span>
              <select onChange={props.onLocaleChange} value={props.locale}>
                <option value="en">English</option>
                <option value="es">Español</option>
              </select>
            </label>
          </div>
        </Show>
      </div>
    </header>
  );
}
