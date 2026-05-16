import { EventEmitter, GameEvent } from "excalibur";
import { UICheckbox, UICheckboxChanged, UISpriteCheckbox } from "./uiCheckbox";

/**
 * Configuration options for `UIRadioGroup`.
 */
export type UIRadioGroupConfig = {
  /** Name identifier for the radio group. */
  name?: string;
  /** If true, clicking the selected item deselects it (default: false). */
  allowDeselect?: boolean;
  /** Initial selected index (-1 for none selected). */
  selectedIndex?: number;
};

/**
 * Event map emitted by `UIRadioGroup`.
 */
export type UIRadioGroupEvents = {
  UIRadioGroupChanged: UIRadioGroupChanged;
};

/**
 * A utility class for managing a group of checkboxes as radio buttons.
 *
 * Ensures only one checkbox in the group can be selected at a time.
 * Automatically handles checkbox state synchronization and emits events
 * when the selection changes.
 *
 * @example
 * ```typescript
 * const radioGroup = new UIRadioGroup({ name: "difficulty", selectedIndex: 0 });
 * radioGroup.add(easyCheckbox);
 * radioGroup.add(mediumCheckbox);
 * radioGroup.add(hardCheckbox);
 *
 * radioGroup.emitter.on("UIRadioGroupChanged", (evt) => {
 *   console.log("Selected:", evt.selectedIndex);
 * });
 * ```
 */
export class UIRadioGroup {
  /** Name identifier for this radio group. */
  public name: string;
  /** List of checkboxes managed by this group. */
  private checkboxes: (UICheckbox | UISpriteCheckbox)[] = [];
  /** Whether deselecting the currently selected item is allowed. */
  private allowDeselect: boolean;
  /** Index of the currently selected checkbox (-1 if none). */
  private _selectedIndex: number = -1;
  /** Event emitter for radio group events. */
  public emitter = new EventEmitter<UIRadioGroupEvents>();

  /**
   * Create a new UIRadioGroup.
   * @param config - Configuration options for the radio group.
   */
  constructor(config: UIRadioGroupConfig = {}) {
    this.name = config.name ?? "UIRadioGroup";
    this.allowDeselect = config.allowDeselect ?? false;
    this._selectedIndex = config.selectedIndex ?? -1;
  }

  /**
   * Add a checkbox to the radio group.
   * The checkbox will be managed as part of the radio button set.
   * @param checkbox - The checkbox to add to the group.
   */
  add(checkbox: UICheckbox | UISpriteCheckbox): void {
    if (this.checkboxes.indexOf(checkbox) !== -1) {
      return; // Already added
    }

    this.checkboxes.push(checkbox);

    // Listen to checkbox changes
    checkbox.emitter.on("UICheckboxChanged", (event: UICheckboxChanged) => {
      this.handleCheckboxChanged(checkbox, event.checked);
    });

    // Set initial state
    const index = this.checkboxes.length - 1;
    if (index === this._selectedIndex) {
      checkbox.checked = true;
    } else if (checkbox.checked) {
      // If this checkbox is checked but not the selected one, select it
      this.select(index);
    } else {
      checkbox.checked = false;
    }
  }

  /**
   * Remove a checkbox from the radio group.
   * @param checkbox - The checkbox to remove from the group.
   */
  remove(checkbox: UICheckbox | UISpriteCheckbox): void {
    const index = this.checkboxes.indexOf(checkbox);
    if (index === -1) {
      return; // Not in group
    }

    this.checkboxes.splice(index, 1);

    // Adjust selected index if necessary
    if (this._selectedIndex === index) {
      this._selectedIndex = -1;
    } else if (this._selectedIndex > index) {
      this._selectedIndex--;
    }
  }

  /**
   * Handle when a checkbox in the group changes state.
   * Ensures only one checkbox is selected at a time.
   * @param checkbox - The checkbox that changed.
   * @param checked - The new checked state.
   */
  private handleCheckboxChanged(checkbox: UICheckbox | UISpriteCheckbox, checked: boolean): void {
    const index = this.checkboxes.indexOf(checkbox);
    if (index === -1) {
      return; // Not in group
    }

    if (checked) {
      // Select this checkbox
      this.select(index);
    } else {
      // Deselecting
      if (this.allowDeselect && index === this._selectedIndex) {
        this.deselect();
      } else {
        // Don't allow deselection, recheck it
        checkbox.checked = true;
      }
    }
  }

