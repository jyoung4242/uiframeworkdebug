// //uiCheckbox.ts

import {
  Color,
  Engine,
  ExcaliburGraphicsContext,
  GameEvent,
  Graphic,
  KeyEvent,
  Keys,
  PointerEvent,
  Sprite,
  vec,
  Vector,
} from "excalibur";
import { BaseUIConfig, InteractiveUIComponent } from "./uiComponent";

/**
 * Event map emitted by `UICheckbox`.
 * Each property corresponds to a specific event payload type.
 */
export type UICheckboxEvents = {
  UICheckboxChanged: UICheckboxChanged;
  UICheckboxFocused: UICheckboxFocused;
  UICheckboxUnfocused: UICheckboxUnfocused;
  UICheckboxUp: UICheckboxUp;
  UICheckboxDown: UICheckboxDown;
  UICheckboxEnabled: UICheckboxEnabled;
  UICheckboxDisabled: UICheckboxDisabled;
};

// #region Standard Checkbox

/**
 * Configuration options for `UICheckbox`.
 */
export type UICheckboxConfig = BaseUIConfig & {
  /** Whether the checkbox is initially checked. */
  checked?: boolean;
  /** Radius for rounded corners of the checkbox box. */
  borderRadius?: number;
  /** Visual style of the checkmark when checked. */
  checkmarkStyle?: "check" | "x" | "fill";
  /** Color configuration for the checkbox. */
  colors?: UICheckboxColors;
  /** Position (in pixels) of the focus indicator dot from the top-left. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation (-1 to opt-out). */
  tabStopIndex?: number;
};

/** Default configuration values for `UICheckbox`. */
const defaultCheckboxConfig: UICheckboxConfig = {
  name: "UICheckbox",
  width: 24,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  checked: false,
  borderRadius: 4,
  checkmarkStyle: "check",
  colors: {
    border: Color.fromHex("#999999"),
    background: Color.White,
    backgroundChecked: Color.fromHex("#4CAF50"),
    checkmark: Color.White,
    disabled: Color.Gray,
  },
  focusIndicator: vec(5, 5),
  tabStopIndex: -1,
};

/**
 * Color configuration for `UICheckbox`.
 */
type UICheckboxColors = {
  /** Border color. */
  border?: Color;
  /** Background color when unchecked. */
  background?: Color;
  /** Background color when checked. */
  backgroundChecked?: Color;
  /** Checkmark color. */
  checkmark?: Color;
  /** Color when disabled. */
  disabled?: Color;
};

/**
 * A clickable checkbox UI component with hover, focus and keyboard support.
 *
 * Emits events defined in `UICheckboxEvents` and can be navigated with keyboard (Space/Enter).
 */
export class UICheckbox extends InteractiveUIComponent<UICheckboxConfig, UICheckboxEvents> {
  /** Whether the checkbox is currently checked. */
  private _checked: boolean;

  /**
   * Create a new UICheckbox.
   * @param checkboxConfig - Partial configuration for the checkbox. Missing values will be filled from defaults.
   */
  constructor(checkboxConfig: UICheckboxConfig) {
    const localConfig = { ...defaultCheckboxConfig, ...checkboxConfig };
    super(localConfig);
    this._config = localConfig;
    this._checked = localConfig.checked ?? false;
    this.graphics.use(new UICheckboxGraphic(this, vec(localConfig.width, localConfig.height), this._config));
    this.pointer.useGraphicsBounds = true;
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
  }

