// import {
//   Color,
//   Engine,
//   EventEmitter,
//   ExcaliburGraphicsContext,
//   Font,
//   GameEvent,
//   Graphic,
//   KeyEvent,
//   Keys,
//   ScreenElement,
//   PointerEvent,
//   TextOptions,
//   vec,
//   Vector,
// } from "excalibur";
// import { drawText } from "canvas-txt";

// export type UINumericState = "normal" | "focused" | "disabled";

// export type UINumericEvents = {
//   UINumericValueChanged: UINumericValueChanged;
//   UINumericFocused: UINumericFocused;
//   UINumericUnfocused: UINumericUnfocused;
//   UINumericDisabled: UINumericDisabled;
//   UINumericEnabled: UINumericEnabled;
//   UINumericSubmit: UINumericSubmit;
//   UINumericIncrement: UINumericIncrement;
//   UINumericDecrement: UINumericDecrement;
// };

// type UINumericColors = {
//   backgroundStarting?: Color;
//   backgroundEnding?: Color;
//   focusedStarting?: Color;
//   focusedEnding?: Color;
//   disabledStarting?: Color;
//   disabledEnding?: Color;
//   borderNormal?: Color;
//   borderFocused?: Color;
//   borderDisabled?: Color;
//   cursorColor?: Color;
//   arrowButtonBackground?: Color;
//   arrowButtonHover?: Color;
//   arrowColor?: Color;
// };

// export type UINumericFormatOptions = {
//   /** Number of decimal places to display (default: 2) */
//   decimals?: number;
//   /** Thousands separator (default: ',') */
//   thousandsSeparator?: string;
//   /** Decimal separator (default: '.') */
//   decimalSeparator?: string;
//   /** Prefix to add before the number (e.g., '$', '€') */
//   prefix?: string;
//   /** Suffix to add after the number (e.g., '%', 'kg') */
//   suffix?: string;
//   /** Whether to use exponential notation for large numbers */
//   useExponential?: boolean;
//   /** Threshold for switching to exponential notation */
//   exponentialThreshold?: number;
// };

// const defaultNumericConfig: UINumericConfig = {
//   name: "UINumeric",
//   width: 200,
//   height: 40,
//   pos: vec(0, 0),
//   z: 1,
//   value: 0,
//   min: -Infinity,
//   max: Infinity,
//   step: 1,
//   placeholder: "0",
//   colors: {
//     backgroundStarting: Color.fromHex("#FFFFFF"),
//     borderNormal: Color.fromHex("#CCCCCC"),
//     borderFocused: Color.fromHex("#4A90E2"),
//     borderDisabled: Color.fromHex("#E0E0E0"),
//     cursorColor: Color.fromHex("#000000"),
//     arrowButtonBackground: Color.fromHex("#F5F5F5"),
//     arrowButtonHover: Color.fromHex("#E0E0E0"),
//     arrowColor: Color.fromHex("#666666"),
//   },
//   inputRadius: 4,
//   padding: vec(8, 8),
//   borderWidth: 2,
//   showArrows: true,
//   arrowWidth: 20,
//   allowNegative: true,
//   allowDecimal: true,
//   formatOptions: {
//     decimals: 2,
//     thousandsSeparator: ",",
//     decimalSeparator: ".",
//     prefix: "",
//     suffix: "",
//   },
// };

// export type UINumericConfig = {
//   name: string;
//   width: number;
//   height: number;
//   pos: Vector;
//   z?: number;
//   value?: number;
//   min?: number;
//   max?: number;
//   step?: number;
//   placeholder?: string;
//   textOptions?: Omit<TextOptions, "text">;
//   colors?: UINumericColors;
//   inputRadius?: number;
//   padding?: Vector;
//   borderWidth?: number;
//   showArrows?: boolean;
//   arrowWidth?: number;
//   allowNegative?: boolean;
//   allowDecimal?: boolean;
//   formatOptions?: UINumericFormatOptions;
// };

// export class UINumeric extends ScreenElement {
//   protected state: UINumericState = "normal";
//   public enabled = true;
//   protected focused = false;
//   public emitter: EventEmitter<UINumericEvents>;
//   protected _config: UINumericConfig;
//   protected _value: number;
//   protected _inputText: string = ""; // Raw input text while editing
//   protected _cursorPosition: number = 0;
//   protected _cursorVisible: boolean = true;
//   protected _cursorBlinkTimer: number = 0;
//   protected _cursorBlinkInterval: number = 530; // milliseconds
//   protected _upArrowHover: boolean = false;
//   protected _downArrowHover: boolean = false;
//   protected _isEditing: boolean = false; // Track if user is actively typing

//   constructor(config: Partial<UINumericConfig>) {
//     let localConfig = { ...defaultNumericConfig, ...config };
//     let actorConfig: Partial<UINumericConfig> = {
//       name: localConfig.name,
//       width: localConfig.width,
//       height: localConfig.height,
//       pos: localConfig.pos,
//     };

//     super(actorConfig);
//     this._config = localConfig;
//     this._value = this.clampValue(localConfig.value ?? 0);
//     this._inputText = this.formatNumber(this._value);
//     this._cursorPosition = this._inputText.length;

//     let size = vec(actorConfig.width, actorConfig.height);
//     this.graphics.use(
//       new UINumericGraphic(
//         this,
//         size,
//         () => this.state,
//         () => this._cursorVisible,
//         this._config,
//       ),
//     );

//     this.emitter = new EventEmitter();
//     this.pointer.useGraphicsBounds = true;

//     if (this._config.showArrows) {
//       const upArrow = new UINumericArrowButton(this, "up", this._config);
//       const downArrow = new UINumericArrowButton(this, "down", this._config);

//       this.addChild(upArrow);
//       this.addChild(downArrow);
//     }

//     // Setup pointer events
//     this.on("pointerdown", evt => {
//       if (this.enabled) {
//         this.handlePointerDown(evt);
//       }
//     });

//     // this.on("pointermove", evt => {
//     //   if (this.enabled) {
//     //     this.handlePointerMove(evt);
//     //   }
//     // });

//     this.on("pointerup", () => {
//       // Reset hover states when mouse is released
//       this._upArrowHover = false;
//       this._downArrowHover = false;
//     });
//   }

//   handleKeystroke(evt: KeyEvent) {
//     if (!this.focused || !this.enabled) return;

