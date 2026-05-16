import { InteractiveUIComponent } from "./uiComponent";

type Focusable = InteractiveUIComponent;

export class UIFocusManager {
  private currentTabIndex: number = -1;
  private components = new Map<number, Focusable>(); // tabIndex → component

  /** Get current focused component */
  get focused(): Focusable | undefined {
    return this.components.get(this.currentTabIndex);
  }

  /** Register one or multiple components */
  register(componentOrArray: Focusable | Focusable[]) {
    const components = Array.isArray(componentOrArray) ? componentOrArray : [componentOrArray];
    for (const comp of components) {
      if (this.components.has(comp.tabStopIndex)) {
        debugger;
        console.warn(`Duplicate tabStopIndex ${comp.tabStopIndex}. Only one component per index is supported.`);
      }
      this.components.set(comp.tabStopIndex, comp);
      comp.setManager(this);
    }
  }

  /** Unregister one or multiple components */
  unregister(componentOrArray: Focusable | Focusable[]) {
    const components = Array.isArray(componentOrArray) ? componentOrArray : [componentOrArray];
    for (const comp of components) {
      if (this.currentTabIndex === comp.tabStopIndex) {
        this.clearFocus();
      }
      this.components.delete(comp.tabStopIndex);
    }
  }

  /** Set focus to a specific component */
  setFocus(component: Focusable) {
    if (this.focused === component) return;

    this.focused?.loseFocus();
    this.currentTabIndex = component.tabStopIndex;
    component.focus();
  }

  /** Clear focus */
  clearFocus() {
    this.focused?.loseFocus();
    this.currentTabIndex = -1;
  }

  /** Move focus forward (Tab) or backward (Shift+Tab) */
  moveFocus(forward = true) {
    if (this.components.size === 0) return;

    const sorted = Array.from(this.components.keys()).sort((a, b) => a - b);
    let nextIndex: number;

    if (this.currentTabIndex === -1) {
      nextIndex = forward ? sorted[0] : sorted[sorted.length - 1];
    } else {
      const currentPos = sorted.indexOf(this.currentTabIndex);
      nextIndex = forward ? sorted[(currentPos + 1) % sorted.length] : sorted[(currentPos - 1 + sorted.length) % sorted.length];
    }

    const next = this.components.get(nextIndex);
    if (next) this.setFocus(next);
  }
}
