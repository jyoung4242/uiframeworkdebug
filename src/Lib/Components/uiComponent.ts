//uiComponent.ts
import { Engine, EventEmitter, ScreenElement, Vector, PointerEvent } from "excalibur";
import { UIFocusManager } from "./uiFocusManager";

// ============================================================================
// Base Configuration (shared by all UI components)
// ============================================================================

export type BaseUIConfig = {
  name: string;
  width: number;
  height: number;
  pos: Vector;
  z?: number;
};

// ============================================================================
// Base UI Component (provides common functionality)
// ============================================================================

export abstract class UIComponent<
  TConfig extends BaseUIConfig = BaseUIConfig,
  TEvents extends Record<string, any> = {},
> extends ScreenElement {
  protected _config: TConfig;
  protected _enabled: boolean = true;
  protected _visible: boolean = true;
  public emitter: EventEmitter<TEvents>;

  constructor(config: TConfig) {
    super({
      name: config.name,
      width: config.width,
      height: config.height,
      pos: config.pos,
      z: config.z,
    });
    this._config = config;
    this.emitter = new EventEmitter<TEvents>();
  }

  // ============================================================================
  // Lifecycle hooks (components MUST implement these)
  // ============================================================================

  abstract onAdd(engine: Engine): void;
  abstract onRemove(engine: Engine): void;

  // ============================================================================
  // Visibility (default implementation, can be overridden)
  // ============================================================================

  show(): void {
    if (!this._visible) {
      this._visible = true;
      this.graphics.visible = true;
      this.onShow();
    }
  }

  hide(): void {
    if (this._visible) {
      this._visible = false;
      this.graphics.visible = false;
      this.onHide();
    }
  }

  toggle(): void {
    if (this._visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  get isVisible(): boolean {
    return this._visible;
  }

  /**
   * Hook called when component is shown.
   * Override to emit events or perform custom logic.
   */
  protected onShow(): void {
    // Default: do nothing
  }

  /**
   * Hook called when component is hidden.
   * Override to emit events or perform custom logic.
   */
  protected onHide(): void {
    // Default: do nothing
  }

  // ============================================================================
  // Enabled state (default implementation, can be overridden)
  // ============================================================================

  setEnabled(value: boolean): void {
    if (value !== this._enabled) {
      this._enabled = value;
      if (value) {
        this.onEnabled();
      } else {
        this.onDisabled();
      }
    }
  }

  get isEnabled(): boolean {
    return this._enabled;
  }

  /**
   * Hook called when component is enabled.
   * Override to emit events or perform custom logic.
   */
  protected onEnabled(): void {
    // Default: do nothing
  }

  /**
   * Hook called when component is disabled.
   * Override to emit events or perform custom logic.
   */
  protected onDisabled(): void {
    // Default: do nothing
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get eventEmitter(): EventEmitter<TEvents> {
    return this.emitter;
  }

  get config(): Readonly<TConfig> {
    return this._config;
  }
}

// ============================================================================
// Interfaces for Optional Capabilities
// ============================================================================

/**
 * Components that can receive keyboard focus
 */
export interface IFocusable {
  _isFocused: boolean;
  focus(): void;
  loseFocus(): void;
  tabStopIndex: number;
  get isFocused(): boolean;
  customFocus?(ctx: CanvasRenderingContext2D, width: number, height: number): void;
  manager: UIFocusManager | undefined;
  setManager(manager: UIFocusManager): void;
}

/**
 * Components that can be clicked/interacted with
 */
export interface IClickable {
  onPointerDown(event: PointerEvent): void;
  onClick(event: PointerEvent): void;
}

/**
 * Components that respond to hover
 */
export interface IHoverable {
  _isHovered: boolean;
  onHover(event: PointerEvent): void;
  onUnhover(event: PointerEvent): void;
  get isHovered(): boolean;
}

/**
 * Components that support tab navigation
 */
export interface ITabNavigable extends IFocusable {
  tabStopIndex: number;
}

// ============================================================================
// Specialized Base Classes
// ============================================================================

/**
 * Base class for interactive components (buttons, checkboxes, etc.)
 */
export abstract class InteractiveUIComponent<TConfig extends BaseUIConfig = BaseUIConfig, TEvents extends Record<string, any> = {}>
  extends UIComponent<TConfig, TEvents>
  implements IFocusable
{
  _isFocused: boolean = false;
  tabStopIndex: number;
  manager: UIFocusManager | undefined;

  focus(): void {
    if (!this._enabled) return;
    if (!this._isFocused) {
      this._isFocused = true;
      this.onFocus();
    }
  }

  loseFocus(): void {
    if (!this._enabled) return;
    if (this._isFocused) {
      this._isFocused = false;
      this.onBlur();
    }
  }

  setManager(manager: UIFocusManager): void {
    this.manager = manager;
  }

  get isFocused(): boolean {
    return this._isFocused;
  }

  /**
   * Hook called when component gains focus.
   * Override to emit events or perform custom logic.
   */
  protected onFocus(): void {
    // Default: do nothing
  }

  /**
   * Hook called when component loses focus.
   * Override to emit events or perform custom logic.
   */
  protected onBlur(): void {
    // Default: do nothing
  }

  // Override setEnabled to also clear focus
  setEnabled(value: boolean): void {
    if (value !== this._enabled) {
      if (!value && this._isFocused) {
        this.loseFocus();
      }
      super.setEnabled(value);
    }
  }
}

/**
 * Base class for display-only components (images, labels without interaction)
 */
export abstract class DisplayUIComponent<
  TConfig extends BaseUIConfig = BaseUIConfig,
  TEvents extends Record<string, any> = {},
> extends UIComponent<TConfig, TEvents> {
  // Display components use the base functionality
  // No additional features needed
}