//     if (evt.key === Keys.Backspace) {
//       this.handleBackspace();
//     } else if (evt.key === Keys.Delete) {
//       this.handleDelete();
//     } else if (evt.key === Keys.Left) {
//       this.moveCursorLeft();
//     } else if (evt.key === Keys.Right) {
//       this.moveCursorRight();
//     } else if (evt.key === Keys.Home) {
//       this._cursorPosition = 0;
//     } else if (evt.key === Keys.End) {
//       this._cursorPosition = this._inputText.length;
//     } else if (evt.key === Keys.ArrowUp) {
//       this.increment();
//     } else if (evt.key === Keys.ArrowDown) {
//       this.decrement();
//     } else if (evt.key === Keys.Enter) {
//       this.commitValue();
//       this.emitter.emit("UINumericSubmit", {
//         name: this.name,
//         target: this,
//         event: "submit",
//         value: this._value,
//       });
//     } else if (evt.key === Keys.Escape) {
//       // Cancel editing and restore formatted value
//       this._inputText = this.formatNumber(this._value);
//       this._cursorPosition = this._inputText.length;
//       this._isEditing = false;
//       this.setFocus(false);
//     } else if (evt.key && this.isValidNumericInput(evt.value)) {
//       this.insertCharacter(evt.value);
//     }
//   }

//   handlePointerDown(evt: PointerEvent) {
//     this.setFocus(true);
//   }

//   //   handlePointerMove(evt: PointerEvent) {
//   //     if (!this._config.showArrows) return;

//   //     const localPos = this.getLocalPointerPosition(evt);
//   //     const upArrowBounds = this.getUpArrowBounds();
//   //     const downArrowBounds = this.getDownArrowBounds();

//   //     this._upArrowHover = this.isPointInBounds(localPos, upArrowBounds);
//   //     this._downArrowHover = this.isPointInBounds(localPos, downArrowBounds);
//   //   }

//   //   handleClick(evt: PointerEvent) {
//   //     if (!this.focused) return;

//   //     const worldPos = evt.worldPos;
//   //     const bounds = this.graphics.localBounds;
//   //     const globalPos = this.pos;

//   //     const localX = worldPos.x - globalPos.x;
//   //     const localY = worldPos.y - globalPos.y;

//   //     if (localX < bounds.left || localX > bounds.right || localY < bounds.top || localY > bounds.bottom) {
//   //       this.commitValue();
//   //       this.setFocus(false);
//   //     }
//   //   }

//   onAdd(engine: Engine): void {
//     engine.input.keyboard.on("press", this.handleKeystroke.bind(this));
//     this.on("pointerdown", this.handlePointerDown.bind(this));
//   }

//   onRemove(engine: Engine): void {
//     engine.input.keyboard.off("press", this.handleKeystroke);
//     this.off("pointerdown", this.handlePointerDown);
//   }

//   onPreUpdate(engine: Engine, delta: number): void {
//     super.onPreUpdate(engine, delta);

//     if (this.focused) {
//       this._cursorBlinkTimer += delta;
//       if (this._cursorBlinkTimer >= this._cursorBlinkInterval) {
//         this._cursorVisible = !this._cursorVisible;
//         this._cursorBlinkTimer = 0;
//       }
//     }
//   }

//   private isValidNumericInput(key: string): boolean {
//     if (key.length !== 1) return false;

//     const char = key;
//     const currentText = this._inputText;
//     const before = currentText.substring(0, this._cursorPosition);
//     const after = currentText.substring(this._cursorPosition);

//     // Allow digits
//     if (/[0-9]/.test(char)) return true;

//     // Allow negative sign at the beginning if allowNegative is true
//     if (char === "-" && this._config.allowNegative && this._cursorPosition === 0 && !currentText.includes("-")) {
//       return true;
//     }

//     // Allow decimal point if allowDecimal is true and no decimal exists yet
//     if (char === "." && this._config.allowDecimal && !currentText.includes(".")) {
//       return true;
//     }

//     return false;
//   }

//   private insertCharacter(char: string) {
//     const before = this._inputText.substring(0, this._cursorPosition);
//     const after = this._inputText.substring(this._cursorPosition);
//     this._inputText = before + char + after;
//     this._cursorPosition++;
//     this._isEditing = true;
//     this.resetCursorBlink();
//   }

//   private handleBackspace() {
//     if (this._cursorPosition > 0) {
//       const before = this._inputText.substring(0, this._cursorPosition - 1);
//       const after = this._inputText.substring(this._cursorPosition);
//       this._inputText = before + after;
//       this._cursorPosition--;
//       this._isEditing = true;
//       this.resetCursorBlink();
//     }
//   }

//   private handleDelete() {
//     if (this._cursorPosition < this._inputText.length) {
//       const before = this._inputText.substring(0, this._cursorPosition);
//       const after = this._inputText.substring(this._cursorPosition + 1);
//       this._inputText = before + after;
//       this._isEditing = true;
//       this.resetCursorBlink();
//     }
//   }

//   private moveCursorLeft() {
//     if (this._cursorPosition > 0) {
//       this._cursorPosition--;
//       this.resetCursorBlink();
//     }
//   }

//   private moveCursorRight() {
//     if (this._cursorPosition < this._inputText.length) {
//       this._cursorPosition++;
//       this.resetCursorBlink();
//     }
//   }

//   private resetCursorBlink() {
//     this._cursorVisible = true;
//     this._cursorBlinkTimer = 0;
//   }

//   private commitValue() {
//     // Parse the input text and update the value
//     const parsed = this.parseNumber(this._inputText);
//     if (!isNaN(parsed)) {
//       this.setValue(parsed);
//     } else {
//       // Invalid input, restore previous value
//       this._inputText = this.formatNumber(this._value);
//     }
//     this._cursorPosition = this._inputText.length;
//     this._isEditing = false;
//   }

//   private parseNumber(text: string): number {
//     // Remove any formatting characters (thousands separators, prefix, suffix)
//     let cleaned = text;
//     const format = this._config.formatOptions;

//     if (format?.prefix) {
//       cleaned = cleaned.replace(format.prefix, "");
//     }
//     if (format?.suffix) {
//       cleaned = cleaned.replace(format.suffix, "");
//     }
//     if (format?.thousandsSeparator) {
//       cleaned = cleaned.replace(new RegExp("\\" + format.thousandsSeparator, "g"), "");
//     }

//     cleaned = cleaned.trim();
//     return parseFloat(cleaned);
//   }

//   private formatNumber(value: number): string {
//     const format = this._config.formatOptions ?? {};

//     if (isNaN(value)) return this._config.placeholder ?? "0";

//     // Handle exponential notation
//     if (format.useExponential && format.exponentialThreshold) {
//       if (Math.abs(value) >= format.exponentialThreshold) {
//         return value.toExponential(format.decimals ?? 2);
//       }
//     }

//     // Format with decimals
//     let formatted = value.toFixed(format.decimals ?? 2);

//     // Split into integer and decimal parts
//     let [intPart, decPart] = formatted.split(".");

//     // Add thousands separator
//     if (format.thousandsSeparator) {
//       intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);
//     }

//     // Use custom decimal separator
//     const decSep = format.decimalSeparator ?? ".";
//     formatted = decPart ? `${intPart}${decSep}${decPart}` : intPart;

