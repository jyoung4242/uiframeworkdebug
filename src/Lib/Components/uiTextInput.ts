//uiTextInput.ts

import {
  Color,
  Engine,
  ExcaliburGraphicsContext,
  Font,
  GameEvent,
  Graphic,
  KeyEvent,
  Keys,
  PointerEvent,
  TextOptions,
  vec,
  Vector,
} from "excalibur";
import { drawText } from "canvas-txt";
import { BaseUIConfig, IFocusable, InteractiveUIComponent } from "./uiComponent";

/**
 * The visual/interactable state of the `UITextInput`.
 *
 * - "normal": default state
 * - "focused": input has focus and is being edited
 * - "disabled": not interactive
 */
export type UITextInputState = "normal" | "focused" | "disabled";

/**
 * Event map emitted by `UITextInput`.
 * Each property corresponds to a specific event payload type.
 */
export type UITextInputEvents = {
  UITextInputValueChanged: UITextInputValueChanged;
  UITextInputFocused: UITextInputFocused;
  UITextInputUnfocused: UITextInputUnfocused;
  UITextInputDisabled: UITextInputDisabled;
  UITextInputEnabled: UITextInputEnabled;
  UITextInputSubmit: UITextInputSubmit;
};

/**
 * Configuration options for `UITextInput`.
 */
export type UITextInputConfig = BaseUIConfig & {
  /** Initial text value. */
  value?: string;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Maximum character length allowed. */
  maxLength?: number;
  /** Text drawing options (font, color, etc.). */
  textOptions?: Omit<TextOptions, "text">;
  /** Color configuration for the text input. */
  colors?: UITextInputColors;
  /** Radius for rounded corners. */
  inputRadius?: number;
  /** Internal padding for text. */
  padding?: Vector;
  /** Border width in pixels. */
  borderWidth?: number;
  /** Whether to display as password (bullet characters). */
  password?: boolean;
  /** Tab stop index for keyboard navigation (-1 to opt-out). */
  tabStopIndex?: number;
};

/** Default configuration values for `UITextInput`. */
const defaultTextInputConfig: UITextInputConfig = {
  name: "UITextInput",
  width: 200,
  height: 40,
  pos: vec(0, 0),
  z: 1,
  value: "",
  placeholder: "",
  maxLength: undefined,
  colors: {
    backgroundStarting: Color.fromHex("#FFFFFF"),
    borderNormal: Color.fromHex("#CCCCCC"),
    borderFocused: Color.fromHex("#4A90E2"),
    borderDisabled: Color.fromHex("#E0E0E0"),
    cursorColor: Color.fromHex("#000000"),
  },
  inputRadius: 4,
  padding: vec(8, 8),
  borderWidth: 2,
  password: false,
  tabStopIndex: -1,
};

/**
 * Color configuration for `UITextInput`.
 */
type UITextInputColors = {
  /** Starting color for background gradient. */
  backgroundStarting?: Color;
  /** Ending color for background gradient. */
  backgroundEnding?: Color;
  /** Starting color when focused. */
  focusedStarting?: Color;
  /** Ending color when focused. */
  focusedEnding?: Color;
  /** Starting color when disabled. */
  disabledStarting?: Color;
  /** Ending color when disabled. */
  disabledEnding?: Color;
  /** Border color in normal state. */
  borderNormal?: Color;
  /** Border color when focused. */
  borderFocused?: Color;
  /** Border color when disabled. */
  borderDisabled?: Color;
  /** Color of the text cursor. */
  cursorColor?: Color;
};

/**
 * A text input UI component with keyboard support, cursor blinking,
 * and password masking capabilities.
 *
 * Emits events defined in `UITextInputEvents` and can be navigated with keyboard.
 */
export class UITextInput extends InteractiveUIComponent<UITextInputConfig, UITextInputEvents> {
  /** Current text input state. */
  private state: UITextInputState = "normal";
  /** The current text value. */
  private _value: string;
  /** Current cursor position in the text. */
  private _cursorPosition: number = 0;
  /** Whether the cursor is currently visible (for blinking). */
  private _cursorVisible: boolean = true;
  /** Timer for cursor blink animation. */
  private _cursorBlinkTimer: number = 0;
  /** Interval for cursor blink in milliseconds. */
  private _cursorBlinkInterval: number = 530;

