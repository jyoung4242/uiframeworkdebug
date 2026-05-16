import { Color, Engine, ExcaliburGraphicsContext, Font, GameEvent, Graphic, PointerEvent, TextOptions, vec, Vector } from "excalibur";
import { drawText } from "canvas-txt";
import { BaseUIConfig, DisplayUIComponent, IClickable, IHoverable } from "./uiComponent";

/**
 * Visual states for a UILabel.
 *
 * - "idle": default state
 * - "hovered": pointer is over the label (only if hover enabled)
 * - "disabled": label is not interactive
 */
export type UILabelState = "idle" | "hovered" | "disabled";

/**
 * Event map emitted by UILabel.
 * Each property corresponds to a specific event payload type.
 */
export type UILabelEvents = {
  UILabelTextChanged: UILabelTextChanged;
  UILabelHovered: UILabelHovered;
  UILabelUnhovered: UILabelUnhovered;
  UILabelEnabled: UILabelEnabled;
  UILabelDisabled: UILabelDisabled;
};

/**
 * Configuration options for UILabel.
 */
export type UILabelConfig = BaseUIConfig & {
  /** Text content displayed by the label. */
  text?: string;
  /** Text rendering options (font, alignment, color, etc.). */
  textOptions?: Omit<TextOptions, "text">;
  /** Gradient and text colors. */
  colors?: UILabelColors;
  /** Radius of the label's rounded corners (pixels). */
  labelRadius?: number;
  /** Padding between the text and label edges. */
  padding?: Vector;
  /** Whether the label responds to hover events. */
  enableHover?: boolean;
};

/**
 * Default configuration values for UILabel.
 */
const defaultLabelConfig: UILabelConfig = {
  name: "UILabel",
  width: 100,
  height: 50,
  pos: vec(0, 0),
  z: 1,
  text: "",
  colors: {
    backgroundStarting: Color.Transparent,
  },
  labelRadius: 8,
  padding: vec(8, 8),
  enableHover: false,
};

/**
 * Color configuration for UILabel gradients and text.
 */
type UILabelColors = {
  /** Starting background color for idle state. */
  backgroundStarting?: Color;
  /** Optional ending background color for idle state. */
  backgroundEnding?: Color;
  /** Starting background color when hovered. */
  hoverStarting?: Color;
  /** Optional ending hover color. */
  hoverEnding?: Color;
  /** Starting background color when disabled. */
  disabledStarting?: Color;
  /** Optional ending disabled color. */
  disabledEnding?: Color;
  /** Text color in idle state. */
  textColor?: Color;
  /** Text color when hovered. */
  textHoverColor?: Color;
};

/**
 * A non-interactive UI label that displays styled text.
 *
 * UILabel renders text with optional background gradients. Can optionally
 * respond to hover events if configured. Emits events when text changes
 * or when enabled/disabled state changes.
 */
export class UILabel extends DisplayUIComponent<UILabelConfig, UILabelEvents> implements IHoverable, IClickable {
  /** Current label state. */
  private state: UILabelState = "idle";
  /** Internal text value. */
  private _text: string;
  /** Whether the pointer is currently over the label. */
  _isHovered = false;

  /**
   * Create a new UILabel.
   * @param labelConfig - Partial configuration; defaults will be applied.
   */
  constructor(labelConfig: Partial<UILabelConfig>) {
    const localConfig = { ...defaultLabelConfig, ...labelConfig };
    super(localConfig);

    this._config = localConfig;
    this._text = localConfig.text ?? "";

    this.graphics.use(new UILabelGraphic(this, vec(localConfig.width, localConfig.height), () => this.state, this._config));

    // Only enable pointer events if hover is enabled
    if (localConfig.enableHover) {
      this.pointer.useGraphicsBounds = true;
    }
  }

  /**
   * Called when the label is added to the engine.
   * Registers pointer hover handlers if hover is enabled.
   * @param engine - The Excalibur engine instance.
   */
  onAdd(engine: Engine): void {
    if (this._config.enableHover) {
      this.on("pointerenter", this.onHover);
      this.on("pointerleave", this.onUnhover);
    }
  }