//     // Add prefix and suffix
//     if (format.prefix) formatted = format.prefix + formatted;
//     if (format.suffix) formatted = formatted + format.suffix;

//     return formatted;
//   }

//   private clampValue(value: number): number {
//     const min = this._config.min ?? -Infinity;
//     const max = this._config.max ?? Infinity;
//     return Math.max(min, Math.min(max, value));
//   }

//   private emitValueChanged() {
//     this.emitter.emit("UINumericValueChanged", {
//       name: this.name,
//       target: this,
//       event: "valueChanged",
//       value: this._value,
//     });
//   }

//   increment() {
//     const step = this._config.step ?? 1;
//     this.setValue(this._value + step);
//     this.emitter.emit("UINumericIncrement", {
//       name: this.name,
//       target: this,
//       event: "increment",
//       value: this._value,
//     });
//   }

//   decrement() {
//     const step = this._config.step ?? 1;
//     this.setValue(this._value - step);
//     this.emitter.emit("UINumericDecrement", {
//       name: this.name,
//       target: this,
//       event: "decrement",
//       value: this._value,
//     });
//   }

//   setValue(value: number) {
//     const clamped = this.clampValue(value);
//     if (this._value !== clamped) {
//       this._value = clamped;
//       this._inputText = this.formatNumber(this._value);
//       this._cursorPosition = Math.min(this._cursorPosition, this._inputText.length);
//       this._isEditing = false;
//       this.emitValueChanged();
//     }
//   }

//   getValue(): number {
//     return this._value;
//   }

//   getDisplayText(): string {
//     return this._isEditing ? this._inputText : this.formatNumber(this._value);
//   }

//   setFocus(focused: boolean) {
//     if (this.focused === focused) return;

//     if (!focused && this._isEditing) {
//       this.commitValue();
//     }

//     this.focused = focused;
//     this.state = focused ? "focused" : "normal";

//     if (focused) {
//       this._cursorVisible = true;
//       this._cursorBlinkTimer = 0;
//       // When focusing, switch to raw editing mode
//       this._inputText = this._value.toString();
//       this._cursorPosition = this._inputText.length;
//       this._isEditing = true;
//       this.emitter.emit("UINumericFocused", { name: this.name, target: this, event: "focused" });
//     } else {
//       this._isEditing = false;
//       this._inputText = this.formatNumber(this._value);
//       this.emitter.emit("UINumericUnfocused", { name: this.name, target: this, event: "unfocused" });
//     }
//   }

//   setEnabled(value: boolean) {
//     if (value !== this.enabled) {
//       if (value) {
//         this.emitter.emit("UINumericEnabled", { name: this.name, target: this, event: "enabled" });
//       } else {
//         this.emitter.emit("UINumericDisabled", { name: this.name, target: this, event: "disabled" });
//         if (this.focused) {
//           this.setFocus(false);
//         }
//       }
//     }

//     this.enabled = value;
//     this.state = value ? "normal" : "disabled";
//   }

//   getCursorPosition(): number {
//     return this._cursorPosition;
//   }

//   setCursorPosition(position: number) {
//     this._cursorPosition = Math.max(0, Math.min(position, this._inputText.length));
//     this.resetCursorBlink();
//   }

//   setMin(min: number) {
//     this._config.min = min;
//     this.setValue(this._value); // Re-clamp current value
//   }

//   setMax(max: number) {
//     this._config.max = max;
//     this.setValue(this._value); // Re-clamp current value
//   }

//   setStep(step: number) {
//     this._config.step = Math.abs(step);
//   }

//   setFormatOptions(options: Partial<UINumericFormatOptions>) {
//     this._config.formatOptions = { ...this._config.formatOptions, ...options };
//     if (!this._isEditing) {
//       this._inputText = this.formatNumber(this._value);
//     }
//   }

//   get numericState() {
//     return this.state;
//   }

//   get eventEmitter() {
//     return this.emitter;
//   }

//   get min() {
//     return this._config.min ?? -Infinity;
//   }

//   get max() {
//     return this._config.max ?? Infinity;
//   }

//   get step() {
//     return this._config.step ?? 1;
//   }
// }

// class UINumericGraphic extends Graphic {
//   private size: Vector;
//   private getState: () => UINumericState;
//   private getCursorVisible: () => boolean;

//   private config: UINumericConfig;
//   private radius = 4;
//   private owner: UINumeric;
//   private padding: Vector;
//   private borderWidth: number;

//   colors: UINumericColors = {
//     backgroundStarting: Color.fromHex("#FFFFFF"),
//     borderNormal: Color.fromHex("#CCCCCC"),
//     borderFocused: Color.fromHex("#4A90E2"),
//     borderDisabled: Color.fromHex("#E0E0E0"),
//     cursorColor: Color.fromHex("#000000"),
//     arrowButtonBackground: Color.fromHex("#F5F5F5"),
//     arrowButtonHover: Color.fromHex("#E0E0E0"),
//     arrowColor: Color.fromHex("#666666"),
//   };
//   cnv: HTMLCanvasElement;
//   ctx: CanvasRenderingContext2D;

//   constructor(
//     owner: UINumeric,
//     size: Vector,
//     getState: () => UINumericState,
//     getCursorVisible: () => boolean,

//     inputConfig: UINumericConfig,
//   ) {
//     super({ width: size.x, height: size.y });
//     this.owner = owner;
//     this.size = size;
//     this.config = inputConfig;
//     this.getState = getState;
//     this.getCursorVisible = getCursorVisible;
//     this.cnv = document.createElement("canvas");
//     this.cnv.width = this.size.x;
//     this.cnv.height = this.size.y;
//     this.ctx = this.cnv.getContext("2d")!;
//     this.radius = inputConfig.inputRadius ?? this.radius;
//     this.padding = inputConfig.padding ?? vec(8, 8);
//     this.borderWidth = inputConfig.borderWidth ?? 2;
//     if (inputConfig.colors) this.colors = { ...this.colors, ...inputConfig.colors };
//   }

//   clone(): UINumericGraphic {
//     return new UINumericGraphic(
//       this.owner,
//       this.size,
//       this.getState,
//       this.getCursorVisible,

//       this.config,
//     );
//   }

//   protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
//     const state = this.getState();
//     let cnv = this.cnv;
//     let ctx = this.ctx;
//     ctx.clearRect(0, 0, this.size.x, this.size.y);
//     const isEnabled = state !== "disabled";

//     if (!ctx || !cnv) return;

//     // Apply grayscale filter when disabled
//     if (!isEnabled) {
//       ctx.filter = "grayscale(100%) brightness(0.7)";
//     } else {
//       ctx.filter = "none";
//     }

//     // Draw background
//     const bgGradient = this.backgroundGradient(ctx, state);
//     if (bgGradient) {
//       this.drawRoundedRect(ctx, 0, 0, this.size.x, this.size.y, this.radius, bgGradient);
//     }

