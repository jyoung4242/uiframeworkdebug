import {
  clamp,
  Color,
  Engine,
  EventEmitter,
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
import { BaseUIConfig, InteractiveUIComponent, IFocusable } from "./uiComponent";

/**
 * Orientation of the slider.
 */
export type UISliderOrientation = "horizontal" | "vertical";

/**
 * Event map emitted by `UISlider` and `UISpriteSlider`.
 * Each property corresponds to a specific event payload type.
 */
export type UISliderEvents = {
  UISliderChanged: UISliderChanged;
  UISliderFocused: UISliderFocused;
  UISliderUnfocused: UISliderUnfocused;
  UISliderDown: UISliderDown;
  UISliderUp: UISliderUp;
  UISliderEnabled: UISliderEnabled;
  UISliderDisabled: UISliderDisabled;
};

// #region Standard Slider

/**
 * Configuration options for `UISlider`.
 */
export type UISliderConfig = BaseUIConfig & {
  /** Minimum value (default: 0). */
  min?: number;
  /** Maximum value (default: 100). */
  max?: number;
  /** Current value (will be clamped to min/max). */
  value?: number;
  /** Step size for value changes (default: 1). */
  step?: number;
  /** Slider orientation: horizontal or vertical. */
  orientation?: UISliderOrientation;
  /** Corner radius for the track. */
  trackRadius?: number;
  /** Radius of the knob circle. */
  knobRadius?: number;
  /** Color configuration for the slider. */
  colors?: UISliderColors;
  /** Position of the focus indicator dot. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation. */
  tabStopIndex?: number;
};

/** Default configuration values for `UISlider`. */
const defaultSliderConfig: UISliderConfig = {
  name: "UISlider",
  width: 200,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  min: 0,
  max: 100,
  value: 50,
  step: 1,
  orientation: "horizontal",
  trackRadius: 6,
  knobRadius: 10,
  colors: {
    track: Color.DarkGray,
    fill: Color.LightGray,
    knob: Color.White,
  },
  focusIndicator: vec(5, 5),
};

/**
 * Color configuration for `UISlider`.
 */
type UISliderColors = {
  /** Background track color. */
  track?: Color;
  /** Progress fill color. */
  fill?: Color;
  /** Knob color. */
  knob?: Color;
  /** Color when disabled. */
  disabled?: Color;
};

/**
 * A slider UI component for selecting numeric values within a range.
 *
 * Supports horizontal and vertical orientations, keyboard navigation,
 * and emits events when the value changes or when focused/unfocused.
 * Implements `IFocusable` for keyboard interaction.
 */
export class UISlider extends InteractiveUIComponent<UISliderConfig, UISliderEvents> {
  /** Whether the slider is currently being dragged. */
  private dragging = false;
  /** Position of the focus indicator. */
  private focusPosition: Vector;

  /** Minimum allowed value. */
  private min: number;
  /** Maximum allowed value. */
  private max: number;
  /** Step size for value changes. */
  private step: number;
  /** Current slider value. */
  private _value: number;

  /**
   * Create a new UISlider.
   * @param sliderConfig - Partial configuration; defaults will be applied.
   */
  constructor(sliderConfig: Partial<UISliderConfig>) {
    const localConfig = { ...defaultSliderConfig, ...sliderConfig };
    super(localConfig);
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    this._config = localConfig;
    this.focusPosition = localConfig.focusIndicator ?? vec(5, 5);
    this.min = localConfig.min ?? 0;
    this.max = localConfig.max ?? 100;
    this.step = localConfig.step ?? 1;
    this._value = this.clampValue(localConfig.value ?? 50);

    this.graphics.use(new UISliderGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
  }

  /**
   * Called when the slider is added to the engine.
   * Registers pointer and keyboard event handlers.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerdown", this.onPointerDown);
    this.on("pointermove", this.onPointerMove);
    this.on("pointerup", this.onPointerUp);

    engine.input.keyboard.on("press", this.onKeyDown);
  }

  /**
   * Called when the slider is removed from the engine.
   * Unregisters event handlers.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerdown", this.onPointerDown);
    this.off("pointermove", this.onPointerMove);
    this.off("pointerup", this.onPointerUp);

    engine.input.keyboard.off("press", this.onKeyDown);
  }

  /**
   * Clamp a value between min and max.
   * @param value - Value to clamp.
   */
  private clampValue(value: number): number {
    return clamp(value, this.min, this.max);
  }

  /**
   * Pointer down handler.
   * Begins dragging and updates value from pointer position.
   */
  private onPointerDown = (e: PointerEvent): void => {
    if (!this.isEnabled) return;

    this.dragging = true;
    this.updateValueFromPointer(e.worldPos);
    this.emitter.emit("UISliderDown", { name: this.name, target: this, event: "down" });
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer move handler.
   * Updates value while dragging.
   */
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.updateValueFromPointer(e.worldPos);
  };

  /**
   * Pointer up handler.
   * Stops dragging.
   */
  private onPointerUp = (): void => {
    if (this.dragging) {
      this.dragging = false;
      this.emitter.emit("UISliderUp", { name: this.name, target: this, event: "up" });
    }
  };

  /**
   * Keyboard press handler.
   * Handles arrow key navigation when focused.
   */
  private onKeyDown = (e: KeyEvent): void => {
    if (!this._isFocused || !this.isEnabled) return;

    if (e.key === Keys.Left || e.key === Keys.Down) {
      this.value -= this.step;
    } else if (e.key === Keys.Right || e.key === Keys.Up) {
      this.value += this.step;
    }
  };

  /**
   * Update the slider value based on pointer position.
   * @param worldPos - World position of the pointer.
   */
  private updateValueFromPointer(worldPos: Vector): void {
    const local = worldPos.sub(this.pos);

    let t: number;
    if (this._config.orientation === "horizontal") {
      t = clamp(local.x / this.width, 0, 1);
    } else {
      t = 1 - clamp(local.y / this.height, 0, 1);
    }

    this.value = this.min + t * (this.max - this.min);
  }

  /**
   * Set the slider value. Automatically snaps to step and clamps to range.
   * Emits `UISliderChanged` if the value changes.
   * @param v - New value.
   */
  set value(v: number) {
    const stepped = Math.round(v / this.step) * this.step;
    const clamped = this.clampValue(stepped);

    if (clamped !== this._value) {
      this._value = clamped;
      this.emitter.emit("UISliderChanged", {
        name: this.name,
        target: this,
        event: "changed",
        value: this._value,
        percent: this.percent,
      });
    }
  }

  /**
   * Get the current slider value.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get the slider position as a percentage (0.0 to 1.0).
   */
  get percent(): number {
    const range = this.max - this.min;
    if (range === 0) return 0;
    return (this._value - this.min) / range;
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
   * Set the step size for value changes.
   * @param step - New step size.
   */
  setStep(step: number): void {
    this.step = step;
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
   * Get the step size.
   */
  getStep(): number {
    return this.step;
  }

  /**
   * Focus the slider, enabling keyboard navigation.
   * Emits `UISliderFocused`.
   */
  focus(): void {
    if (!this._isFocused) {
      this._isFocused = true;
      this.emitter.emit("UISliderFocused", { name: this.name, target: this, event: "focused" });
    }
  }

  /**
   * Remove focus from the slider, disabling keyboard navigation.
   * Emits `UISliderUnfocused`.
   */
  loseFocus(): void {
    if (this._isFocused) {
      this._isFocused = false;
      this.emitter.emit("UISliderUnfocused", { name: this.name, target: this, event: "unfocused" });
    }
  }

  /**
   * Whether the slider is currently focused.
   */
  get isFocused(): boolean {
    return this._isFocused;
  }

  /**
   * Called when the slider is enabled.
   * Emits `UISliderEnabled`.
   */
  protected onEnabled(): void {
    this.emitter.emit("UISliderEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Called when the slider is disabled.
   * Stops dragging and emits `UISliderDisabled`.
   */
  protected onDisabled(): void {
    this.dragging = false;
    this.emitter.emit("UISliderDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Get the slider's event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }
}

/**
 * Graphic implementation for rendering a `UISlider` to a canvas.
 * Handles drawing track, fill, knob, and focus indicator.
 */
class UISliderGraphic extends Graphic {
  private owner: UISlider;
  private config: UISliderConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private focusPosition: Vector;

  /**
   * Create the slider graphic.
   * @param owner - The owning `UISlider` instance.
   * @param config - Slider configuration for styling.
   */
  constructor(owner: UISlider, config: UISliderConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    const knobRadius = config.knobRadius ?? 10;
    const padding = knobRadius + 2; // Extra padding for knob overhang

    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width + padding * 2;
    this.cnv.height = config.height + padding * 2;
    this.ctx = this.cnv.getContext("2d")!;
    this.focusPosition = config.focusIndicator ?? vec(5, 5);
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UISliderGraphic {
    return new UISliderGraphic(this.owner, this.config);
  }

  /**
   * Render the slider to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const knobRadius = this.config.knobRadius ?? 10;
    const padding = knobRadius + 2;

    ctx.filter = "none";
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, this.cnv.width, this.cnv.height);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    const percent = this.owner.percent;
    const horizontal = this.config.orientation === "horizontal";
    const trackRadius = this.config.trackRadius ?? 6;
    const isEnabled = this.owner.isEnabled;
    const isFocused = this.owner.isFocused;

    const colors = {
      track: Color.DarkGray,
      fill: Color.LightGray,
      knob: Color.White,
      disabled: Color.Gray,
      ...this.config.colors,
    };

    // Apply disabled filter
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    }

    // ---- TRACK ----
    ctx.beginPath();
    ctx.fillStyle = colors.track.toString();
    if (horizontal) {
      ctx.roundRect(0, this.config.height / 2 - 4, this.config.width, 8, trackRadius);
    } else {
      // Vertical track
      ctx.roundRect(this.config.width / 2 - 4, 0, 8, this.config.height, trackRadius);
    }
    ctx.fill();

    // ---- FILL ----
    ctx.beginPath();
    ctx.fillStyle = colors.fill.toString();
    if (horizontal) {
      const fillWidth = this.config.width * percent;
      if (fillWidth > 0) {
        ctx.roundRect(0, this.config.height / 2 - 4, fillWidth, 8, trackRadius);
      }
    } else {
      // Vertical fill - from bottom up
      const h = this.config.height * percent;
      if (h > 0) {
        ctx.roundRect(this.config.width / 2 - 4, this.config.height - h, 8, h, trackRadius);
      }
    }
    ctx.fill();

    // ---- KNOB ----
    const knobX = horizontal ? this.config.width * percent : this.config.width / 2;
    const knobY = horizontal ? this.config.height / 2 : this.config.height * (1 - percent);

    ctx.beginPath();
    ctx.fillStyle = colors.knob.toString();
    ctx.strokeStyle = colors.knob.toString();
    ctx.arc(knobX, knobY, knobRadius, 0, Math.PI * 2);
    ctx.fill();

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
// #endregion Standard Slider

// #region Sprite Slider

/**
 * Configuration options for a sprite-based `UISpriteSlider`.
 */
export type UISpriteSliderConfig = BaseUIConfig & {
  /** Minimum value (default: 0). */
  min?: number;
  /** Maximum value (default: 100). */
  max?: number;
  /** Current value (will be clamped to min/max). */
  value?: number;
  /** Step size for value changes (default: 1). */
  step?: number;
  /** Slider orientation: horizontal or vertical. */
  orientation?: UISliderOrientation;
  /** Sprites for different slider components. */
  sprites?: {
    track?: Sprite;
    fill?: Sprite;
    knob?: Sprite;
    border?: Sprite;
  };
  /** Position of the focus indicator dot. */
  focusIndicator?: Vector;
  /** Tab stop index for keyboard navigation. */
  tabStopIndex?: number;
};

/** Default configuration values for `UISpriteSlider`. */
const defaultSpriteSliderConfig: UISpriteSliderConfig = {
  name: "UISpriteSlider",
  width: 200,
  height: 24,
  pos: vec(0, 0),
  z: 1,
  min: 0,
  max: 100,
  value: 50,
  step: 1,
  orientation: "horizontal",
  sprites: {
    track: null,
    fill: null,
    knob: null,
    border: null,
  },
  focusIndicator: vec(5, 5),
};

/**
 * A sprite-based slider that uses images for visual representation.
 *
 * Supports horizontal and vertical orientations with separate sprites for
 * track (background), fill (progress), knob (draggable handle), and border.
 */
export class UISpriteSlider extends InteractiveUIComponent<UISpriteSliderConfig, UISliderEvents> implements IFocusable {
  /** Whether the slider is currently being dragged. */
  private dragging = false;
  /** Whether the slider is currently focused. */
  _isFocused = false;
  /** Position of the focus indicator. */
  private focusPosition: Vector;

  /** Minimum allowed value. */
  private min: number;
  /** Maximum allowed value. */
  private max: number;
  /** Step size for value changes. */
  private step: number;
  /** Current slider value. */
  private _value: number;

  /**
   * Create a new UISpriteSlider.
   * @param sliderConfig - Partial configuration; defaults will be applied.
   */
  constructor(sliderConfig: Partial<UISpriteSliderConfig>) {
    const localConfig = { ...defaultSpriteSliderConfig, ...sliderConfig };
    super(localConfig);

    this._config = localConfig;
    this.focusPosition = localConfig.focusIndicator ?? vec(5, 5);
    this.min = localConfig.min ?? 0;
    this.max = localConfig.max ?? 100;
    this.step = localConfig.step ?? 1;
    this._value = this.clampValue(localConfig.value ?? 50);
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    this.graphics.use(new UISpriteSliderGraphic(this, localConfig));
    this.pointer.useGraphicsBounds = true;
  }

  /**
   * Called when the slider is added to the engine.
   * Registers pointer and keyboard event handlers.
   * @param engine - The engine instance.
   */
  onAdd(engine: Engine): void {
    this.on("pointerdown", this.onPointerDown);
    this.on("pointermove", this.onPointerMove);
    this.on("pointerup", this.onPointerUp);

    engine.input.keyboard.on("press", this.onKeyDown);
  }

  /**
   * Called when the slider is removed from the engine.
   * Unregisters event handlers.
   * @param engine - The engine instance.
   */
  onRemove(engine: Engine): void {
    this.off("pointerdown", this.onPointerDown);
    this.off("pointermove", this.onPointerMove);
    this.off("pointerup", this.onPointerUp);

    engine.input.keyboard.off("press", this.onKeyDown);
  }

  /**
   * Clamp a value between min and max.
   * @param value - Value to clamp.
   */
  private clampValue(value: number): number {
    return clamp(value, this.min, this.max);
  }

  /**
   * Pointer down handler.
   * Begins dragging and updates value from pointer position.
   */
  private onPointerDown = (e: PointerEvent): void => {
    if (!this.isEnabled) return;

    this.dragging = true;
    this.updateValueFromPointer(e.worldPos);
    this.emitter.emit("UISliderDown", { name: this.name, target: this, event: "down" });
    if (this.manager) this.manager.setFocus(this);
  };

  /**
   * Pointer move handler.
   * Updates value while dragging.
   */
  private onPointerMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    this.updateValueFromPointer(e.worldPos);
  };

  /**
   * Pointer up handler.
   * Stops dragging.
   */
  private onPointerUp = (): void => {
    if (this.dragging) {
      this.dragging = false;
      this.emitter.emit("UISliderUp", { name: this.name, target: this, event: "up" });
    }
  };

  /**
   * Keyboard press handler.
   * Handles arrow key navigation when focused.
   */
  private onKeyDown = (e: KeyEvent): void => {
    if (!this._isFocused || !this.isEnabled) return;

    if (e.key === Keys.Left || e.key === Keys.Down) {
      this.value -= this.step;
    } else if (e.key === Keys.Right || e.key === Keys.Up) {
      this.value += this.step;
    }
  };

  /**
   * Update the slider value based on pointer position.
   * @param worldPos - World position of the pointer.
   */
  private updateValueFromPointer(worldPos: Vector): void {
    const local = worldPos.sub(this.pos);

    let t: number;
    if (this._config.orientation === "horizontal") {
      t = clamp(local.x / this.width, 0, 1);
    } else {
      t = 1 - clamp(local.y / this.height, 0, 1);
    }

    this.value = this.min + t * (this.max - this.min);
  }

  /**
   * Set the slider value. Automatically snaps to step and clamps to range.
   * Emits `UISliderChanged` if the value changes.
   * @param v - New value.
   */
  set value(v: number) {
    const stepped = Math.round(v / this.step) * this.step;
    const clamped = this.clampValue(stepped);

    if (clamped !== this._value) {
      this._value = clamped;
      this.emitter.emit("UISliderChanged", {
        name: this.name,
        target: this,
        event: "changed",
        value: this._value,
        percent: this.percent,
      });
    }
  }

  /**
   * Get the current slider value.
   */
  get value(): number {
    return this._value;
  }

  /**
   * Get the slider position as a percentage (0.0 to 1.0).
   */
  get percent(): number {
    const range = this.max - this.min;
    if (range === 0) return 0;
    return (this._value - this.min) / range;
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
   * Set the step size for value changes.
   * @param step - New step size.
   */
  setStep(step: number): void {
    this.step = step;
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
   * Get the step size.
   */
  getStep(): number {
    return this.step;
  }

  /**
   * Focus the slider, enabling keyboard navigation.
   * Emits `UISliderFocused`.
   */
  focus(): void {
    if (!this._isFocused) {
      this._isFocused = true;
      this.emitter.emit("UISliderFocused", { name: this.name, target: this, event: "focused" });
    }
  }

  /**
   * Remove focus from the slider, disabling keyboard navigation.
   * Emits `UISliderUnfocused`.
   */
  loseFocus(): void {
    if (this._isFocused) {
      this._isFocused = false;
      this.emitter.emit("UISliderUnfocused", { name: this.name, target: this, event: "unfocused" });
    }
  }

  /**
   * Whether the slider is currently focused.
   */
  get isFocused(): boolean {
    return this._isFocused;
  }

  /**
   * Called when the slider is enabled.
   * Emits `UISliderEnabled`.
   */
  protected onEnabled(): void {
    this.emitter.emit("UISliderEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /**
   * Called when the slider is disabled.
   * Stops dragging and emits `UISliderDisabled`.
   */
  protected onDisabled(): void {
    this.dragging = false;
    this.emitter.emit("UISliderDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Get the slider's event emitter.
   */
  get eventEmitter() {
    return this.emitter;
  }
}

/**
 * Graphic implementation for rendering a `UISpriteSlider` using sprites.
 * Handles drawing sprite layers with proper positioning and clipping.
 */
class UISpriteSliderGraphic extends Graphic {
  private owner: UISpriteSlider;
  private config: UISpriteSliderConfig;
  private cnv: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private focusPosition: Vector;

  /**
   * Create the sprite slider graphic.
   * @param owner - The owning `UISpriteSlider` instance.
   * @param config - Sprite slider configuration.
   */
  constructor(owner: UISpriteSlider, config: UISpriteSliderConfig) {
    super({ width: config.width, height: config.height });
    this.owner = owner;
    this.config = config;

    const horizontal = config.orientation === "horizontal";
    const knobSprite = config.sprites?.knob;
    const knobRadius = knobSprite ? (horizontal ? knobSprite.width / 2 : knobSprite.height / 2) : 10;
    const padding = knobRadius + 2;

    this.cnv = document.createElement("canvas");
    this.cnv.width = config.width + padding * 2;
    this.cnv.height = config.height + padding * 2;
    this.ctx = this.cnv.getContext("2d")!;
    this.focusPosition = config.focusIndicator ?? vec(5, 5);
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UISpriteSliderGraphic {
    return new UISpriteSliderGraphic(this.owner, this.config);
  }

  /**
   * Render the sprite slider to an offscreen canvas and draw it into the Excalibur context.
   * @param ex - Excalibur rendering context used to draw the final image.
   * @param x - X coordinate to draw at.
   * @param y - Y coordinate to draw at.
   */
  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = this.ctx;
    const percent = this.owner.percent;
    const horizontal = this.config.orientation === "horizontal";
    const sprites = this.config.sprites ?? {};
    const isFocused = this.owner.isFocused;
    const isEnabled = this.owner.isEnabled;

    const knobSprite = sprites.knob;
    const knobRadius = knobSprite ? (horizontal ? knobSprite.width / 2 : knobSprite.height / 2) : 10;
    const padding = knobRadius + 2;

    ctx.clearRect(0, 0, this.cnv.width, this.cnv.height);

    // Translate context to account for padding
    ctx.save();
    ctx.translate(padding, padding);

    // Apply disabled filter if needed
    if (!isEnabled) {
      ctx.filter = "grayscale(100%) brightness(0.7)";
    } else {
      ctx.filter = "none";
    }

    // ---- TRACK ----
    if (sprites.track) {
      ctx.drawImage(sprites.track.image.image, 0, 0, this.config.width, this.config.height);
    }

    // ---- FILL (progress indicator) ----
    if (sprites.fill) {
      if (horizontal) {
        const fillWidth = this.config.width * percent;
        if (fillWidth > 0) {
          // Draw only the filled portion
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

    // ---- KNOB ----
    if (knobSprite) {
      let knobX: number;
      let knobY: number;

      if (horizontal) {
        knobX = this.config.width * percent - knobSprite.width / 2;
        knobY = this.config.height / 2 - knobSprite.height / 2;
      } else {
        knobX = this.config.width / 2 - knobSprite.width / 2;
        knobY = this.config.height * (1 - percent) - knobSprite.height / 2;
      }

      ctx.drawImage(knobSprite.image.image, knobX, knobY);
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
// #endregion Sprite Slider

// #region Events

/** Event emitted when the slider value changes. */
export class UISliderChanged extends GameEvent<UISlider | UISpriteSlider> {
  constructor(
    public target: UISlider | UISpriteSlider,
    public value: number,
    public percent: number,
  ) {
    super();
  }
}

/** Event emitted when the slider gains focus. */
export class UISliderFocused extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

/** Event emitted when the slider loses focus. */
export class UISliderUnfocused extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

/** Event emitted when the slider is enabled. */
export class UISliderEnabled extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

/** Event emitted when the slider is disabled. */
export class UISliderDisabled extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

/** Event emitted when pointer is pressed down on the slider. */
export class UISliderDown extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

/** Event emitted when pointer is released from the slider. */
export class UISliderUp extends GameEvent<UISlider | UISpriteSlider> {
  constructor(public target: UISlider | UISpriteSlider) {
    super();
  }
}

// #endregion Events