  /**
   * Called when the label is removed from the engine.
   * Unregisters pointer hover handlers.
   * @param engine - The Excalibur engine instance.
   */
  onRemove(engine: Engine): void {
    if (this._config.enableHover) {
      this.off("pointerenter", this.onHover);
      this.off("pointerleave", this.onUnhover);
    }
  }

  onClick = (event: PointerEvent): void => {
    this.emitter.emit("UILabelClicked", { name: this.name, target: this, event });
  };

  onPointerDown = (event: PointerEvent): void => {
    this.emitter.emit("UILabelPointerDown", { name: this.name, target: this, event });
  };

  /**
   * Get the current label text.
   */
  getText(): string {
    return this._text;
  }

  /**
   * Set the label text and emit a change event if it differs.
   * @param text - New label text.
   */
  setText(text: string): void {
    if (this._text === text) return;
    this._text = text;
    this._config.text = text;
    this.emitter.emit("UILabelTextChanged", { name: this.name, target: this, event: "textChanged", text });
  }

  /**
   * Pointer enter handler.
   * Marks the label as hovered and emits `UILabelHovered`.
   */
  onHover = (): void => {
    if (!this.isEnabled) return;
    this._isHovered = true;
    this.emitter.emit("UILabelHovered", { name: this.name, target: this, event: "hovered" });
    this.updateState();
  };

  /**
   * Pointer leave handler.
   * Marks the label as unhovered and emits `UILabelUnhovered`.
   */
  onUnhover = (): void => {
    if (!this.isEnabled) return;
    this._isHovered = false;
    this.emitter.emit("UILabelUnhovered", { name: this.name, target: this, event: "unhovered" });
    this.updateState();
  };

  /**
   * Whether the label is currently hovered.
   */
  get isHovered(): boolean {
    return this._isHovered;
  }