//     // Draw border
//     const borderColor = this.getBorderColor(state);
//     if (borderColor) {
//       this.drawRoundedRectStroke(
//         ctx,
//         this.borderWidth / 2,
//         this.borderWidth / 2,
//         this.size.x - this.borderWidth,
//         this.size.y - this.borderWidth,
//         this.radius,
//         borderColor,
//         this.borderWidth,
//       );
//     }

//     // Prepare text
//     let displayText = this.owner.getDisplayText();
//     const hasText = displayText.length > 0;

//     // Show placeholder if no text
//     const showPlaceholder = !hasText && this.config.placeholder;

//     ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#000000";
//     ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#000000";
//     let thisFont = this.config.textOptions?.font as Font | undefined;
//     const fontSize = thisFont?.size ?? 16;
//     const fontFamily = thisFont?.family ?? "Arial";

//     // Calculate text area width (subtract arrow buttons if shown)
//     const arrowWidth = this.config.showArrows ? (this.config.arrowWidth ?? 20) : 0;
//     const textAreaWidth = this.size.x - this.padding.x * 2 - arrowWidth;

//     if (showPlaceholder) {
//       ctx.fillStyle = "#999999";
//       drawText(ctx, this.config.placeholder!, {
//         x: this.padding.x,
//         y: this.padding.y,
//         width: textAreaWidth,
//         height: this.size.y - this.padding.y * 2,
//         fontSize: fontSize,
//         font: fontFamily,
//         align: "left",
//         vAlign: "middle",
//       });
//     } else if (hasText) {
//       drawText(ctx, displayText, {
//         x: this.padding.x,
//         y: this.padding.y,
//         width: textAreaWidth,
//         height: this.size.y - this.padding.y * 2,
//         fontSize: fontSize,
//         font: fontFamily,
//         align: "left",
//         vAlign: "middle",
//       });
//     }

//     // Draw cursor when focused
//     if (state === "focused" && this.getCursorVisible()) {
//       this.drawCursor(ctx, fontSize, fontFamily);
//     }

//     // Draw image to ex
//     cnv.setAttribute("forceUpload", "true");
//     ex.drawImage(cnv, x, y);
//   }

//   private drawCursor(ctx: CanvasRenderingContext2D, fontSize: number, fontFamily: string) {
//     const cursorPos = this.owner.getCursorPosition();
//     const displayText = this.owner.getDisplayText();
//     let textBeforeCursor = displayText.substring(0, cursorPos);

//     // Measure text width before cursor
//     ctx.font = `${fontSize}px ${fontFamily}`;
//     const textWidth = ctx.measureText(textBeforeCursor).width;

//     const cursorX = this.padding.x + textWidth;
//     const cursorY = this.size.y / 2 - fontSize / 2;
//     const cursorHeight = fontSize;

//     ctx.strokeStyle = this.colors.cursorColor?.toString() ?? "#000000";
//     ctx.lineWidth = 2;
//     ctx.beginPath();
//     ctx.moveTo(cursorX, cursorY);
//     ctx.lineTo(cursorX, cursorY + cursorHeight);
//     ctx.stroke();
//   }

//   private getBorderColor(state: UINumericState): Color | null {
//     if (state === "disabled") {
//       return this.colors.borderDisabled ?? null;
//     } else if (state === "focused") {
//       return this.colors.borderFocused ?? null;
//     } else {
//       return this.colors.borderNormal ?? null;
//     }
//   }

//   // ============================
//   // Gradients
//   // ============================

//   private backgroundGradient(ctx: CanvasRenderingContext2D, state: UINumericState): CanvasGradient | null {
//     if (state === "disabled") {
//       if (!this.colors.disabledStarting) return this.createDefaultGradient(ctx);
//       const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
//       g.addColorStop(0, this.colors.disabledStarting.toString());
//       this.colors.disabledEnding
//         ? g.addColorStop(1, this.colors.disabledEnding.toString())
//         : g.addColorStop(1, this.colors.disabledStarting.toString());
//       return g;
//     } else if (state === "focused") {
//       if (!this.colors.focusedStarting) return this.createDefaultGradient(ctx);
//       const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
//       g.addColorStop(0, this.colors.focusedStarting.toString());
//       this.colors.focusedEnding
//         ? g.addColorStop(1, this.colors.focusedEnding.toString())
//         : g.addColorStop(1, this.colors.focusedStarting.toString());
//       return g;
//     } else {
//       return this.createDefaultGradient(ctx);
//     }
//   }

//   private createDefaultGradient(ctx: CanvasRenderingContext2D): CanvasGradient | null {
//     if (!this.colors.backgroundStarting) return null;
//     const g = ctx.createLinearGradient(0, 0, 0, this.size.y);
//     g.addColorStop(0, this.colors.backgroundStarting.toString());
//     this.colors.backgroundEnding
//       ? g.addColorStop(1, this.colors.backgroundEnding.toString())
//       : g.addColorStop(1, this.colors.backgroundStarting.toString());
//     return g;
//   }

//   // ============================
//   // Shape helpers
//   // ============================

//   private drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: CanvasGradient) {
//     ctx.beginPath();
//     ctx.roundRect(x, y, w, h, r);
//     ctx.fillStyle = fill;
//     ctx.fill();
//   }

//   private drawRoundedRectStroke(
//     ctx: CanvasRenderingContext2D,
//     x: number,
//     y: number,
//     w: number,
//     h: number,
//     r: number,
//     stroke: Color,
//     lineWidth: number,
//   ) {
//     ctx.beginPath();
//     ctx.roundRect(x, y, w, h, r);
//     ctx.strokeStyle = stroke.toString();
//     ctx.lineWidth = lineWidth;
//     ctx.stroke();
//   }
// }

// // #region Events

// export class UINumericValueChanged extends GameEvent<UINumeric> {
//   constructor(
//     public target: UINumeric,
//     public value: number,
//   ) {
//     super();
//   }
// }

// export class UINumericFocused extends GameEvent<UINumeric> {
//   constructor(public target: UINumeric) {
//     super();
//   }
// }

// export class UINumericUnfocused extends GameEvent<UINumeric> {
//   constructor(public target: UINumeric) {
//     super();
//   }
// }

// export class UINumericEnabled extends GameEvent<UINumeric> {
//   constructor(public target: UINumeric) {
//     super();
//   }
// }

// export class UINumericDisabled extends GameEvent<UINumeric> {
//   constructor(public target: UINumeric) {
//     super();
//   }
// }

// export class UINumericSubmit extends GameEvent<UINumeric> {
//   constructor(
//     public target: UINumeric,
//     public value: number,
//   ) {
//     super();
//   }
// }

// export class UINumericIncrement extends GameEvent<UINumeric> {
//   constructor(
//     public target: UINumeric,
//     public value: number,
//   ) {
//     super();
//   }
// }