  /**
   * Create a new UITextInput.
   * @param textInputConfig - Partial configuration for the text input. Missing values will be filled from defaults.
   */
  constructor(textInputConfig: UITextInputConfig) {
    const localConfig = { ...defaultTextInputConfig, ...textInputConfig };
    super(localConfig);
    this._config = localConfig;
    this._value = localConfig.value ?? "";
    this._cursorPosition = this._value.length;
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;

    const size = vec(localConfig.width, localConfig.height);
    this.graphics.use(
      new UITextInputGraphic(
        this,
        size,
        () => this.state,
        () => this._cursorVisible,
        this._config,
      ),
    );

    this.pointer.useGraphicsBounds = true;
  }

  /**
   * Called when the component is added to the engine. Registers input handlers (pointer + keyboard).
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerdown", this.onPointerDown);
    engine.input.keyboard.on("press", this.onKeyDown);
  }

  /**
   * Called when the component is removed from the engine. Unregisters input handlers.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerdown", this.onPointerDown);
    engine.input.keyboard.off("press", this.onKeyDown);
  }

  /**
   * Update loop handler for cursor blinking animation.
   * @param engine - The engine instance.
   * @param delta - Time elapsed since last frame in milliseconds.
   */
  onPreUpdate(engine: Engine, delta: number): void {
    super.onPreUpdate(engine, delta);

    if (this._isFocused) {
      this._cursorBlinkTimer += delta;
      if (this._cursorBlinkTimer >= this._cursorBlinkInterval) {
        this._cursorVisible = !this._cursorVisible;
        this._cursorBlinkTimer = 0;
      }
    }
  }

  /**
   * Keyboard press handler. Handles all keyboard input for the text field.
   * @param evt - The keyboard event payload.
   */
  onKeyDown = (evt: KeyEvent): void => {
    if (!this.isEnabled) return;
    if (!this._isFocused) return;

    if (evt.key === Keys.Backspace) {
      this.handleBackspace();
    } else if (evt.key === Keys.Delete) {
      this.handleDelete();
    } else if (evt.key === Keys.Left) {
      this.moveCursorLeft();
    } else if (evt.key === Keys.Right) {
      this.moveCursorRight();
    } else if (evt.key === Keys.Home) {
      this._cursorPosition = 0;
      this.resetCursorBlink();
    } else if (evt.key === Keys.End) {
      this._cursorPosition = this._value.length;
      this.resetCursorBlink();
    } else if (evt.key === Keys.Enter) {
      this.emitter.emit("UITextInputSubmit", {
        name: this.name,
        target: this,
        event: "submit",
        value: this._value,
      });
    } else if (evt.key === Keys.Escape) {
      // Lose focus on escape
      this.loseFocus();
    } else if (evt.key && this.isPrintableKey(evt.value)) {
      this.insertCharacter(evt.value);
    }
  };

