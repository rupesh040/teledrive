import { createElement } from "react";
import "@material/web/ripple/ripple.js";

/** Official Material state layer, attached to its nearest native control. */
export function Ripple({ disabled = false }: { disabled?: boolean }) {
  return createElement("md-ripple", {
    "aria-hidden": "true",
    disabled: disabled ? "" : undefined,
  });
}