// export class UINumericDecrement extends GameEvent<UINumeric> {
//   constructor(
//     public target: UINumeric,
//     public value: number,
//   ) {
//     super();
//   }
// }

// // #endregion Events

// // #region child classes
// class UINumericArrowButton extends ScreenElement {
//   private direction: "up" | "down";
//   private owner: UINumeric;
//   private hover = false;
//   private config: UINumericConfig;

//   constructor(owner: UINumeric, direction: "up" | "down", config: UINumericConfig) {
//     super({
//       name: `arrow-${direction}`,
//       width: config.arrowWidth ?? 20,
//       height: (config.height ?? 40) / 2,
//       pos: vec((config.width ?? 200) - (config.arrowWidth ?? 20), direction === "up" ? 0 : (config.height ?? 40) / 2),
//       z: 10,
//     });

//     this.owner = owner;
//     this.direction = direction;
//     this.config = config;

//     this.pointer.useGraphicsBounds = true;

//     this.on("pointerenter", () => (this.hover = true));
//     this.on("pointerleave", () => (this.hover = false));

//     this.on("pointerdown", () => {
//       if (!this.owner.enabled) return;
//       direction === "up" ? this.owner.increment() : this.owner.decrement();
//     });

//     this.graphics.use(new UINumericArrowGraphic(this));
//   }

//   isHovering() {
//     return this.hover;
//   }

//   getDirection() {
//     return this.direction;
//   }

//   getConfig() {
//     return this.config;
//   }
// }

// class UINumericArrowGraphic extends Graphic {
//   private btn: UINumericArrowButton;

//   constructor(btn: UINumericArrowButton) {
//     super({ width: btn.width, height: btn.height });
//     this.btn = btn;
//   }

//   clone() {
//     return new UINumericArrowGraphic(this.btn);
//   }

//   protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number) {
//     const ctx = document.createElement("canvas").getContext("2d")!;
//     ctx.canvas.width = this.width;
//     ctx.canvas.height = this.height;

//     const cfg = this.btn.getConfig().colors!;
//     ctx.fillStyle = this.btn.isHovering()
//       ? (cfg.arrowButtonHover?.toString() ?? "#E0E0E0")
//       : (cfg.arrowButtonBackground?.toString() ?? "#F5F5F5");

//     ctx.fillRect(0, 0, this.width, this.height);

//     ctx.fillStyle = cfg.arrowColor?.toString() ?? "#666";

//     const cx = this.width / 2;
//     const cy = this.height / 2;
//     const size = 6;

//     ctx.beginPath();
//     if (this.btn.getDirection() === "up") {
//       ctx.moveTo(cx, cy - size / 2);
//       ctx.lineTo(cx + size, cy + size / 2);
//       ctx.lineTo(cx - size, cy + size / 2);
//     } else {
//       ctx.moveTo(cx, cy + size / 2);
//       ctx.lineTo(cx + size, cy - size / 2);
//       ctx.lineTo(cx - size, cy - size / 2);
//     }
//     ctx.closePath();
//     ctx.fill();

//     ex.drawImage(ctx.canvas, x, y);
//   }
// }

// // #endregin child classes
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
  ScreenElement,
  TextOptions,
  vec,
  Vector,
} from "excalibur";
import { drawText } from "canvas-txt";
import { BaseUIConfig, IFocusable, InteractiveUIComponent } from "./uiComponent";

/**
 * The visual/interactable state of the `UINumeric`.
 *
 * - "normal": default state
 * - "focused": input has focus and is being edited
 * - "disabled": not interactive
 */
export type UINumericState = "normal" | "focused" | "disabled";

/**
 * Event map emitted by `UINumeric`.
 * Each property corresponds to a specific event payload type.
 */
export type UINumericEvents = {
  UINumericValueChanged: UINumericValueChanged;
  UINumericFocused: UINumericFocused;
  UINumericUnfocused: UINumericUnfocused;
  UINumericDisabled: UINumericDisabled;
  UINumericEnabled: UINumericEnabled;
  UINumericSubmit: UINumericSubmit;
  UINumericIncrement: UINumericIncrement;
  UINumericDecrement: UINumericDecrement;
};

/**
 * Configuration options for `UINumeric`.
 */
export type UINumericConfig = BaseUIConfig & {
  /** Initial numeric value. */
  value?: number;
  /** Minimum allowed value. */
  min?: number;
  /** Maximum allowed value. */
  max?: number;
  /** Increment/decrement step size. */
  step?: number;
  /** Placeholder text when empty. */
  placeholder?: string;
  /** Text drawing options (font, color, etc.). */
  textOptions?: Omit<TextOptions, "text">;
  /** Color configuration for the numeric input. */
  colors?: UINumericColors;
  /** Radius for rounded corners. */
  inputRadius?: number;
  /** Internal padding for text. */
  padding?: Vector;
  /** Border width in pixels. */
  borderWidth?: number;
  /** Whether to show increment/decrement arrow buttons. */
  showArrows?: boolean;
  /** Width of arrow button area. */
  arrowWidth?: number;
  /** Whether negative numbers are allowed. */
  allowNegative?: boolean;
  /** Whether decimal numbers are allowed. */
  allowDecimal?: boolean;
  /** Number formatting options. */
  formatOptions?: UINumericFormatOptions;
  /** Tab stop index for keyboard navigation (-1 to opt-out). */
  tabStopIndex?: number;
};

/** Default configuration values for `UINumeric`. */
const defaultNumericConfig: UINumericConfig = {
  name: "UINumeric",
  width: 200,
  height: 40,
  pos: vec(0, 0),
  z: 1,
  value: 0,
  min: -Infinity,
  max: Infinity,
  step: 1,
  placeholder: "0",
  colors: {
    backgroundStarting: Color.fromHex("#FFFFFF"),
    borderNormal: Color.fromHex("#CCCCCC"),
    borderFocused: Color.fromHex("#4A90E2"),
    borderDisabled: Color.fromHex("#E0E0E0"),
    cursorColor: Color.fromHex("#000000"),
    arrowButtonBackground: Color.fromHex("#F5F5F5"),
    arrowButtonHover: Color.fromHex("#E0E0E0"),
    arrowColor: Color.fromHex("#666666"),
  },
  inputRadius: 4,
  padding: vec(8, 8),
  borderWidth: 2,
  showArrows: true,
  arrowWidth: 20,
  allowNegative: true,
  allowDecimal: true,
  formatOptions: {
    decimals: 2,
    thousandsSeparator: ",",
    decimalSeparator: ".",
    prefix: "",
    suffix: "",
  },
  tabStopIndex: -1,
};

/**
 * Color configuration for `UINumeric`.
 */
type UINumericColors = {
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
  /** Background color of arrow buttons. */
  arrowButtonBackground?: Color;
  /** Background color of arrow buttons on hover. */
  arrowButtonHover?: Color;
  /** Color of arrow icons. */
  arrowColor?: Color;
};