  /**
   * Select a checkbox by index.
   * Deselects any previously selected checkbox.
   * @param index - The index of the checkbox to select.
   */
  select(index: number): void {
    if (index < 0 || index >= this.checkboxes.length) {
      return;
    }

    if (this._selectedIndex === index) {
      return; // Already selected
    }

    const previousIndex = this._selectedIndex;

    // Deselect previous
    if (this._selectedIndex >= 0 && this._selectedIndex < this.checkboxes.length) {
      this.checkboxes[this._selectedIndex].checked = false;
    }

    // Select new
    this._selectedIndex = index;
    this.checkboxes[index].checked = true;

    // Emit change event
    this.emitter.emit("UIRadioGroupChanged", {
      name: this.name,
      target: this,
      event: "changed",
      selectedIndex: this._selectedIndex,
      selectedCheckbox: this.checkboxes[this._selectedIndex],
      previousIndex: previousIndex,
    });
  }

  /**
   * Deselect all checkboxes.
   * Only works if `allowDeselect` is true.
   */
  deselect(): void {
    if (!this.allowDeselect) {
      return;
    }

    if (this._selectedIndex === -1) {
      return; // Already deselected
    }

    const previousIndex = this._selectedIndex;

    // Deselect current
    if (this._selectedIndex >= 0 && this._selectedIndex < this.checkboxes.length) {
      this.checkboxes[this._selectedIndex].checked = false;
    }

    this._selectedIndex = -1;

    // Emit change event
    this.emitter.emit("UIRadioGroupChanged", {
      name: this.name,
      target: this,
      event: "changed",
      selectedIndex: -1,
      selectedCheckbox: null,
      previousIndex: previousIndex,
    });
  }

  /**
   * Get the currently selected index.
   * @returns The index of the selected checkbox, or -1 if none selected.
   */
  get selectedIndex(): number {
    return this._selectedIndex;
  }

  /**
   * Get the currently selected checkbox.
   * @returns The selected checkbox, or null if none selected.
   */
  get selectedCheckbox(): UICheckbox | UISpriteCheckbox | null {
    if (this._selectedIndex >= 0 && this._selectedIndex < this.checkboxes.length) {
      return this.checkboxes[this._selectedIndex];
    }
    return null;
  }

  /**
   * Get all checkboxes in the group.
   * @returns A copy of the checkboxes array.
   */
  get items(): (UICheckbox | UISpriteCheckbox)[] {
    return [...this.checkboxes];
  }

  /**
   * Get the number of checkboxes in the group.
   * @returns The total count of checkboxes.
   */
  get count(): number {
    return this.checkboxes.length;
  }

  /**
   * Clear all checkboxes from the group.
   * Resets the selected index to -1.
   */
  clear(): void {
    this.checkboxes = [];
    this._selectedIndex = -1;
  }

  /**
   * Enable or disable all checkboxes in the group.
   * @param enabled - Whether to enable (true) or disable (false) all checkboxes.
   */
  setEnabled(enabled: boolean): void {
    for (const checkbox of this.checkboxes) {
      checkbox.setEnabled(enabled);
    }
  }

  /**
   * Get a checkbox by its index in the group.
   * @param index - The index of the checkbox to retrieve.
   * @returns The checkbox at the specified index, or null if out of bounds.
   */
  getCheckbox(index: number): UICheckbox | UISpriteCheckbox | null {
    if (index >= 0 && index < this.checkboxes.length) {
      return this.checkboxes[index];
    }
    return null;
  }

  /**
   * Get the event emitter for this radio group.
   * @returns The event emitter.
   */
  get eventEmitter(): EventEmitter<UIRadioGroupEvents> {
    return this.emitter;
  }
}

// #region Events

/**
 * Event emitted when the radio group selection changes.
 */
export class UIRadioGroupChanged extends GameEvent<UIRadioGroup> {
  constructor(
    public target: UIRadioGroup,
    public selectedIndex: number,
    public selectedCheckbox: UICheckbox | UISpriteCheckbox | null,
    public previousIndex: number,
  ) {
    super();
  }
}

// #endregion Events
