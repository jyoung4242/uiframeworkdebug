//uiButton.ts
import {
  Color,
  Engine,
  EventEmitter,
  ExcaliburGraphicsContext,
  Font,
  GameEvent,
  Graphic,
  KeyEvent,
  Keys,
  PointerEvent,
  ScreenElement,
  Sprite,
  TextOptions,
  vec,
  Vector,
} from "excalibur";
import { drawText } from "canvas-txt";
import { BaseUIConfig, IClickable, IFocusable, IHoverable, InteractiveUIComponent } from "./uiComponent";
import { UIFocusManager } from "./uiFocusManager";

/**
 * Delay (in milliseconds) used to ignore spurious pointer leave events immediately
 * after pointer up. This allows click handling to complete without immediately unhovering.
 */
const POINTER_LEAVE_DELAY_MS = 50;
/**
 * The visual/interactable state of the `UIButton`.
 *
 * - "idle": default state
 * - "hovered": mouse/pointer is over the button
 * - "pressed": being pressed (pointerdown or key)
 * - "disabled": not interactive
 */
export type UIButtonState = "idle" | "hovered" | "pressed" | "disabled";
/**
 * Event map emitted by `UIButton`.
 * Each property corresponds to a specific event payload type.
 */
export type UIButtonEvents = {
  UIButtonClicked: UIButtonClicked;
  UIButtonDown: UIButtonDown;
  UIButtonUp: UIButtonUp;
  UIButtonHovered: UIButtonHovered;
  UIButtonUnhovered: UIButtonUnhovered;
  UIButtonDisabled: UIButtonDisabled;
  UIButtonEnabled: UIButtonEnabled;
  UIButtonFocused: UIButtonFocused;
  UIButtonUnfocused: UIButtonUnfocused;
};

// #region Standard Button

/**
 * Configuration options for `UIButton`.
 */
export type UIButtonConfig = BaseUIConfig & {
  /** Callback invoked when the button is clicked. */
  callback?: () => void;
  /** Radius of the rounded corners of the button (pixels). */
  buttonRadius?: number;
  /** Text to display when idle. */
  idleText?: string;
  /** Text to display when active/pressed. */
  activeText?: string;
  /** Text to display when hovered. */
  hoveredText?: string;
  /** Text to display when disabled. */
  disabledText?: string;
  /** Text drawing options (font, color, etc.). `text` will be provided per state. */
  textOptions?: Omit<TextOptions, "text">;
  /** Color gradients used to render the button. */
  colors?: UIButtonColors;
  /** Depth in pixels the top face sinks when pressed. */
  pressDepth?: number;
  /** Extra offset used to render the bottom layer (shadow/depth). */
  buttonDepthOffset?: number;
  /** Position (in pixels) of the focus indicator dot from the top-left of the button. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation (-1 to opt-out). */
  tabStopIndex?: number;
  /** Keyboard key to activate the button. */
  customFocus?(ctx: CanvasRenderingContext2D, width: number, height: number): void;
};

/** Default configuration values for `UIButton`. */
const defaultButtonConfig: UIButtonConfig = {
  name: "UIButton",
  width: 100,
  height: 50,
  pos: vec(0, 0),
  z: 1,
  callback: () => {
    console.log("clicked");
  },
  colors: {
    mainStarting: Color.LightGray,
    bottomStarting: Color.DarkGray,
    hoverStarting: Color.LightGray,
    disabledStarting: Color.Gray,
  },
  buttonRadius: 16,
  idleText: "",
  activeText: "",
  hoveredText: "",
  disabledText: "",
  pressDepth: 4,
  buttonDepthOffset: 4,
  focusIndicator: vec(16 / 1.5, 16 / 1.5),
  tabStopIndex: -1,
  customFocus: undefined,
};

/**
 * Color gradient configuration for `UIButton`.
 */
type UIButtonColors = {
  /** Starting color for the main/top face. */
  mainStarting: Color;
  /** Optional ending color for the main/top face. */
  mainEnding?: Color;
  /** Starting color for the bottom shadow/depth layer. */
  bottomStarting: Color;
  /** Optional ending color for the bottom layer. */
  bottomEnding?: Color;
  /** Starting color when hovered. */
  hoverStarting: Color;
  /** Optional hover ending color. */
  hoverEnding?: Color;
  /** Starting color when disabled. */
  disabledStarting?: Color;
  /** Optional disabled ending color. */
  disabledEnding?: Color;
};