/**
 * Number formatting options for `UINumeric`.
 */
export type UINumericFormatOptions = {
  /** Number of decimal places to display (default: 2) */
  decimals?: number;
  /** Thousands separator (default: ',') */
  thousandsSeparator?: string;
  /** Decimal separator (default: '.') */
  decimalSeparator?: string;
  /** Prefix to add before the number (e.g., '$', '€') */
  prefix?: string;
  /** Suffix to add after the number (e.g., '%', 'kg') */
  suffix?: string;
  /** Whether to use exponential notation for large numbers */
  useExponential?: boolean;
  /** Threshold for switching to exponential notation */
  exponentialThreshold?: number;
};

/**
 * A numeric input UI component with keyboard support, increment/decrement buttons,
 * and number formatting capabilities.
 *
 * Emits events defined in `UINumericEvents` and can be navigated with keyboard.
 */
export class UINumeric extends InteractiveUIComponent<UINumericConfig, UINumericEvents> {
  /** Current numeric input state. */
  private state: UINumericState = "normal";
  /** The current numeric value. */
  private _value: number;
  /** Raw input text while editing. */
  private _inputText: string = "";
  /** Current cursor position in the input text. */
  private _cursorPosition: number = 0;
  /** Whether the cursor is currently visible (for blinking). */
  private _cursorVisible: boolean = true;
  /** Timer for cursor blink animation. */
  private _cursorBlinkTimer: number = 0;
  /** Interval for cursor blink in milliseconds. */
  private _cursorBlinkInterval: number = 530;
  /** Whether user is actively typing (editing mode). */
  private _isEditing: boolean = false;