  /**
   * Called when the label becomes enabled.
   * Emits `UILabelEnabled`.
   */
  protected onEnabled(): void {
    this.updateState();
    this.emitter.emit("UILabelEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Called when the label becomes disabled.
   * Emits `UILabelDisabled` and clears hover state.
   */
  protected onDisabled(): void {
    this._isHovered = false;
    this.updateState();
    this.emitter.emit("UILabelDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Enable or disable the label.
   * @param value - New enabled state.
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
  }

  /**
   * Update the visual state of the label based on hover and enabled flags.
   */
  private updateState(): void {
    if (!this.isEnabled) {
      this.state = "disabled";
    } else if (this._isHovered) {
      this.state = "hovered";
    } else {
      this.state = "idle";
    }
  }

  /**
   * Get the current visual state of the label.
   */
  get labelState(): UILabelState {
    return this.state;
  }

  /**
   * Get the label's event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }
}

/**
 * Graphic implementation for rendering a `UILabel` to a canvas.
 * Handles drawing background gradients and text with proper styling.
 */
class UILabelGraphic extends Graphic {
  private size: Vector;
  private getState: () => UILabelState;
  private config: UILabelConfig;
  private owner: UILabel;
  private radius: number;
  private padding: Vector;
  private colors: UILabelColors;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the label graphic.
   * @param owner - The owning `UILabel` instance.
   * @param size - Size of the label (width,height) for rendering.
   * @param getState - Function that returns the current `UILabelState`.
   * @param labelConfig - Label configuration for styling and layout.
   */
  constructor(owner: UILabel, size: Vector, getState: () => UILabelState, labelConfig: UILabelConfig) {
    super({ width: size.x, height: size.y });
    this.owner = owner;
    this.size = size;
    this.getState = getState;
    this.config = labelConfig;

    this.cnv = document.createElement("canvas");
    this.cnv.width = size.x;
    this.cnv.height = size.y;
    this.ctx = this.cnv.getContext("2d")!;

    this.radius = labelConfig.labelRadius ?? 8;
    this.padding = labelConfig.padding ?? vec(8, 8);
    this.colors = {
      backgroundStarting: Color.Transparent,
      ...labelConfig.colors,
    };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UILabelGraphic {
    return new UILabelGraphic(this.owner, this.size, this.getState, this.config);
  }

  /**
   * Render the label to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const state = this.getState();
    const ctx = this.ctx;
    const cnv = this.cnv;

    if (!ctx || !cnv) return;

    ctx.clearRect(0, 0, this.size.x, this.size.y);

    const isEnabled = state !== "disabled";
    ctx.filter = isEnabled ? "none" : "grayscale(100%) brightness(0.7)";

    // Draw background if configured
    const bg = this.backgroundGradient(ctx, state);
    if (bg) {
      this.drawRoundedRect(ctx, 0, 0, this.size.x, this.size.y, this.radius, bg);
    }

    // Determine text color based on state
    let textColor = this.config.textOptions?.color?.toString() ?? this.colors.textColor?.toString() ?? "#000000";
    if (state === "hovered" && this.colors.textHoverColor) {
      textColor = this.colors.textHoverColor.toString();
    }

    ctx.fillStyle = textColor;
    ctx.strokeStyle = textColor;

    const font = this.config.textOptions?.font as Font | undefined;

    // Draw text
    drawText(ctx, this.owner.getText(), {
      x: this.padding.x,
      y: this.padding.y,
      width: this.size.x - this.padding.x * 2,
      height: this.size.y - this.padding.y * 2,
      fontSize: font?.size ?? 20,
      font: font?.family ?? "Arial",
      align: "left",
      vAlign: "top",
    });

    cnv.setAttribute("forceUpload", "true");
    ex.drawImage(cnv, x, y);
  }

  /**
   * Create a background gradient based on the current state.
   * @param ctx - Canvas rendering context used to create the gradient.
   * @param state - Current `UILabelState`.
   */
  private backgroundGradient(ctx: CanvasRenderingContext2D, state: UILabelState): CanvasGradient | null {
    const g = ctx.createLinearGradient(0, 0, 0, this.size.y);

    if (state === "hovered") {
      if (!this.colors.hoverStarting) return null;
      g.addColorStop(0, this.colors.hoverStarting.toString());
      g.addColorStop(1, (this.colors.hoverEnding ?? this.colors.hoverStarting).toString());
      return g;
    }

    if (state === "disabled") {
      if (!this.colors.disabledStarting) return null;
      g.addColorStop(0, this.colors.disabledStarting.toString());
      g.addColorStop(1, (this.colors.disabledEnding ?? this.colors.disabledStarting).toString());
      return g;
    }

    // Idle state
    if (!this.colors.backgroundStarting || this.colors.backgroundStarting.equal(Color.Transparent)) return null;

    g.addColorStop(0, this.colors.backgroundStarting.toString());
    g.addColorStop(1, (this.colors.backgroundEnding ?? this.colors.backgroundStarting).toString());
    return g;
  }

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
}

// #region Events

/** Event emitted when the label's text changes. */
export class UILabelTextChanged extends GameEvent<UILabel> {
  constructor(
    public target: UILabel,
    public text: string,
  ) {
    super();
  }
}

/** Event emitted when the pointer enters the label. */
export class UILabelHovered extends GameEvent<UILabel> {
  constructor(public target: UILabel) {
    super();
  }
}

/** Event emitted when the pointer leaves the label. */
export class UILabelUnhovered extends GameEvent<UILabel> {
  constructor(public target: UILabel) {
    super();
  }
}

/** Event emitted when the label is enabled. */
export class UILabelEnabled extends GameEvent<UILabel> {
  constructor(public target: UILabel) {
    super();
  }
}

/** Event emitted when the label is disabled. */
export class UILabelDisabled extends GameEvent<UILabel> {
  constructor(public target: UILabel) {
    super();
  }
}

// #endregion Events