/**
 * A clickable UI Button with hover, focus and keyboard support.
 *
 * Emits events defined in `UIButtonEvents` and can be navigated with keyboard (Space/Enter).
 */
export class UIButton extends InteractiveUIComponent<UIButtonConfig, UIButtonEvents> {
  /** Current button state (idle/hovered/pressed/disabled). */
  private state: UIButtonState = "idle";
  /** Tracks whether the pointer is currently over the button. */
  _isHovered = false;
  /** Whether the button is currently pressed (pointerdown or key). */
  private isPressed = false;
  /** Internal flag to ignore immediate pointerleave after pointerup. */
  private ignoreLeave = false;
  /** Callback invoked on click. */
  private callback: () => void;

  /**
   * Create a new UIButton.
   * @param buttonConfig - Partial configuration for the button. Missing values will be filled from defaults.
   */
  constructor(buttonConfig: UIButtonConfig) {
    let localConfig = { ...defaultButtonConfig, ...buttonConfig };
    super(localConfig);
    this.callback = localConfig.callback;
    this._config = localConfig;
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    this.graphics.use(new UIButtonGraphic(this, vec(localConfig.width, localConfig.height), () => this.state, this._config));
  }

  /**
   * Called when the component is added to the engine. Registers input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
    this.on("pointerdown", this.onPointerDown);
    this.on("pointerup", this.onClick);
    engine.input.keyboard.on("press", this.onKeyDown);
    engine.input.keyboard.on("release", this.onKeyUp);
  }

  onRemove(engine: Engine): void {
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
    this.off("pointerdown", this.onPointerDown);
    this.off("pointerup", this.onClick);
    engine.input.keyboard.off("press", this.onKeyDown);
    engine.input.keyboard.off("release", this.onKeyUp);
  }

  /**
   * Keyboard 'press' handler. When focused and Space/Enter is pressed,
   * marks the button as pressed and emits `UIButtonDown`.
   * @param ekey - The keyboard event payload.
   */
  onKeyDown = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.isPressed = true;
    this.emitter.emit("UIButtonDown", { name: this.name, target: this, event: ekey });
    this.updateState();
  };
  /**
   * Keyboard 'release' handler. When focused and Space/Enter is released,
   * emits `UIButtonUp` and triggers a click if the button was pressed.
   * @param ekey - The keyboard event payload.
   */
  onKeyUp = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.emitter.emit("UIButtonUp", { name: this.name, target: this, event: ekey });
    if (this.isPressed) {
      this.emitter.emit("UIButtonClicked", { name: this.name, target: this, event: ekey });
      this.callback();
    }
    this.isPressed = false;
    this.updateState();
  };

  /**
   * Pointer enter handler. Marks the button as hovered and emits `UIButtonHovered`.
   */
  onHover = (): void => {
    if (!this.isEnabled) return;
    this._isHovered = true;
    this.emitter.emit("UIButtonHovered", { name: this.name, target: this, event: "hovered" });
    this.updateState();
  };
  /**
   * Pointer leave handler. Ignores transient leaves if `ignoreLeave` is set.
   */
  onUnhover = (): void => {
    if (!this.isEnabled) return;
    // Ignore spurious leave events right after pointerup
    if (this.ignoreLeave) return;
    this.emitter.emit("UIButtonUnhovered", { name: this.name, target: this, event: "unhovered" });
    this._isHovered = false;
    this.updateState();
  };

  /** Whether the button is currently hovered. */
  get isHovered() {
    return this._isHovered;
  }

  /** Give the button keyboard focus and emit `UIButtonFocused`. */
  focus() {
    if (!this.isEnabled) return;
    this._isFocused = true;
    this.emitter.emit("UIButtonFocused", { name: this.name, target: this, event: "focused" });
    this.updateState();
  }

  /** Remove keyboard focus from the button. */
  loseFocus() {
    if (!this.isEnabled) return;
    this._isFocused = false;
    this.emitter.emit("UIButtonUnfocused", { name: this.name, target: this, event: "unfocused" });
    this.updateState();
  }

  /** Whether the button currently has keyboard focus. */
  get isFocused() {
    return this._isFocused;
  }

  /**
   * Pointer down handler. Marks the button as pressed and emits `UIButtonDown`.
   * @param evt - Pointer event payload.
   */
  onPointerDown = (evt: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.isPressed = true;
    this.emitter.emit("UIButtonDown", { name: this.name, target: this, event: evt });
    this.updateState();
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer up / click handler. Emits `UIButtonUp` and `UIButtonClicked` (when appropriate),
   * runs the configured callback, and temporarily ignores a following pointerleave event.
   * @param evt - Pointer event payload.
   */
  onClick = (evt: PointerEvent) => {
    if (!this.isEnabled) return;
    const wasPressed = this.isPressed;
    this.isPressed = false;

    // Prevent pointerleave from firing immediately after pointerup
    this.ignoreLeave = true;
    setTimeout(() => {
      this.ignoreLeave = false;
    }, POINTER_LEAVE_DELAY_MS);

    this.updateState();
    this.emitter.emit("UIButtonUp", { name: this.name, target: this, event: evt });
    if (wasPressed && this.isHovered) {
      this.emitter.emit("UIButtonClicked", { name: this.name, target: this, event: evt });
      this.callback();
    }
  };

  /**
   * The event emitter for the button. Listeners can be added to this
   * emitter to receive events emitted by the button.
   * @example
   */
  get eventEmitter() {
    return this.emitter;
  }

  /** The current state of the button. */
  get buttonState() {
    return this.state;
  }

  /** Emits `UIButtonEnabled` when enabled and `UIButtonDisabled` when disabled. */
  protected onEnabled(): void {
    this.emitter.emit("UIButtonEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /** Emits `UIButtonDisabled` when disabled. */
  protected onDisabled(): void {
    this._isHovered = false;
    this._isFocused = false;
    this.emitter.emit("UIButtonDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Sets the enabled state of the button.
   * @param value
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
    this.updateState();
  }

  /** Updates the state of the button. */
  updateState() {
    if (!this.isEnabled) {
      this.state = "disabled";
      return;
    }

    if (this.isPressed) {
      this.state = "pressed";
    } else if (this._isHovered) {
      this.state = "hovered";
    } else {
      this.state = "idle";
    }
  }
}

/**
 * Graphic implementation for rendering a `UIButton` to a canvas.
 * Handles drawing top face, bottom depth layer, text and focus indicator.
 */
class UIButtonGraphic extends Graphic {
  private size: Vector;
  private getState: () => UIButtonState;
  private config: UIButtonConfig;
  private radius = 16;
  private depthPressed = 4;
  private depthOffset = 4;
  private owner: UIButton;
  private focusPosition: Vector = new Vector(0, 0);

  colors: UIButtonColors = {
    mainStarting: Color.LightGray,
    bottomStarting: Color.DarkGray,
    hoverStarting: Color.LightGray,
  };
  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the button graphic.
   * @param owner - The owning `UIButton` instance.
   * @param size - Size of the button (width,height) for rendering.
   * @param getState - Function that returns the current `UIButtonState`.
   * @param buttonConfig - Button configuration for styling and layout.
   */
  constructor(owner: UIButton, size: Vector, getState: () => UIButtonState, buttonConfig: UIButtonConfig) {
    super({ width: size.x, height: size.y + buttonConfig.pressDepth + buttonConfig.buttonDepthOffset });
    this.owner = owner;
    this.size = size;
    this.config = buttonConfig;
    this.getState = getState;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y + buttonConfig.pressDepth + buttonConfig.buttonDepthOffset;
    this.ctx = this.cnv.getContext("2d");
    this.radius = buttonConfig.buttonRadius ?? this.radius;
    this.depthPressed = buttonConfig.pressDepth ?? this.depthPressed;
    this.depthOffset = buttonConfig.buttonDepthOffset ?? this.depthOffset;
    this.focusPosition = buttonConfig.focusIndicator ?? this.focusPosition;
    if (!this.ctx) return;
    if (buttonConfig.colors) this.colors = { ...this.colors, ...buttonConfig.colors };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UIButtonGraphic {
    return new UIButtonGraphic(this.owner, this.size, this.getState, this.config);
  }

  /**
   * Render the button to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const state = this.getState();
    let cnv = this.cnv;
    let ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y + this.depthPressed);
    const isEnabled = state !== "disabled";
    const isPressed = state === "pressed";
    const isFocused = this.owner.isFocused;

    const depth = this.depthPressed;
    const depthOffset = this.depthOffset;
    const pressOffset = isPressed ? this.depthPressed : 0;

    if (!ctx || !cnv) return;

    // Apply grayscale filter to the canvas context when disabled
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    // Bottom depth layer (CSS ::after)
    this.drawRoundedRect(ctx, 0, depth + depthOffset, this.size.x, this.size.y, this.radius, this.bottomGradient(ctx));
    // Top face
    this.drawRoundedRect(ctx, 0, pressOffset, this.size.x, this.size.y, this.radius, this.topGradient(ctx, state));

    ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    let thisFont = this.config.textOptions?.font as Font | undefined;

    // Draw any text
    drawText(ctx, this._getTextForState(state), {
      x: 0,
      y: pressOffset,
      width: this.size.x,
      height: this.size.y,
      fontSize: thisFont?.size ?? 20,
      font: thisFont?.family ?? "Arial",
    });

    // draw dot on top left if focused
    if (isFocused && isEnabled) {
      if (this.config.customFocus) {
        this.config.customFocus(ctx, this.size.x, this.size.y);
      } else {
        const dotX = this.focusPosition.x;
        const dotY = this.focusPosition.y;
        ctx.fillStyle = "#000000";
        ctx.beginPath();
        ctx.arc(dotX, dotY + pressOffset, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // draw image to ex
    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }

  private _getTextForState(state: UIButtonState): string {
    switch (state) {
      case "idle":
        return this.config.idleText ?? "";
      case "pressed":
        return this.config.activeText ?? "";
      case "hovered":
        return this.config.hoveredText ?? "";
      case "disabled":
        return this.config.disabledText ?? "";
    }
  }

  // ============================
  // Gradients
  // ============================

  /**
   * Create a gradient for the top face based on the current state.
   * @param ex - Canvas rendering context used to create the gradient.
   * @param state - Current `UIButtonState`.
   */
  private topGradient(ex: CanvasRenderingContext2D, state: UIButtonState): CanvasGradient {
    const g = ex.createLinearGradient(0, 0, 0, this.size.y);

    if (state === "hovered") {
      g.addColorStop(0, this.colors.hoverStarting.toString()); //"#f2b95a");
      this.colors.hoverEnding
        ? g.addColorStop(1, this.colors.hoverEnding.toString())
        : g.addColorStop(1, this.colors.hoverStarting.toString());
    } else if (state === "disabled") {
      g.addColorStop(0, this.colors.disabledStarting.toString());
      this.colors.disabledEnding
        ? g.addColorStop(1, this.colors.disabledEnding.toString())
        : g.addColorStop(1, this.colors.disabledStarting.toString());
    } else {
      g.addColorStop(0, this.colors.mainStarting.toString());
      this.colors.mainEnding
        ? g.addColorStop(1, this.colors.mainEnding.toString())
        : g.addColorStop(1, this.colors.mainStarting.toString());
    }

    return g;
  }

  /** Create a gradient for the bottom/depth layer of the button. */
  private bottomGradient(ex: CanvasRenderingContext2D): CanvasGradient {
    const g = ex.createLinearGradient(0, 0, 0, this.size.y);
    g.addColorStop(0, this.colors.bottomStarting.toString());
    this.colors.bottomEnding
      ? g.addColorStop(1, this.colors.bottomEnding.toString())
      : g.addColorStop(1, this.colors.bottomStarting.toString());

    return g;
  }

  // ============================
  // Shape helper
  // ============================

  /**
   * Helper to draw a rounded rectangle filled with the provided gradient.
   * @param ex - Canvas rendering context.
   * @param x - X position.
   * @param y - Y position.
   * @param w - Width.
   * @param h - Height.
   * @param r - Corner radius.
   * @param fill - Fill style (gradient).
   */
  private drawRoundedRect(ex: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: CanvasGradient) {
    ex.beginPath();
    ex.roundRect(x, y, w, h, r);
    ex.fillStyle = fill;
    ex.fill();
  }
}
// #endregion Standard Button

// #region Sprite Button
/**
 * Configuration for a sprite-based `UISpriteButton`.
 */
export type UISpriteButtonConfig = BaseUIConfig & {
  /** Optional sprites for each button state. */
  sprites?: {
    idle?: Sprite;
    hovered?: Sprite;
    pressed?: Sprite;
    disabled?: Sprite;
  };
  /** Callback invoked when the button is clicked. */
  callback?: () => void;
  /** Radius for rounded corners. */
  buttonRadius?: number;
  /** Text for idle state. */
  idleText?: string;
  /** Text for pressed state. */
  activeText?: string;
  /** Text for hovered state. */
  hoveredText?: string;
  /** Text for disabled state. */
  disabledText?: string;
  /** Text drawing options. */
  textOptions?: Omit<TextOptions, "text">;
  /** Offset for how text should be drawn relative to the button. */
  textOffset?: Vector;
  /** Press depth for pressed rendering. */
  pressDepth?: number;
  /** Position for focus indicator dot. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation. */
  tabStopIndex?: number;
};

/** Default configuration values for `UISpriteButton`. */
const defaultSpriteButtonConfig: UISpriteButtonConfig = {
  name: "UISpriteButton",
  width: 100,
  height: 50,
  pos: vec(0, 0),
  z: 1,
  callback: () => {
    console.log("clicked");
  },
  idleText: "",
  activeText: "",
  hoveredText: "",
  disabledText: "",
  pressDepth: 4,
  textOffset: vec(0, 0),
  focusIndicator: vec(16 / 1.5, 16 / 1.5),
  tabStopIndex: -1,
};

/**
 * A sprite-based button that supports hover/focus/keyboard interactions.
 * Behaves similarly to `UIButton` but renders provided sprites per state.
 */
export class UISpriteButton
  extends InteractiveUIComponent<UIButtonConfig, UIButtonEvents>
  implements IFocusable, IHoverable, IClickable
{
  /** Current button state. */
  private state: UIButtonState = "idle";
  /** Pointer hover flag. */
  _isHovered = false;
  /** Pressed flag. */
  private isPressed = false;
  /** Ignore pointerleave immediately after pointerup. */
  private ignoreLeave = false;
  /** Click callback. */
  private callback: () => void;

  /**
   * Create a new UISpriteButton.
   * @param buttonConfig - Partial config; defaults will be applied.
   */
  constructor(buttonConfig: UISpriteButtonConfig) {
    let localConfig = { ...defaultSpriteButtonConfig, ...buttonConfig };
    super(localConfig);
    this.callback = localConfig.callback;
    this._config = localConfig;
    this.graphics.use(new UISpriteButtonGraphic(this, vec(localConfig.width, localConfig.height), () => this.state, this._config));
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
  }

  /**
   * Called when the component is added to the engine. Registers input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerenter", this.onHover);
    this.on("pointerleave", this.onUnhover);
    this.on("pointerdown", this.onPointerDown);
    this.on("pointerup", this.onClick);
    engine.input.keyboard.on("press", this.onKeyDown);
    engine.input.keyboard.on("release", this.onKeyUp);
  }

  /**
   * Called when the component is removed from the engine. Unregisters input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerenter", this.onHover);
    this.off("pointerleave", this.onUnhover);
    this.off("pointerdown", this.onPointerDown);
    this.off("pointerup", this.onClick);
    engine.input.keyboard.off("press", this.onKeyDown);
    engine.input.keyboard.off("release", this.onKeyUp);
  }

  /**
   * Keyboard 'press' handler. When focused and Space/Enter is pressed,
   * marks the button as pressed and emits `UIButtonDown`.
   * @param ekey - The keyboard event payload.
   */
  onKeyDown = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.isPressed = true;
    this.emitter.emit("UIButtonDown", { name: this.name, target: this, event: ekey });
    this.updateState();
  };

  /**
   * Keyboard 'release' handler. When focused and Space/Enter is released,
   * marks the button as released and emits `UIButtonUp`.
   * @param ekey - The keyboard event payload.
   */
  onKeyUp = (ekey: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this.isFocused) return;
    if (ekey.key !== Keys.Space && ekey.key !== Keys.Enter) return;
    this.emitter.emit("UIButtonUp", { name: this.name, target: this, event: ekey });
    if (this.isPressed) {
      this.emitter.emit("UIButtonClicked", { name: this.name, target: this, event: ekey });
      this.callback();
    }
    this.isPressed = false;
    this.updateState();
  };

  /**
   * Pointer enter handler. Marks the button as hovered and emits `UIButtonHovered`.
   */
  onHover = (): void => {
    if (!this.isEnabled) return;
    this._isHovered = true;
    this.emitter.emit("UIButtonHovered", { name: this.name, target: this, event: "hovered" });
    this.updateState();
  };

  /**
   * Pointer leave handler. Marks the button as unhovered and emits `UIButtonUnhovered`.
   */
  onUnhover = (): void => {
    if (!this.isEnabled) return;
    // Ignore spurious leave events right after pointerup
    if (this.ignoreLeave) return;
    this.emitter.emit("UIButtonUnhovered", { name: this.name, target: this, event: "unhovered" });
    this._isHovered = false;
    this.updateState();
  };

  /**
   * Hover flag getter.
   */
  get isHovered() {
    return this._isHovered;
  }

  /** Give the button keyboard focus and emit `UIButtonFocused`. */
  focus() {
    if (!this.isEnabled) return;
    this._isFocused = true;
    this.emitter.emit("UIButtonFocused", { name: this.name, target: this, event: "focused" });
    this.updateState();
  }

  /** Remove keyboard focus and emit `UIButtonUnfocused`. */
  loseFocus() {
    if (!this.isEnabled) return;
    this._isFocused = false;
    this.emitter.emit("UIButtonUnfocused", { name: this.name, target: this, event: "unfocused" });
    this.updateState();
  }

  /** Keyboard focus flag getter. */
  get isFocused() {
    return this._isFocused;
  }

  /**
   * Pointer down handler for sprite button. Marks the button as pressed and emits `UIButtonDown`.
   * @param evt - Pointer event payload.
   */
  onPointerDown = (evt: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.isPressed = true;
    this.emitter.emit("UIButtonDown", { name: this.name, target: this, event: evt });
    this.updateState();
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer up / click handler for sprite button. Emits `UIButtonUp` and `UIButtonClicked` when appropriate and runs the callback.
   * @param evt - Pointer event payload.
   */
  onClick = (evt: PointerEvent) => {
    if (!this.isEnabled) return;
    const wasPressed = this.isPressed;
    this.isPressed = false;

    // Prevent pointerleave from firing immediately after pointerup
    this.ignoreLeave = true;
    setTimeout(() => {
      this.ignoreLeave = false;
    }, POINTER_LEAVE_DELAY_MS);

    this.updateState();
    this.emitter.emit("UIButtonUp", { name: this.name, target: this, event: evt });
    if (wasPressed && this.isHovered) {
      this.emitter.emit("UIButtonClicked", { name: this.name, target: this, event: evt });
      this.callback();
    }
  };

  setManager(manager: UIFocusManager) {
    this.manager = manager;
  }

  /**
   * Event emitter getter.
   * @readonly
   * @type {EventEmitter<UIEventPayload>}
   * */

  get eventEmitter() {
    return this.emitter;
  }

  /**
   * Button state getter.
   * @readonly
   * @type {string}
   */
  get buttonState() {
    return this.state;
  }

  /**
   * Hook called when component is enabled. Emits `UIButtonEnabled` event.
   * Override to emit events or perform custom logic.
   */
  protected onEnabled(): void {
    this.emitter.emit("UIButtonEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Hook called when component is disabled. Emits `UIButtonDisabled` event.
   * Override to emit events or perform custom logic.
   */
  protected onDisabled(): void {
    this._isHovered = false;
    this._isFocused = false;
    this.emitter.emit("UIButtonDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Set the enabled state of the button and emit `UIButtonEnabled` or `UIButtonDisabled` events.
   * @param value - The new enabled state of the button.
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
    this.updateState();
  }

  /**
   * Update the state of the button based on its properties and emit appropriate events.
   * @private
   * */
  updateState() {
    if (!this.isEnabled) {
      this.state = "disabled";
      return;
    }

    if (this.isPressed) {
      this.state = "pressed";
    } else if (this._isHovered) {
      this.state = "hovered";
    } else {
      this.state = "idle";
    }
  }
}

/**
 * Graphic implementation for rendering a `UISpriteButton` using provided sprites.
 * Draws sprite frames, text and focus indicator onto a canvas.
 */
class UISpriteButtonGraphic extends Graphic {
  private size: Vector;
  private getState: () => UIButtonState;
  private config: UISpriteButtonConfig;
  private radius = 16;
  private depthPressed = 4;
  private owner: UISpriteButton;
  private focusPosition: Vector = new Vector(0, 0);

  sprites: {
    idle: Sprite | null;
    hovered: Sprite | null;
    pressed: Sprite | null;
    disabled: Sprite | null;
  };
  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;
  textOffset: Vector;

  /**
   * Create the sprite button graphic.
   * @param owner - Owning `UISpriteButton`.
   * @param size - Size to render the sprites at.
   * @param getState - Function returning the current `UIButtonState`.
   * @param buttonConfig - Sprite button configuration.
   */
  constructor(owner: UISpriteButton, size: Vector, getState: () => UIButtonState, buttonConfig: UISpriteButtonConfig) {
    const localConfig = { ...defaultSpriteButtonConfig, ...buttonConfig };

    super({ width: size.x, height: size.y });
    this.owner = owner;
    this.size = size;
    this.config = localConfig;
    this.getState = getState;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d");
    this.textOffset = localConfig.textOffset ?? vec(0, 0);
    this.radius = localConfig.buttonRadius ?? this.radius;
    this.depthPressed = localConfig.pressDepth ?? this.depthPressed;
    this.focusPosition = localConfig.focusIndicator ?? this.focusPosition;
    if (!this.ctx) return;
    this.sprites = { ...this.sprites, ...localConfig.sprites };
  }

  /** Create a deep clone of this sprite graphic (used by Excalibur). */
  clone(): UISpriteButtonGraphic {
    return new UISpriteButtonGraphic(this.owner, this.size, this.getState, this.config);
  }

  /**
   * Render the sprite button to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const state = this.getState();
    let cnv = this.cnv;
    let ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);

    const isEnabled = state !== "disabled";
    const isPressed = state === "pressed";
    const isFocused = this.owner.isFocused;
    const pressOffset = isPressed ? this.depthPressed : 0;

    if (!ctx || !cnv) return;

    // Apply grayscale filter to the canvas context when disabled
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    const drawnSprite = this.getSpriteByState(state);

    if (!drawnSprite) {
      ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#464646";
      ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#464646";
      ctx.rect(0, 0, this.size.x, this.size.y + this.depthPressed);
    } else {
      //scale image
      let image = drawnSprite.image.image;

      ctx.drawImage(image, 0, 0, this.size.x, this.size.y);
    }

    ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    let thisFont = this.config.textOptions?.font as Font | undefined;

    // Draw any text
    drawText(ctx, this._getTextForState(state), {
      x: 0 + this.textOffset.x,
      y: pressOffset + this.textOffset.y,
      width: this.size.x,
      height: this.size.y,
      fontSize: thisFont?.size ?? 20,
      font: thisFont?.family ?? "Arial",
    });

    // draw dot on top left if focused
    if (isFocused && isEnabled) {
      const dotX = this.focusPosition.x;
      const dotY = this.focusPosition.y;
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(dotX, dotY + pressOffset, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // draw image to ex
    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }

  private _getTextForState(state: UIButtonState): string {
    switch (state) {
      case "idle":
        return this.config.idleText ?? "";
      case "pressed":
        return this.config.activeText ?? "";
      case "hovered":
        return this.config.hoveredText ?? "";
      case "disabled":
        return this.config.disabledText ?? "";
    }
  }

  // Grab Sprites by state
  /** Return the sprite associated with a given state or null if none provided. */
  getSpriteByState(state: UIButtonState): Sprite | null {
    switch (state) {
      case "idle":
        return this.sprites.idle ?? null;
      case "pressed":
        return this.sprites.pressed ?? null;
      case "hovered":
        return this.sprites.hovered ?? null;
      case "disabled":
        return this.sprites.disabled ?? null;
    }
  }
}
// #endregion Sprite Button

// #region Events

/** Event emitted when a button is clicked. */
export class UIButtonClicked extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button receives a pointer hover. */
export class UIButtonHovered extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}
/** Event emitted when a pointer leaves a button (unhover). */
export class UIButtonUnhovered extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button is enabled. */
export class UIButtonEnabled extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button is disabled. */
export class UIButtonDisabled extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button is pressed down (pointer or key). */
export class UIButtonDown extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button is released (pointer or key). */
export class UIButtonUp extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

/** Event emitted when a button receives keyboard focus. */
export class UIButtonFocused extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}
/** Event emitted when a button loses keyboard focus. */
export class UIButtonUnfocused extends GameEvent<UIButton | UISpriteButton> {
  constructor(public target: UIButton | UISpriteButton) {
    super();
  }
}

// #endregion Events