  /**
   * Create a new UINumeric input.
   * @param numericConfig - Partial configuration for the numeric input. Missing values will be filled from defaults.
   */
  constructor(numericConfig: UINumericConfig) {
    const localConfig = { ...defaultNumericConfig, ...numericConfig };
    super(localConfig);
    this._config = localConfig;
    this._value = this.clampValue(localConfig.value ?? 0);
    this._inputText = this.formatNumber(this._value);
    this._cursorPosition = this._inputText.length;
    this.tabStopIndex = localConfig.tabStopIndex ?? -1;
    const size = vec(localConfig.width, localConfig.height);
    this.graphics.use(
      new UINumericGraphic(
        this,
        size,
        () => this.state,
        () => this._cursorVisible,
        this._config,
      ),
    );

    this.pointer.useGraphicsBounds = true;

    // Add arrow buttons if enabled
    if (this._config.showArrows) {
      const upArrow = new UINumericArrowButton(this, "up", this._config);
      const downArrow = new UINumericArrowButton(this, "down", this._config);
      this.addChild(upArrow);
      this.addChild(downArrow);
    }
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
   * Keyboard press handler. Handles all keyboard input for the numeric field.
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
      this._cursorPosition = this._inputText.length;
      this.resetCursorBlink();
    } else if (evt.key === Keys.ArrowUp) {
      this.increment();
    } else if (evt.key === Keys.ArrowDown) {
      this.decrement();
    } else if (evt.key === Keys.Enter) {
      this.commitValue();
      this.emitter.emit("UINumericSubmit", {
        name: this.name,
        target: this,
        event: "submit",
        value: this._value,
      });
    } else if (evt.key === Keys.Escape) {
      // Cancel editing and restore formatted value
      this._inputText = this.formatNumber(this._value);
      this._cursorPosition = this._inputText.length;
      this._isEditing = false;
      this.focus();
    } else if (evt.key && this.isValidNumericInput(evt.value)) {
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
   * Check if a character is valid numeric input based on current configuration.
   * @param key - The character to validate.
   */
  private isValidNumericInput(key: string): boolean {
    if (key.length !== 1) return false;

    const char = key;
    const currentText = this._inputText;

    // Allow digits
    if (/[0-9]/.test(char)) return true;

    // Allow negative sign at the beginning if allowNegative is true
    if (char === "-" && this._config.allowNegative && this._cursorPosition === 0 && !currentText.includes("-")) {
      return true;
    }

    // Allow decimal point if allowDecimal is true and no decimal exists yet
    if (char === "." && this._config.allowDecimal && !currentText.includes(".")) {
      return true;
    }

    return false;
  }

  /**
   * Insert a character at the current cursor position.
   * @param char - The character to insert.
   */
  private insertCharacter(char: string): void {
    const before = this._inputText.substring(0, this._cursorPosition);
    const after = this._inputText.substring(this._cursorPosition);
    this._inputText = before + char + after;
    this._cursorPosition++;
    this._isEditing = true;
    this.resetCursorBlink();
  }

  /**
   * Handle backspace key - delete character before cursor.
   */
  private handleBackspace(): void {
    if (this._cursorPosition > 0) {
      const before = this._inputText.substring(0, this._cursorPosition - 1);
      const after = this._inputText.substring(this._cursorPosition);
      this._inputText = before + after;
      this._cursorPosition--;
      this._isEditing = true;
      this.resetCursorBlink();
    }
  }

  /**
   * Handle delete key - delete character after cursor.
   */
  private handleDelete(): void {
    if (this._cursorPosition < this._inputText.length) {
      const before = this._inputText.substring(0, this._cursorPosition);
      const after = this._inputText.substring(this._cursorPosition + 1);
      this._inputText = before + after;
      this._isEditing = true;
      this.resetCursorBlink();
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
    if (this._cursorPosition < this._inputText.length) {
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
   * Commit the current input text as the numeric value.
   * Parses and validates the input, updating the value or restoring the previous value if invalid.
   */
  private commitValue(): void {
    const parsed = this.parseNumber(this._inputText);
    if (!isNaN(parsed)) {
      this.setValue(parsed);
    } else {
      // Invalid input, restore previous value
      this._inputText = this.formatNumber(this._value);
    }
    this._cursorPosition = this._inputText.length;
    this._isEditing = false;
  }

  /**
   * Parse a formatted number string into a numeric value.
   * Strips formatting characters (prefix, suffix, thousands separators).
   * @param text - The formatted text to parse.
   */
  private parseNumber(text: string): number {
    let cleaned = text;
    const format = this._config.formatOptions;

    if (format?.prefix) {
      cleaned = cleaned.replace(format.prefix, "");
    }
    if (format?.suffix) {
      cleaned = cleaned.replace(format.suffix, "");
    }
    if (format?.thousandsSeparator) {
      cleaned = cleaned.replace(new RegExp("\\" + format.thousandsSeparator, "g"), "");
    }

    cleaned = cleaned.trim();
    return parseFloat(cleaned);
  }

  /**
   * Format a numeric value according to the configured format options.
   * @param value - The number to format.
   */
  private formatNumber(value: number): string {
    const format = this._config.formatOptions ?? {};

    if (isNaN(value)) return this._config.placeholder ?? "0";

    // Handle exponential notation
    if (format.useExponential && format.exponentialThreshold) {
      if (Math.abs(value) >= format.exponentialThreshold) {
        return value.toExponential(format.decimals ?? 2);
      }
    }

    // Format with decimals
    let formatted = value.toFixed(format.decimals ?? 2);

    // Split into integer and decimal parts
    let [intPart, decPart] = formatted.split(".");

    // Add thousands separator
    if (format.thousandsSeparator) {
      intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, format.thousandsSeparator);
    }

    // Use custom decimal separator
    const decSep = format.decimalSeparator ?? ".";
    formatted = decPart ? `${intPart}${decSep}${decPart}` : intPart;

    // Add prefix and suffix
    if (format.prefix) formatted = format.prefix + formatted;
    if (format.suffix) formatted = formatted + format.suffix;

    return formatted;
  }

  /**
   * Clamp a value between the configured min and max.
   * @param value - The value to clamp.
   */
  private clampValue(value: number): number {
    const min = this._config.min ?? -Infinity;
    const max = this._config.max ?? Infinity;
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Emit the value changed event.
   */
  private emitValueChanged(): void {
    this.emitter.emit("UINumericValueChanged", {
      name: this.name,
      target: this,
      event: "valueChanged",
      value: this._value,
    });
  }

  /**
   * Increment the value by the configured step amount.
   */
  increment(): void {
    const step = this._config.step ?? 1;
    this.setValue(this._value + step);
    this.emitter.emit("UINumericIncrement", {
      name: this.name,
      target: this,
      event: "increment",
      value: this._value,
    });
  }

  /**
   * Decrement the value by the configured step amount.
   */
  decrement(): void {
    const step = this._config.step ?? 1;
    this.setValue(this._value - step);
    this.emitter.emit("UINumericDecrement", {
      name: this.name,
      target: this,
      event: "decrement",
      value: this._value,
    });
  }

  /**
   * Set the numeric value. Clamps to min/max and emits change event if changed.
   * @param value - The new value to set.
   */
  setValue(value: number): void {
    const clamped = this.clampValue(value);
    if (this._value !== clamped) {
      this._value = clamped;
      this._inputText = this.formatNumber(this._value);
      this._cursorPosition = Math.min(this._cursorPosition, this._inputText.length);
      this._isEditing = false;
      this.emitValueChanged();
    }
  }

  /**
   * Get the current numeric value.
   */
  getValue(): number {
    return this._value;
  }

  /**
   * Get the text to display (either editing text or formatted value).
   */
  getDisplayText(): string {
    return this._isEditing ? this._inputText : this.formatNumber(this._value);
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
    this._cursorPosition = Math.max(0, Math.min(position, this._inputText.length));
    this.resetCursorBlink();
  }

  /** Give the input keyboard focus and emit `UINumericFocused`. */
  focus(): void {
    if (!this.isEnabled) return;
    if (this._isFocused) return;

    this._isFocused = true;
    this.state = "focused";
    this._cursorVisible = true;
    this._cursorBlinkTimer = 0;
    // When focusing, switch to raw editing mode
    this._inputText = this._value.toString();
    this._cursorPosition = this._inputText.length;
    this._isEditing = true;
    this.emitter.emit("UINumericFocused", { name: this.name, target: this, event: "focused" });
  }

  /** Remove keyboard focus from the input. */
  loseFocus(): void {
    if (!this.isEnabled) return;
    if (!this._isFocused) return;

    if (this._isEditing) {
      this.commitValue();
    }

    this._isFocused = false;
    this.state = "normal";
    this._isEditing = false;
    this._inputText = this.formatNumber(this._value);
    this.emitter.emit("UINumericUnfocused", { name: this.name, target: this, event: "unfocused" });
  }

  /** Whether the input currently has keyboard focus. */
  get isFocused(): boolean {
    return this._isFocused;
  }

  /**
   * Set the minimum allowed value.
   * @param min - The new minimum value.
   */
  setMin(min: number): void {
    this._config.min = min;
    this.setValue(this._value); // Re-clamp current value
  }

  /**
   * Set the maximum allowed value.
   * @param max - The new maximum value.
   */
  setMax(max: number): void {
    this._config.max = max;
    this.setValue(this._value); // Re-clamp current value
  }

  /**
   * Set the step size for increment/decrement operations.
   * @param step - The new step size.
   */
  setStep(step: number): void {
    this._config.step = Math.abs(step);
  }

  /**
   * Update the number formatting options.
   * @param options - Partial format options to merge with existing options.
   */
  setFormatOptions(options: Partial<UINumericFormatOptions>): void {
    this._config.formatOptions = { ...this._config.formatOptions, ...options };
    if (!this._isEditing) {
      this._inputText = this.formatNumber(this._value);
    }
  }

  /** Get the current state of the numeric input. */
  get numericState(): UINumericState {
    return this.state;
  }

  /** Get the minimum allowed value. */
  get min(): number {
    return this._config.min ?? -Infinity;
  }

  /** Get the maximum allowed value. */
  get max(): number {
    return this._config.max ?? Infinity;
  }

  /** Get the step size. */
  get step(): number {
    return this._config.step ?? 1;
  }

  /**
   * The event emitter for the numeric input. Listeners can be added to this
   * emitter to receive events emitted by the input.
   */
  get eventEmitter() {
    return this.emitter;
  }

  /** Emits `UINumericEnabled` when enabled. */
  protected onEnabled(): void {
    this.state = "normal";
    this.emitter.emit("UINumericEnabled", { name: this.name, target: this, event: "enabled" });
  }

  /** Emits `UINumericDisabled` when disabled and removes focus. */
  protected onDisabled(): void {
    if (this._isFocused) {
      this.loseFocus();
    }
    this.state = "disabled";
    this.emitter.emit("UINumericDisabled", { name: this.name, target: this, event: "disabled" });
  }

  /**
   * Sets the enabled state of the numeric input.
   * @param value
   */
  setEnabled(value: boolean): void {
    super.setEnabled(value);
  }
}

/**
 * Graphic implementation for rendering a `UINumeric` input to a canvas.
 * Handles drawing the input box, text, cursor, and border.
 */
class UINumericGraphic extends Graphic {
  private size: Vector;
  private getState: () => UINumericState;
  private getCursorVisible: () => boolean;
  private config: UINumericConfig;
  private owner: UINumeric;
  private radius = 4;
  private padding: Vector;
  private borderWidth: number;
  private colors: UINumericColors;

  cnv: HTMLCanvasElement;
  ctx: CanvasRenderingContext2D;

  /**
   * Create the numeric input graphic.
   * @param owner - The owning `UINumeric` instance.
   * @param size - Size of the input (width,height) for rendering.
   * @param getState - Function that returns the current `UINumericState`.
   * @param getCursorVisible - Function that returns whether the cursor should be visible.
   * @param inputConfig - Numeric input configuration for styling and layout.
   */
  constructor(
    owner: UINumeric,
    size: Vector,
    getState: () => UINumericState,
    getCursorVisible: () => boolean,
    inputConfig: UINumericConfig,
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
      arrowButtonBackground: Color.fromHex("#F5F5F5"),
      arrowButtonHover: Color.fromHex("#E0E0E0"),
      arrowColor: Color.fromHex("#666666"),
      ...inputConfig.colors,
    };
  }

  /** Create a deep clone of this graphic (used by Excalibur). */
  clone(): UINumericGraphic {
    return new UINumericGraphic(this.owner, this.size, this.getState, this.getCursorVisible, this.config);
  }

  /**
   * Render the numeric input to an offscreen canvas and draw it into the Excalibur context.
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
    const displayText = this.owner.getDisplayText();
    const hasText = displayText.length > 0;
    const showPlaceholder = !hasText && this.config.placeholder;

    ctx.fillStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    ctx.strokeStyle = this.config.textOptions?.color?.toString() ?? "#000000";
    const thisFont = this.config.textOptions?.font as Font | undefined;
    const fontSize = thisFont?.size ?? 16;
    const fontFamily = thisFont?.family ?? "Arial";

    // Calculate text area width (subtract arrow buttons if shown)
    const arrowWidth = this.config.showArrows ? (this.config.arrowWidth ?? 20) : 0;
    const textAreaWidth = this.size.x - this.padding.x * 2 - arrowWidth;

    if (showPlaceholder) {
      ctx.fillStyle = "#999999";
      drawText(ctx, this.config.placeholder!, {
        x: this.padding.x,
        y: this.padding.y,
        width: textAreaWidth,
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
        width: textAreaWidth,
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
    const displayText = this.owner.getDisplayText();
    const textBeforeCursor = displayText.substring(0, cursorPos);

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
  private getBorderColor(state: UINumericState): Color | null {
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
   * @param state - Current `UINumericState`.
   */
  private backgroundGradient(ctx: CanvasRenderingContext2D, state: UINumericState): CanvasGradient | null {
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

// #region Child Components

/**
 * Arrow button component for incrementing/decrementing numeric values.
 * Used internally by UINumeric when showArrows is enabled.
 */
class UINumericArrowButton extends ScreenElement {
  private direction: "up" | "down";
  private owner: UINumeric;
  private hover = false;
  private config: UINumericConfig;

  constructor(owner: UINumeric, direction: "up" | "down", config: UINumericConfig) {
    super({
      name: `arrow-${direction}`,
      width: config.arrowWidth ?? 20,
      height: (config.height ?? 40) / 2,
      pos: vec((config.width ?? 200) - (config.arrowWidth ?? 20), direction === "up" ? 0 : (config.height ?? 40) / 2),
      z: 10,
    });

    this.owner = owner;
    this.direction = direction;
    this.config = config;

    this.pointer.useGraphicsBounds = true;

    this.on("pointerenter", () => (this.hover = true));
    this.on("pointerleave", () => (this.hover = false));

    this.on("pointerdown", () => {
      if (!this.owner.isEnabled) return;
      direction === "up" ? this.owner.increment() : this.owner.decrement();
    });

    this.graphics.use(new UINumericArrowGraphic(this));
  }

  isHovering(): boolean {
    return this.hover;
  }

  getDirection(): "up" | "down" {
    return this.direction;
  }

  getConfig(): UINumericConfig {
    return this.config;
  }
}

/**
 * Graphic implementation for rendering arrow buttons.
 */
class UINumericArrowGraphic extends Graphic {
  private btn: UINumericArrowButton;

  constructor(btn: UINumericArrowButton) {
    super({ width: btn.width, height: btn.height });
    this.btn = btn;
  }

  clone(): UINumericArrowGraphic {
    return new UINumericArrowGraphic(this.btn);
  }

  protected _drawImage(ex: ExcaliburGraphicsContext, x: number, y: number): void {
    const ctx = document.createElement("canvas").getContext("2d")!;
    ctx.canvas.width = this.width;
    ctx.canvas.height = this.height;

    const cfg = this.btn.getConfig().colors!;
    ctx.fillStyle = this.btn.isHovering()
      ? (cfg.arrowButtonHover?.toString() ?? "#E0E0E0")
      : (cfg.arrowButtonBackground?.toString() ?? "#F5F5F5");

    ctx.fillRect(0, 0, this.width, this.height);

    ctx.fillStyle = cfg.arrowColor?.toString() ?? "#666";

    const cx = this.width / 2;
    const cy = this.height / 2;
    const size = 6;

    ctx.beginPath();
    if (this.btn.getDirection() === "up") {
      ctx.moveTo(cx, cy - size / 2);
      ctx.lineTo(cx + size, cy + size / 2);
      ctx.lineTo(cx - size, cy + size / 2);
    } else {
      ctx.moveTo(cx, cy + size / 2);
      ctx.lineTo(cx + size, cy - size / 2);
      ctx.lineTo(cx - size, cy - size / 2);
    }
    ctx.closePath();
    ctx.fill();

    ex.drawImage(ctx.canvas, x, y);
  }
}

// #endregion Child Components

// #region Events

/** Event emitted when the numeric value changes. */
export class UINumericValueChanged extends GameEvent<UINumeric> {
  constructor(
    public target: UINumeric,
    public value: number,
  ) {
    super();
  }
}

/** Event emitted when the input gains keyboard focus. */
export class UINumericFocused extends GameEvent<UINumeric> {
  constructor(public target: UINumeric) {
    super();
  }
}

/** Event emitted when the input loses keyboard focus. */
export class UINumericUnfocused extends GameEvent<UINumeric> {
  constructor(public target: UINumeric) {
    super();
  }
}

/** Event emitted when the input is enabled. */
export class UINumericEnabled extends GameEvent<UINumeric> {
  constructor(public target: UINumeric) {
    super();
  }
}

/** Event emitted when the input is disabled. */
export class UINumericDisabled extends GameEvent<UINumeric> {
  constructor(public target: UINumeric) {
    super();
  }
}

/** Event emitted when Enter key is pressed to submit the value. */
export class UINumericSubmit extends GameEvent<UINumeric> {
  constructor(
    public target: UINumeric,
    public value: number,
  ) {
    super();
  }
}

/** Event emitted when the value is incremented. */
export class UINumericIncrement extends GameEvent<UINumeric> {
  constructor(
    public target: UINumeric,
    public value: number,
  ) {
    super();
  }
}

/** Event emitted when the value is decremented. */
export class UINumericDecrement extends GameEvent<UINumeric> {
  constructor(
    public target: UINumeric,
    public value: number,
  ) {
    super();
  }
}

// #endregion Events
