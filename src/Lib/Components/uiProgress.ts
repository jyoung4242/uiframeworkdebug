import { Color, Engine, EventEmitter, ExcaliburGraphicsContext, GameEvent, Graphic, Sprite, vec, Vector } from "excalibur";
import { BaseUIConfig, DisplayUIComponent } from "./uiComponent";

/**
 * Orientation of the progress bar.
 */
export type UIProgressBarOrientation = "horizontal" | "vertical";

/**
 * Event map emitted by `UIProgressBar`.
 * Each property corresponds to a specific event payload type.
 */
export type UIProgressBarEvents = {
  UIProgressBarChanged: UIProgressBarChanged;
  UIProgressBarComplete: UIProgressBarComplete;
  UIProgressBarEmpty: UIProgressBarEmpty;
  UIProgressBarEnabled: UIProgressBarEnabled;
  UIProgressBarDisabled: UIProgressBarDisabled;
};

// #region Standard Progress Bar

/**
 * Configuration options for `UIProgressBar`.
 */
export type UIProgressBarConfig = BaseUIConfig & {
  /** Minimum value (default: 0). */
  min?: number;
  /** Maximum value (default: 100). */
  max?: number;
  /** Current value (will be clamped to min/max). */
  value?: number;
  /** Bar orientation: horizontal or vertical. */
  orientation?: UIProgressBarOrientation;
  /** Corner radius for rounded edges. */
  trackRadius?: number;
  /** Color configuration for the progress bar. */
  colors?: UIProgressBarColors;
  /** Whether to display percentage text overlay. */
  showPercentage?: boolean;
  /** Color of the percentage text. */
  percentageTextColor?: Color;
  /** Font size of the percentage text. */
  percentageTextSize?: number;
};

/** Default configuration values for `UIProgressBar`. */
const defaultProgressBarConfig: UIProgressBarConfig = {
  name: "UIProgressBar",
  width: 200,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  min: 0,
  max: 100,
  value: 50,
  orientation: "horizontal",
  trackRadius: 6,
  colors: {
    track: Color.DarkGray,
    fill: Color.fromHex("#4CAF50"),
    border: Color.Transparent,
    disabled: Color.Gray,
  },
  showPercentage: false,
  percentageTextColor: Color.White,
  percentageTextSize: 12,
};

/**
 * Color configuration for `UIProgressBar`.
 */
type UIProgressBarColors = {
  /** Background track color. */
  track?: Color;
  /** Progress fill color. */
  fill?: Color;
  /** Border color (optional). */
  border?: Color;
  /** Color when disabled. */
  disabled?: Color;
};

/**
 * A progress bar UI component that displays a value as a filled bar.
 *
 * Supports horizontal and vertical orientations, percentage text overlay,
 * and emits events when progress changes or reaches completion/empty states.
 */
export class UIProgressBar extends DisplayUIComponent<UIProgressBarConfig, UIProgressBarEvents> {
  /** Minimum allowed value. */
  private min: number;
  /** Maximum allowed value. */
  private max: number;
  /** Current progress value. */
  private _value: number;