  /**
   * Pointer down handler. Gives the input focus when clicked.
   * @param evt - Pointer event payload.
   */
  onPointerDown = (evt: PointerEvent): void => {
    if (!this.isEnabled) return;
    this.focus();
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Check if a character is printable (visible character).
   * @param key - The character to validate.
   */
  private isPrintableKey(key: string): boolean {
    // Allow single printable characters (letters, numbers, symbols, spaces)
    return key.length === 1 && key.charCodeAt(0) >= 32 && key.charCodeAt(0) <= 126;
  }

  /**
   * Insert a character at the current cursor position.
   * @param char - The character to insert.
   */
  private insertCharacter(char: string): void {
    if (this._config.maxLength && this._value.length >= this._config.maxLength) {
      return;
    }

    const before = this._value.substring(0, this._cursorPosition);
    const after = this._value.substring(this._cursorPosition);
    this._value = before + char + after;
    this._cursorPosition++;
    this.resetCursorBlink();
    this.emitValueChanged();
  }

  /**
   * Handle backspace key - delete character before cursor.
   */
  private handleBackspace(): void {
    if (this._cursorPosition > 0) {
      const before = this._value.substring(0, this._cursorPosition - 1);
      const after = this._value.substring(this._cursorPosition);
      this._value = before + after;
      this._cursorPosition--;
      this.resetCursorBlink();
      this.emitValueChanged();
    }
  }

  /**
   * Handle delete key - delete character after cursor.
   */
  private handleDelete(): void {
    if (this._cursorPosition < this._value.length) {
      const before = this._value.substring(0, this._cursorPosition);
      const after = this._value.substring(this._cursorPosition + 1);
      this._value = before + after;
      this.resetCursorBlink();
      this.emitValueChanged();
    }
  }

  /**
   * Move cursor one position to the left.
   */
  private moveCursorLeft(): void {
    if (this._cursorPosition > 0) {
      this._cursorPosition--;
      this.resetCursorBlink();
    }
  }

  /**
   * Move cursor one position to the right.
   */
  private moveCursorRight(): void {
    if (this._cursorPosition < this._value.length) {
      this._cursorPosition++;
      this.resetCursorBlink();
    }
  }

  /**
   * Reset cursor blink timer and make cursor visible.
   */
  private resetCursorBlink(): void {
    this._cursorVisible = true;
    this._cursorBlinkTimer = 0;
  }

  /**
   * Emit the value changed event.
   */
  private emitValueChanged(): void {
    this.emitter.emit("UITextInputValueChanged", {
      name: this.name,
      target: this,
      event: "valueChanged",
      value: this._value,
    });
  }

  /**
   * Set the text value. Respects maxLength if configured.
   * @param value - The new text value to set.
   */
  setValue(value: string): void {
    const newValue = this._config.maxLength ? value.substring(0, this._config.maxLength) : value;
    if (this._value !== newValue) {
      this._value = newValue;
      this._cursorPosition = Math.min(this._cursorPosition, this._value.length);
      this.emitValueChanged();
    }
  }

  /**
   * Get the current text value.
   */
  getValue(): string {
    return this._value;
  }

  /**
   * Get the current cursor position.
   */
  getCursorPosition(): number {
    return this._cursorPosition;
  }

  /**
   * Set the cursor position.
   * @param position - The new cursor position.
   */
  setCursorPosition(position: number): void {
    this._cursorPosition = Math.max(0, Math.min(position, this._value.length));
    this.resetCursorBlink();
  }

  /** Give the input keyboard focus and emit `UITextInputFocused`. */
  focus(): void {
    if (!this.isEnabled) return;
    if (this._isFocused) return;

    this._isFocused = true;
    this.state = "focused";
    this._cursorVisible = true;
    this._cursorBlinkTimer = 0;
    this.emitter.emit("UITextInputFocused", { name: this.name, target: this, event: "focused" });
  }

  /** Remove keyboard focus from the input. */
  loseFocus(): void {
    if (!this.isEnabled) return;
    if (!this._isFocused) return;

    this._isFocused = false;
    this.state = "normal";
    this.emitter.emit("UITextInputUnfocused", { name: this.name, target: this, event: "unfocused" });
  }

  /** Whether the input currently has keyboard focus. */
  get isFocused(): boolean {
    return this._isFocused;
  }

  /** Get the current state of the text input. */
  get inputState(): UITextInputState {
    return this.state;
  }

  /**
   * The event emitter for the text input. Listeners can be added to this
   * emitter to receive events emitted by the input.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /** Emits `UITextInputEnabled` when enabled. */
  protected onEnabled(): void {
    this.state = "normal";
    this.emitter.emit("UITextInputEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /** Emits `UITextInputDisabled` when disabled and removes focus. */
  protected onDisabled(): void {
    if (this._isFocused) {
      this.loseFocus();
    }
    this.state = "disabled";
    this.emitter.emit("UITextInputDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Sets the enabled state of the text input.
   * @param value
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
  }
}

/**
 * Graphic implementation for rendering a `UITextInput` to a canvas.
 * Handles drawing the input box, text (or password bullets), cursor, and border.
 */
class UITextInputGraphic extends Graphic {
  private size: Vector;
  private getState: () => UITextInputState;
  private getCursorVisible: () => boolean;
  private config: UITextInputConfig;
  private owner: UITextInput;
  private radius = 4;
  private padding: Vector;
  private borderWidth: number;
  private colors: UITextInputColors;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the text input graphic.
   * @param owner - The owning `UITextInput` instance.
   * @param size - Size of the input (width,height) for rendering.
   * @param getState - Function that returns the current `UITextInputState`.
   * @param getCursorVisible - Function that returns whether the cursor should be visible.
   * @param inputConfig - Text input configuration for styling and layout.
   */
  constructor(
    owner: UITextInput,
    size: Vector,
    getState: () => UITextInputState,
    getCursorVisible: () => boolean,
    inputConfig: UITextInputConfig,
  ) {
    super({ width: size.x, height: size.y });
    this.owner = owner;
    this.size = size;
    this.config = inputConfig;
    this.getState = getState;
    this.getCursorVisible = getCursorVisible;
    this.cnv = document.createElement("canvas");
    this.cnv.width = this.size.x;
    this.cnv.height = this.size.y;
    this.ctx = this.cnv.getContext("2d")!;
    this.radius = inputConfig.inputRadius ?? this.radius;
    this.padding = inputConfig.padding ?? vec(8, 8);
    this.borderWidth = inputConfig.borderWidth ?? 2;
    this.colors = {
      backgroundStarting: Color.fromHex("#FFFFFF"),
      borderNormal: Color.fromHex("#CCCCCC"),
      borderFocused: Color.fromHex("#4A90E2"),
      borderDisabled: Color.fromHex("#E0E0E0"),
      cursorColor: Color.fromHex("#000000"),
      ...inputConfig.colors,
    };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UITextInputGraphic {
    return new UITextInputGraphic(this.owner, this.size, this.getState, this.getCursorVisible, this.config);
  }

  /**
   * Render the text input to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const state = this.getState();
    const cnv = this.cnv;
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.size.x, this.size.y);
    const isEnabled = state !== "disabled";

    if (!ctx || !cnv) return;

    // Apply grayscale filter when disabled
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    // Draw background
    const bgGradient = this.backgroundGradient(ctx, state);
    if (bgGradient) {
      this.drawRoundedRect(ctx, 0, 0, this.size.x, this.size.y, this.radius, bgGradient);
    }

    // Draw border
    const borderColor = this.getBorderColor(state);
    if (borderColor) {
      this.drawRoundedRectStroke(
        ctx,
        this.borderWidth / 2,
        this.borderWidth / 2,
        this.size.x - this.borderWidth,
        this.size.y - this.borderWidth,
        this.radius,
        borderColor,
        this.borderWidth,
      );
    }

    // Prepare text
    let displayText = this.owner.getValue();
    const hasText = displayText.length > 0;

    // Handle password display
    if (this.config.password && hasText) {
      displayText = "•".repeat(displayText.length);
    }

    // Show placeholder if no text
    const showPlaceholder = !hasText && this.config.placeholder && state !== "focused";

    ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    const thisFont = this.config.textOptions?.font as Font | undefined;
    const fontSize = thisFont?.size ?? 16;
    const fontFamily = thisFont?.family ?? "Arial";

    if (showPlaceholder) {
      ctx.fillStyle = "#999999";
      drawText(ctx, this.config.placeholder!, {
        x: this.padding.x,
        y: this.padding.y,
        width: this.size.x - this.padding.x * 2,
        height: this.size.y - this.padding.y * 2,
        fontSize: fontSize,
        font: fontFamily,
        align: "left",
        vAlign: "middle",
      });
    } else if (hasText) {
      drawText(ctx, displayText, {
        x: this.padding.x,
        y: this.padding.y,
        width: this.size.x - this.padding.x * 2,
        height: this.size.y - this.padding.y * 2,
        fontSize: fontSize,
        font: fontFamily,
        align: "left",
        vAlign: "middle",
      });
    }

    // Draw cursor when focused
    if (state === "focused" && this.getCursorVisible()) {
      this.drawCursor(ctx, fontSize, fontFamily);
    }

    // Draw image to ex
    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }

  /**
   * Draw the text cursor at the current cursor position.
   * @param ctx - Canvas rendering context.
   * @param fontSize - Font size for cursor height.
   * @param fontFamily - Font family for text measurement.
   */
  private drawCursor(ctx: CanvasRenderingContext2D, fontSize: number, fontFamily: string): void {
    const cursorPos = this.owner.getCursorPosition();
    const value = this.owner.getValue();
    let textBeforeCursor = value.substring(0, cursorPos);

    // Handle password display for cursor positioning
    if (this.config.password) {
      textBeforeCursor = "•".repeat(textBeforeCursor.length);
    }

    // Measure text width before cursor
    ctx.font = `${fontSize}px ${fontFamily}`;
    const textWidth = ctx.measureText(textBeforeCursor).width;

    const cursorX = this.padding.x + textWidth;
    const cursorY = this.size.y / 2 - fontSize / 2;
    const cursorHeight = fontSize;

    ctx.strokeStyle = this.colors.cursorColor?.toString() ?? "#000000";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cursorX, cursorY);
    ctx.lineTo(cursorX, cursorY + cursorHeight);
    ctx.stroke();
  }

  /**
   * Get the border color for the current state.
   * @param state - Current state of the input.
   */
  private getBorderColor(state: UITextInputState): Color | null {
    if (state === "disabled") {
      return this.colors.borderDisabled ?? null;
    } else if (state === "focused") {
      return this.colors.borderFocused ?? null;
    } else {
      return this.colors.borderNormal ?? null;
    }
  }

  // ============================
  // Gradients
  // ============================

  /**
   * Create a background gradient based on the current state.
   * @param ctx - Canvas rendering context used to create the gradient.
   * @param state - Current `UITextInputState`.
   */
  private backgroundGradient(ctx: CanvasRenderingContext2D, state: UITextInputState): CanvasGradient | null {
    if (state === "disabled") {
      if (!this.colors.disabledStarting) return this.createDefaultGradient(ctx);
      const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
      g.addColorStop(0, this.colors.disabledStarting.toString());
      this.colors.disabledEnding
        ? g.addColorStop(1, this.colors.disabledEnding.toString())
        : g.addColorStop(1, this.colors.disabledStarting.toString());
      return g;
    } else if (state === "focused") {
      if (!this.colors.focusedStarting) return this.createDefaultGradient(ctx);
      const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
      g.addColorStop(0, this.colors.focusedStarting.toString());
      this.colors.focusedEnding
        ? g.addColorStop(1, this.colors.focusedEnding.toString())
        : g.addColorStop(1, this.colors.focusedStarting.toString());
      return g;
    } else {
      return this.createDefaultGradient(ctx);
    }
  }

  /** Create the default background gradient for normal state. */
  private createDefaultGradient(ctx: CanvasRenderingContext2D): CanvasGradient | null {
    if (!this.colors.backgroundStarting) return null;
    const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
    g.addColorStop(0, this.colors.backgroundStarting.toString());
    this.colors.backgroundEnding
      ? g.addColorStop(1, this.colors.backgroundEnding.toString())
      : g.addColorStop(1, this.colors.backgroundStarting.toString());
    return g;
  }

  // ============================
  // Shape helpers
  // ============================

  /**
   * Helper to draw a rounded rectangle filled with the provided gradient.
   * @param ctx - Canvas rendering context.
   * @param x - X position.
   * @param y - Y position.
   * @param w - Width.
   * @param h - Height.
   * @param r - Corner radius.
   * @param fill - Fill style (gradient).
   */
  private drawRoundedRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    fill: CanvasGradient,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fillStyle = fill;
    ctx.fill();
  }

  /**
   * Helper to draw a rounded rectangle stroke.
   * @param ctx - Canvas rendering context.
   * @param x - X position.
   * @param y - Y position.
   * @param w - Width.
   * @param h - Height.
   * @param r - Corner radius.
   * @param stroke - Stroke color.
   * @param lineWidth - Line width.
   */
  private drawRoundedRectStroke(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    r: number,
    stroke: Color,
    lineWidth: number,
  ): void {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.strokeStyle = stroke.toString();
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

// #region Events

/** Event emitted when the text value changes. */
export class UITextInputValueChanged extends GameEvent<UITextInput> {
  constructor(
    public target: UITextInput,
    public value: string,
  ) {
    super();
  }
}

/** Event emitted when the input gains keyboard focus. */
export class UITextInputFocused extends GameEvent<UITextInput> {
  constructor(public target: UITextInput) {
    super();
  }
}

/** Event emitted when the input loses keyboard focus. */
export class UITextInputUnfocused extends GameEvent<UITextInput> {
  constructor(public target: UITextInput) {
    super();
  }
}

/** Event emitted when the input is enabled. */
export class UITextInputEnabled extends GameEvent<UITextInput> {
  constructor(public target: UITextInput) {
    super();
  }
}

/** Event emitted when the input is disabled. */
export class UITextInputDisabled extends GameEvent<UITextInput> {
  constructor(public target: UITextInput) {
    super();
  }
}

/** Event emitted when Enter key is pressed to submit the text. */
export class UITextInputSubmit extends GameEvent<UITextInput> {
  constructor(
    public target: UITextInput,
    public value: string,
  ) {
    super();
  }
}

// #endregion Events