  /**
   * Called when the component is added to the engine. Registers input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerup", this.onClick);
    this.on("pointerdown", this.onPointerDown);
    engine.input.keyboard.on("press", this.onKeyDown);
  }

  /**
   * Called when the component is removed from the engine. Unregisters input handlers.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerup", this.onClick);
    this.off("pointerdown", this.onPointerDown);
    engine.input.keyboard.off("press", this.onKeyDown);
  }

  /**
   * Keyboard 'press' handler. When focused and Space/Enter is pressed,
   * toggles the checkbox state.
   * @param ekey - The keyboard event payload.
   */
  onKeyDown = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.toggle();
  };

  /**
   * Pointer down handler. Emits `UICheckboxDown` event.
   * @param evt - Pointer event payload.
   */
  onPointerDown = (evt: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UICheckboxDown", { name: this.name, target: this, event: evt });
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer up / click handler. Emits `UICheckboxUp` and toggles the checkbox state.
   * @param evt - Pointer event payload.
   */
  onClick = (evt: PointerEvent) => {
    if (!this.isEnabled) return;
    this.emitter.emit("UICheckboxUp", { name: this.name, target: this, event: evt });
    this.toggle();
  };

  /**
   * Toggle the checked state of the checkbox and emit `UICheckboxChanged`.
   */
  toggle(): void {
    this.checked = !this._checked;
  }

  /**
   * Get the checked state of the checkbox.
   */
  get checked(): boolean {
    return this._checked;
  }

  /**
   * Set the checked state of the checkbox and emit `UICheckboxChanged` if changed.
   */
  set checked(value: boolean) {
    if (value !== this._checked) {
      this._checked = value;
      this.emitter.emit("UICheckboxChanged", { name: this.name, target: this, checked: this._checked });
    }
  }

  /** Give the checkbox keyboard focus and emit `UICheckboxFocused`. */
  focus() {
    if (!this.isEnabled) return;
    this._isFocused = true;
    this.emitter.emit("UICheckboxFocused", { name: this.name, target: this, event: "focused" });
  }

  /** Remove keyboard focus from the checkbox. */
  loseFocus() {
    if (!this.isEnabled) return;
    this._isFocused = false;
    this.emitter.emit("UICheckboxUnfocused", { name: this.name, target: this, event: "unfocused" });
  }

  /** Whether the checkbox currently has keyboard focus. */
  get isFocused() {
    return this._isFocused;
  }

  /**
   * The event emitter for the checkbox. Listeners can be added to this
   * emitter to receive events emitted by the checkbox.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /** Emits `UICheckboxEnabled` when enabled. */
  protected onEnabled(): void {
    this.emitter.emit("UICheckboxEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /** Emits `UICheckboxDisabled` when disabled and removes focus. */
  protected onDisabled(): void {
    this._isFocused = false;
    this.emitter.emit("UICheckboxDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Sets the enabled state of the checkbox.
   * @param value
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
  }
}

/**
 * Graphic implementation for rendering a `UICheckbox` to a canvas.
 * Handles drawing the checkbox box, checkmark, and focus indicator.
 */
class UICheckboxGraphic extends Graphic {
  private size: Vector;
  private config: UICheckboxConfig;
  private owner: UICheckbox;
  private focusPosition: Vector = new Vector(0, 0);
  private colors: UICheckboxColors;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the checkbox graphic.
   * @param owner - The owning `UICheckbox` instance.
   * @param size - Size of the checkbox (width,height) for rendering.
   * @param checkboxConfig - Checkbox configuration for styling and layout.
   */
  constructor(owner: UICheckbox, size: Vector, checkboxConfig: UICheckboxConfig) {
    const padding = 4;
    super({ width: size.x + padding * 2, height: size.y + padding * 2 });
    this.owner = owner;
    this.size = size;
    this.config = checkboxConfig;
    this.cnv = document.createElement("canvas");
    this.cnv.width = size.x + padding * 2;
    this.cnv.height = size.y + padding * 2;
    this.ctx = this.cnv.getContext("2d");
    this.focusPosition = checkboxConfig.focusIndicator ?? this.focusPosition;
    if (!this.ctx) return;
    this.colors = {
      border: Color.fromHex("#999999"),
      background: Color.White,
      backgroundChecked: Color.fromHex("#4CAF50"),
      checkmark: Color.White,
      disabled: Color.Gray,
      ...checkboxConfig.colors,
    };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UICheckboxGraphic {
    return new UICheckboxGraphic(this.owner, this.size, this.config);
  }

  /**
   * Render the checkbox to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const padding = 4;

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.cnv.width, this.cnv.height);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    const isChecked = this.owner.checked;
    const isEnabled = this.owner.isEnabled;
    const isFocused = this.owner.isFocused;

    // Apply grayscale filter when disabled
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    }

    const borderRadius = this.config.borderRadius ?? 4;

    // ---- BACKGROUND ----
    ctx.beginPath();
    ctx.fillStyle = (isChecked ? this.colors.backgroundChecked : this.colors.background).toString();
    ctx.strokeStyle = this.colors.border.toString();
    ctx.lineWidth = 2;
    ctx.roundRect(0, 0, this.size.x, this.size.y, borderRadius);
    ctx.fill();
    ctx.stroke();

    // ---- CHECKMARK ----
    if (isChecked) {
      const checkmarkStyle = this.config.checkmarkStyle ?? "check";
      ctx.strokeStyle = this.colors.checkmark.toString();
      ctx.fillStyle = this.colors.checkmark.toString();
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";

      if (checkmarkStyle === "check") {
        // Draw checkmark
        const centerX = this.size.x / 2;
        const centerY = this.size.y / 2;
        const size = Math.min(this.size.x, this.size.y) * 0.5;

        ctx.beginPath();
        ctx.moveTo(centerX - size * 0.4, centerY);
        ctx.lineTo(centerX - size * 0.1, centerY + size * 0.4);
        ctx.lineTo(centerX + size * 0.5, centerY - size * 0.3);
        ctx.stroke();
      } else if (checkmarkStyle === "x") {
        // Draw X
        const centerX = this.size.x / 2;
        const centerY = this.size.y / 2;
        const size = Math.min(this.size.x, this.size.y) * 0.35;

        ctx.beginPath();
        ctx.moveTo(centerX - size, centerY - size);
        ctx.lineTo(centerX + size, centerY + size);
        ctx.moveTo(centerX + size, centerY - size);
        ctx.lineTo(centerX - size, centerY + size);
        ctx.stroke();
      } else if (checkmarkStyle === "fill") {
        // Draw a smaller inner square for visual interest
        const margin = 6;
        ctx.beginPath();
        ctx.fillStyle = this.colors.checkmark.toString();
        ctx.roundRect(margin, margin, this.size.x - margin * 2, this.size.y - margin * 2, borderRadius - 2);
        ctx.fill();
      }
    }

    // ---- FOCUS INDICATOR ----
    if (isFocused && isEnabled) {
      ctx.beginPath();
      ctx.fillStyle = "#000000";
      ctx.arc(this.focusPosition.x, this.focusPosition.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x - padding, y - padding);
  }
}
// #endregion Standard Checkbox

// #region Sprite Checkbox
/**
 * Configuration for a sprite-based `UISpriteCheckbox`.
 */
export type UISpriteCheckboxConfig = BaseUIConfig & {
  /** Whether the checkbox is initially checked. */
  checked?: boolean;
  /** Sprites for checked and unchecked states. */
  sprites?: {
    unchecked?: Sprite;
    checked?: Sprite;
  };
  /** Position for focus indicator dot. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation. */
  tabStopIndex?: number;
};

/** Default configuration values for `UISpriteCheckbox`. */
const defaultSpriteCheckboxConfig: UISpriteCheckboxConfig = {
  name: "UISpriteCheckbox",
  width: 24,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  checked: false,
  sprites: {
    unchecked: null,
    checked: null,
  },
  focusIndicator: vec(5, 5),
  tabStopIndex: -1,
};

/**
 * A sprite-based checkbox that supports hover/focus/keyboard interactions.
 * Behaves similarly to `UICheckbox` but renders provided sprites per state.
 */
export class UISpriteCheckbox extends InteractiveUIComponent<UISpriteCheckboxConfig, UICheckboxEvents> {
  public checkedSprite: Sprite | null = null;
  public uncheckedSprite: Sprite | null = null;

  /** Whether the checkbox is currently checked. */
  private _checked: boolean;
  /** Focus flag. */
  _isFocused = false;

  /**
   * Create a new UISpriteCheckbox.
   * @param checkboxConfig - Partial config; defaults will be applied.
   */
  constructor(checkboxConfig: UISpriteCheckboxConfig) {
    const localConfig = { ...defaultSpriteCheckboxConfig, ...checkboxConfig };
    super(localConfig);
    this._config = localConfig;
    this._checked = localConfig.checked ?? false;
    this.graphics.use(new UISpriteCheckboxGraphic(this, vec(localConfig.width, localConfig.height), this._config));
    this.checkedSprite = localConfig.sprites?.checked ?? null;
    this.uncheckedSprite = localConfig.sprites?.unchecked ?? null;
    this.pointer.useGraphicsBounds = true;
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
  }

  /**
   * Called when the component is added to the engine. Registers input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerup", this.onClick);
    this.on("pointerdown", this.onPointerDown);
    engine.input.keyboard.on("press", this.onKeyDown);
  }

  /**
   * Called when the component is removed from the engine. Unregisters input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerup", this.onClick);
    this.off("pointerdown", this.onPointerDown);
    engine.input.keyboard.off("press", this.onKeyDown);
  }

  /**
   * Keyboard 'press' handler. When focused and Space/Enter is pressed,
   * toggles the checkbox state.
   * @param ekey - The keyboard event payload.
   */
  onKeyDown = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.toggle();
  };

  /**
   * Pointer down handler for sprite checkbox. Emits `UICheckboxDown` event.
   * @param evt - Pointer event payload.
   */
  onPointerDown = (evt: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.emitter.emit("UICheckboxDown", { name: this.name, target: this, event: evt });
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer up / click handler for sprite checkbox. Emits `UICheckboxUp` and toggles the checkbox.
   * @param evt - Pointer event payload.
   */
  onClick = (evt: PointerEvent) => {
    if (!this.isEnabled) return;
    this.emitter.emit("UICheckboxUp", { name: this.name, target: this, event: evt });
    this.toggle();
  };

  /**
   * Toggle the checked state of the checkbox and emit `UICheckboxChanged`.
   */
  toggle(): void {
    this.checked = !this._checked;
  }

  /**
   * Get the checked state of the checkbox.
   */
  get checked(): boolean {
    return this._checked;
  }

  /**
   * Set the checked state of the checkbox and emit `UICheckboxChanged` if changed.
   */
  set checked(value: boolean) {
    if (value !== this._checked) {
      this._checked = value;
      this.emitter.emit("UICheckboxChanged", { name: this.name, target: this, checked: this._checked });
    }
  }

  /** Give the checkbox keyboard focus and emit `UICheckboxFocused`. */
  focus() {
    if (!this.isEnabled) return;
    this._isFocused = true;
    this.emitter.emit("UICheckboxFocused", { name: this.name, target: this, event: "focused" });
  }

  /** Remove keyboard focus and emit `UICheckboxUnfocused`. */
  loseFocus() {
    if (!this.isEnabled) return;
    this._isFocused = false;
    this.emitter.emit("UICheckboxUnfocused", { name: this.name, target: this, event: "unfocused" });
  }

  /** Keyboard focus flag getter. */
  get isFocused() {
    return this._isFocused;
  }

  /**
   * Event emitter getter.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /**
   * Hook called when component is enabled. Emits `UICheckboxEnabled` event.
   */
  protected onEnabled(): void {
    this.emitter.emit("UICheckboxEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Hook called when component is disabled. Emits `UICheckboxDisabled` event.
   */
  protected onDisabled(): void {
    this._isFocused = false;
    this.emitter.emit("UICheckboxDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Set the enabled state of the checkbox.
   * @param value - The new enabled state of the checkbox.
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
  }
}

/**
 * Graphic implementation for rendering a `UISpriteCheckbox` using provided sprites.
 * Draws sprite frames and focus indicator onto a canvas.
 */
class UISpriteCheckboxGraphic extends Graphic {
  private size: Vector;
  private config: UISpriteCheckboxConfig;
  private owner: UISpriteCheckbox;
  private focusPosition: Vector = new Vector(0, 0);

  sprites: {
    unchecked: Sprite | null;
    checked: Sprite | null;
  };
  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the sprite checkbox graphic.
   * @param owner - Owning `UISpriteCheckbox`.
   * @param size - Size to render the sprites at.
   * @param checkboxConfig - Sprite checkbox configuration.
   */
  constructor(owner: UISpriteCheckbox, size: Vector, checkboxConfig: UISpriteCheckboxConfig) {
    const padding = 4;
    super({ width: size.x + padding * 2, height: size.y + padding * 2 });
    this.owner = owner;
    this.size = size;
    this.config = checkboxConfig;
    this.cnv = document.createElement("canvas");
    this.cnv.width = size.x + padding * 2;
    this.cnv.height = size.y + padding * 2;
    this.ctx = this.cnv.getContext("2d");
    this.focusPosition = checkboxConfig.focusIndicator ?? this.focusPosition;
    if (!this.ctx) return;
    this.sprites = {
      unchecked: checkboxConfig.sprites?.unchecked ?? null,
      checked: checkboxConfig.sprites?.checked ?? null,
    };
  }

  /** Create a deep clone of this sprite graphic (used by Excalibur). */
  clone(): UISpriteCheckboxGraphic {
    return new UISpriteCheckboxGraphic(this.owner, this.size, this.config);
  }

  /**
   * Render the sprite checkbox to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const padding = 4;

    ctx.clearRect(0, 0, this.size.x + padding * 2, this.size.y + padding * 2);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    const isChecked = this.owner.checked;
    const isEnabled = this.owner.isEnabled;
    const isFocused = this.owner.isFocused;

    // Apply grayscale filter when disabled
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    // ---- CHECKBOX SPRITE ----
    const sprite = isChecked ? this.sprites.checked : this.sprites.unchecked;
    if (sprite) {
      ctx.drawImage(sprite.image.image, 0, 0, this.size.x, this.size.y);
    } else {
      // Fallback if no sprite provided
      ctx.fillStyle = "#464646";
      ctx.strokeStyle = "#464646";
      ctx.rect(0, 0, this.size.x, this.size.y);
      ctx.stroke();
    }

    // ---- FOCUS INDICATOR ----
    if (isFocused && isEnabled) {
      ctx.beginPath();
      ctx.fillStyle = "#000000";
      ctx.arc(this.focusPosition.x, this.focusPosition.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.restore();
    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x - padding, y - padding);
  }
}
// #endregion Sprite Checkbox

// #region Events

/** Event emitted when a checkbox's checked state changes. */
export class UICheckboxChanged extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(
    public target: UICheckbox | UISpriteCheckbox,
    public checked: boolean,
  ) {
    super();
  }
}

/** Event emitted when a checkbox gains keyboard focus. */
export class UICheckboxFocused extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

/** Event emitted when a checkbox loses keyboard focus. */
export class UICheckboxUnfocused extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

/** Event emitted when a checkbox is enabled. */
export class UICheckboxEnabled extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

/** Event emitted when a checkbox is disabled. */
export class UICheckboxDisabled extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

/** Event emitted when a checkbox is pressed down (pointer). */
export class UICheckboxDown extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

/** Event emitted when a checkbox is released (pointer up). */
export class UICheckboxUp extends GameEvent<UICheckbox | UISpriteCheckbox> {
  constructor(public target: UICheckbox | UISpriteCheckbox) {
    super();
  }
}

// #endregion Events