  /**
   * Create a new UIProgressBar.
   * @param progressBarConfig - Partial configuration; defaults will be applied.
   */
  constructor(progressBarConfig: Partial<UIProgressBarConfig>) {
    const localConfig = { ...defaultProgressBarConfig, ...progressBarConfig };
    super(localConfig);

    this._config = localConfig;
    this.min = localConfig.min ?? 0;
    this.max = localConfig.max ?? 100;
    this._value = this.clampValue(localConfig.value ?? 50);

    this.graphics.use(new UIProgressBarGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
  }

  /**
   * Called when the progress bar is added to the engine.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    // No event handlers needed for display component
  }

  /**
   * Called when the progress bar is removed from the engine.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    // Cleanup if needed
  }

  /**
   * Clamp a value between min and max.
   * @param value - Value to clamp.
   */
  private clampValue(value: number): number {
    return Math.max(this.min, Math.min(value, this.max));
  }

  /**
   * Set the progress value. Emits change, complete, and empty events as appropriate.
   * @param v - New value (will be clamped to min/max).
   */
  set value(v: number) {
    const clamped = this.clampValue(v);
    const oldValue = this._value;

    if (clamped !== this._value) {
      this._value = clamped;
      const percent = this.percent;

      this.emitter.emit("UIProgressBarChanged", {
        name: this.name,
        target: this,
        event: "changed",
        value: this._value,
        percent,
      });

      // Check for complete
      if (oldValue < this.max && this._value >= this.max) {
        this.emitter.emit("UIProgressBarComplete", { name: this.name, target: this, event: "complete" });
      }

      // Check for empty
      if (oldValue > this.min && this._value <= this.min) {
        this.emitter.emit("UIProgressBarEmpty", { name: this.name, target: this, event: "empty" });
      }
    }
  }

  /**
   * Get the current progress value.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get the progress as a percentage (0.0 to 1.0).
   */
  get percent(): number {
    const range = this.max - this.min;
    if (range === 0) return 0;
    return (this._value - this.min) / range;
  }

  /**
   * Increment the progress by a specified amount.
   * @param amount - Amount to increment (default: 1).
   */
  increment(amount: number = 1): void {
    this.value = this._value + amount;
  }

  /**
   * Decrement the progress by a specified amount.
   * @param amount - Amount to decrement (default: 1).
   */
  decrement(amount: number = 1): void {
    this.value = this._value - amount;
  }

  /**
   * Reset progress to minimum value.
   */
  reset(): void {
    this.value = this.min;
  }

  /**
   * Set progress to maximum value (complete).
   */
  complete(): void {
    this.value = this.max;
  }

  /**
   * Set the minimum allowed value and re-clamp current value if needed.
   * @param min - New minimum value.
   */
  setMin(min: number): void {
    this.min = min;
    this.value = this._value; // Re-clamp
  }

  /**
   * Set the maximum allowed value and re-clamp current value if needed.
   * @param max - New maximum value.
   */
  setMax(max: number): void {
    this.max = max;
    this.value = this._value; // Re-clamp
  }

  /**
   * Set both min and max range.
   * @param min - New minimum value.
   * @param max - New maximum value.
   */
  setRange(min: number, max: number): void {
    this.min = min;
    this.max = max;
    this.value = this._value; // Re-clamp
  }

  /**
   * Get the minimum value.
   */
  getMin(): number {
    return this.min;
  }

  /**
   * Get the maximum value.
   */
  getMax(): number {
    return this.max;
  }

  /**
   * Called when the progress bar is enabled.
   * Emits `UIProgressBarEnabled`.
   */
  protected onEnabled(): void {
    this.emitter.emit("UIProgressBarEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Called when the progress bar is disabled.
   * Emits `UIProgressBarDisabled`.
   */
  protected onDisabled(): void {
    this.emitter.emit("UIProgressBarDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Get the progress bar's event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }
}

/**
 * Graphic implementation for rendering a `UIProgressBar` to a canvas.
 * Handles drawing track, fill, border, and optional percentage text.
 */
class UIProgressBarGraphic extends Graphic {
  private owner: UIProgressBar;
  private config: UIProgressBarConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /**
   * Create the progress bar graphic.
   * @param owner - The owning `UIProgressBar` instance.
   * @param config - Progress bar configuration for styling.
   */
  constructor(owner: UIProgressBar, config: UIProgressBarConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width;
    this.cnv.height = config.height;
    this.ctx = this.cnv.getContext("2d")!;
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UIProgressBarGraphic {
    return new UIProgressBarGraphic(this.owner, this.config);
  }

  /**
   * Render the progress bar to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.cnv.width, this.cnv.height);

    const percent = this.owner.percent;
    const horizontal = this.config.orientation === "horizontal";
    const trackRadius = this.config.trackRadius ?? 6;
    const isEnabled = this.owner.isEnabled;

    const colors = {
      track: Color.DarkGray,
      fill: Color.fromHex("#4CAF50"),
      border: Color.Transparent,
      disabled: Color.Gray,
      ...this.config.colors,
    };

    // Apply disabled filter
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    }

    // ---- TRACK (background) ----
    ctx.beginPath();
    ctx.fillStyle = colors.track.toString();
    ctx.roundRect(0, 0, this.config.width, this.config.height, trackRadius);
    ctx.fill();

    // ---- FILL (progress) ----
    ctx.beginPath();
    ctx.fillStyle = colors.fill.toString();
    if (horizontal) {
      const fillWidth = this.config.width * percent;
      if (fillWidth > 0) {
        ctx.roundRect(0, 0, fillWidth, this.config.height, trackRadius);
      }
    } else {
      // Vertical fill - from bottom up
      const fillHeight = this.config.height * percent;
      if (fillHeight > 0) {
        ctx.roundRect(0, this.config.height - fillHeight, this.config.width, fillHeight, trackRadius);
      }
    }
    ctx.fill();

    // ---- BORDER (optional) ----
    if (colors.border && colors.border.a > 0) {
      ctx.beginPath();
      ctx.strokeStyle = colors.border.toString();
      ctx.lineWidth = 2;
      ctx.roundRect(0, 0, this.config.width, this.config.height, trackRadius);
      ctx.stroke();
    }

    // ---- PERCENTAGE TEXT ----
    if (this.config.showPercentage && isEnabled) {
      const percentText = `${Math.round(percent * 100)}%`;
      const fontSize = this.config.percentageTextSize ?? 12;

      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = this.config.percentageTextColor?.toString() ?? Color.White.toString();

      // Add text shadow for better readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(percentText, this.config.width / 2, this.config.height / 2);

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x, y);
  }
}
// #endregion Standard Progress Bar

// #region Sprite Progress Bar

/**
 * Configuration options for a sprite-based `UISpriteProgressBar`.
 */
export type UISpriteProgressBarConfig = BaseUIConfig & {
  /** Minimum value (default: 0). */
  min?: number;
  /** Maximum value (default: 100). */
  max?: number;
  /** Current value (will be clamped to min/max). */
  value?: number;
  /** Bar orientation: horizontal or vertical. */
  orientation?: UIProgressBarOrientation;
  /** Sprites for different progress bar layers. */
  sprites?: {
    track?: Sprite;
    fill?: Sprite;
    border?: Sprite;
  };
  /** Whether to display percentage text overlay. */
  showPercentage?: boolean;
  /** Color of the percentage text. */
  percentageTextColor?: Color;
  /** Font size of the percentage text. */
  percentageTextSize?: number;
};

/** Default configuration values for `UISpriteProgressBar`. */
const defaultSpriteProgressBarConfig: UISpriteProgressBarConfig = {
  name: "UISpriteProgressBar",
  width: 200,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  min: 0,
  max: 100,
  value: 50,
  orientation: "horizontal",
  sprites: {
    track: null,
    fill: null,
    border: null,
  },
  showPercentage: false,
  percentageTextColor: Color.White,
  percentageTextSize: 12,
};

/**
 * A sprite-based progress bar that uses images for visual representation.
 *
 * Supports horizontal and vertical orientations with separate sprites for
 * track (background), fill (progress), and border (foreground overlay).
 */
export class UISpriteProgressBar extends DisplayUIComponent<UISpriteProgressBarConfig, UIProgressBarEvents> {
  /** Minimum allowed value. */
  private min: number;
  /** Maximum allowed value. */
  private max: number;
  /** Current progress value. */
  private _value: number;

  trackSprite: Sprite | null = null;
  fillSprite: Sprite | null = null;
  borderSprite: Sprite | null = null;

  /**
   * Create a new UISpriteProgressBar.
   * @param progressBarConfig - Partial configuration; defaults will be applied.
   */
  constructor(progressBarConfig: Partial<UISpriteProgressBarConfig>) {
    const localConfig = { ...defaultSpriteProgressBarConfig, ...progressBarConfig };
    super(localConfig);

    this._config = localConfig;
    this.min = localConfig.min ?? 0;
    this.max = localConfig.max ?? 100;
    this._value = this.clampValue(localConfig.value ?? 50);

    this.graphics.use(new UISpriteProgressBarGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
    this.trackSprite = localConfig.sprites?.track ?? null;
    this.fillSprite = localConfig.sprites?.fill ?? null;
    this.borderSprite = localConfig.sprites?.border ?? null;
  }

  /**
   * Called when the progress bar is added to the engine.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    // No event handlers needed for display component
  }

  /**
   * Called when the progress bar is removed from the engine.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    // Cleanup if needed
  }

  /**
   * Clamp a value between min and max.
   * @param value - Value to clamp.
   */
  private clampValue(value: number): number {
    return Math.max(this.min, Math.min(value, this.max));
  }

  /**
   * Set the progress value. Emits change, complete, and empty events as appropriate.
   * @param v - New value (will be clamped to min/max).
   */
  set value(v: number) {
    const clamped = this.clampValue(v);
    const oldValue = this._value;

    if (clamped !== this._value) {
      this._value = clamped;
      const percent = this.percent;

      this.emitter.emit("UIProgressBarChanged", {
        name: this.name,
        target: this,
        event: "changed",
        value: this._value,
        percent,
      });

      // Check for complete
      if (oldValue < this.max && this._value >= this.max) {
        this.emitter.emit("UIProgressBarComplete", { name: this.name, target: this, event: "complete" });
      }

      // Check for empty
      if (oldValue > this.min && this._value <= this.min) {
        this.emitter.emit("UIProgressBarEmpty", { name: this.name, target: this, event: "empty" });
      }
    }
  }

  /**
   * Get the current progress value.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get the progress as a percentage (0.0 to 1.0).
   */
  get percent(): number {
    const range = this.max - this.min;
    if (range === 0) return 0;
    return (this._value - this.min) / range;
  }

  /**
   * Increment the progress by a specified amount.
   * @param amount - Amount to increment (default: 1).
   */
  increment(amount: number = 1): void {
    this.value = this._value + amount;
  }

  /**
   * Decrement the progress by a specified amount.
   * @param amount - Amount to decrement (default: 1).
   */
  decrement(amount: number = 1): void {
    this.value = this._value - amount;
  }

  /**
   * Reset progress to minimum value.
   */
  reset(): void {
    this.value = this.min;
  }

  /**
   * Set progress to maximum value (complete).
   */
  complete(): void {
    this.value = this.max;
  }

  /**
   * Set the minimum allowed value and re-clamp current value if needed.
   * @param min - New minimum value.
   */
  setMin(min: number): void {
    this.min = min;
    this.value = this._value; // Re-clamp
  }

  /**
   * Set the maximum allowed value and re-clamp current value if needed.
   * @param max - New maximum value.
   */
  setMax(max: number): void {
    this.max = max;
    this.value = this._value; // Re-clamp
  }

  /**
   * Set both min and max range.
   * @param min - New minimum value.
   * @param max - New maximum value.
   */
  setRange(min: number, max: number): void {
    this.min = min;
    this.max = max;
    this.value = this._value; // Re-clamp
  }

  /**
   * Get the minimum value.
   */
  getMin(): number {
    return this.min;
  }

  /**
   * Get the maximum value.
   */
  getMax(): number {
    return this.max;
  }

  /**
   * Called when the progress bar is enabled.
   * Emits `UIProgressBarEnabled`.
   */
  protected onEnabled(): void {
    this.emitter.emit("UIProgressBarEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Called when the progress bar is disabled.
   * Emits `UIProgressBarDisabled`.
   */
  protected onDisabled(): void {
    this.emitter.emit("UIProgressBarDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Get the progress bar's event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }
}

/**
 * Graphic implementation for rendering a `UISpriteProgressBar` using sprites.
 * Handles drawing sprite layers with proper clipping for progress indication.
 */
class UISpriteProgressBarGraphic extends Graphic {
  private owner: UISpriteProgressBar;
  private config: UISpriteProgressBarConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;

  /**
   * Create the sprite progress bar graphic.
   * @param owner - The owning `UISpriteProgressBar` instance.
   * @param config - Sprite progress bar configuration.
   */
  constructor(owner: UISpriteProgressBar, config: UISpriteProgressBarConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width;
    this.cnv.height = config.height;
    this.ctx = this.cnv.getContext("2d")!;
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UISpriteProgressBarGraphic {
    return new UISpriteProgressBarGraphic(this.owner, this.config);
  }

  /**
   * Render the sprite progress bar to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const percent = this.owner.percent;
    const horizontal = this.config.orientation === "horizontal";
    const sprites = this.config.sprites ?? {};
    const isEnabled = this.owner.isEnabled;

    ctx.clearRect(0, 0, this.config.width, this.config.height);

    // Apply disabled filter if needed
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    // ---- TRACK (background) ----
    if (sprites.track) {
      ctx.drawImage(sprites.track.image.image, 0, 0, this.config.width, this.config.height);
    }

    // ---- FILL (progress indicator) ----
    if (sprites.fill) {
      if (horizontal) {
        const fillWidth = this.config.width * percent;
        if (fillWidth > 0) {
          // Draw only the filled portion by clipping the source image
          ctx.drawImage(
            sprites.fill.image.image,
            0,
            0, // source x, y
            sprites.fill.width * percent,
            sprites.fill.height, // source width, height (clipped)
            0,
            0, // dest x, y
            fillWidth,
            this.config.height, // dest width, height
          );
        }
      } else {
        const fillHeight = this.config.height * percent;
        if (fillHeight > 0) {
          // Draw from bottom up
          ctx.drawImage(
            sprites.fill.image.image,
            0,
            sprites.fill.height * (1 - percent), // source x, y (start from bottom portion)
            sprites.fill.width,
            sprites.fill.height * percent, // source width, height (clipped)
            0,
            this.config.height - fillHeight, // dest x, y (position at bottom)
            this.config.width,
            fillHeight, // dest width, height
          );
        }
      }
    }

    // ---- BORDER (optional foreground/border sprite) ----
    if (sprites.border) {
      ctx.drawImage(sprites.border.image.image, 0, 0, this.config.width, this.config.height);
    }

    // ---- PERCENTAGE TEXT ----
    if (this.config.showPercentage && isEnabled) {
      const percentText = `${Math.round(percent * 100)}%`;
      const fontSize = this.config.percentageTextSize ?? 12;

      ctx.font = `${fontSize}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = this.config.percentageTextColor?.toString() ?? Color.White.toString();

      // Add text shadow for better readability
      ctx.shadowColor = "rgba(0, 0, 0, 0.5)";
      ctx.shadowBlur = 2;
      ctx.shadowOffsetX = 1;
      ctx.shadowOffsetY = 1;

      ctx.fillText(percentText, this.config.width / 2, this.config.height / 2);

      // Reset shadow
      ctx.shadowColor = "transparent";
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
    }

    ctx.filter = "none";

    this.cnv.setAttribute("forceUpload", "true");
    ex.drawImage(this.cnv, x, y);
  }
}
// #endregion Sprite Progress Bar

// #region Events

/** Event emitted when the progress value changes. */
export class UIProgressBarChanged extends GameEvent<UIProgressBar | UISpriteProgressBar> {
  constructor(
    public target: UIProgressBar | UISpriteProgressBar,
    public value: number,
    public percent: number,
  ) {
    super();
  }
}

/** Event emitted when progress reaches maximum (complete). */
export class UIProgressBarComplete extends GameEvent<UIProgressBar | UISpriteProgressBar> {
  constructor(public target: UIProgressBar | UISpriteProgressBar) {
    super();
  }
}

/** Event emitted when progress reaches minimum (empty). */
export class UIProgressBarEmpty extends GameEvent<UIProgressBar | UISpriteProgressBar> {
  constructor(public target: UIProgressBar | UISpriteProgressBar) {
    super();
  }
}

/** Event emitted when the progress bar is enabled. */
export class UIProgressBarEnabled extends GameEvent<UIProgressBar | UISpriteProgressBar> {
  constructor(public target: UIProgressBar | UISpriteProgressBar) {
    super();
  }
}

/** Event emitted when the progress bar is disabled. */
export class UIProgressBarDisabled extends GameEvent<UIProgressBar | UISpriteProgressBar> {
  constructor(public target: UIProgressBar | UISpriteProgressBar) {
    super();
  }
}

// #endregion Events
