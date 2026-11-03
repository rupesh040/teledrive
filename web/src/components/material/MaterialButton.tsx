import {
  createElement,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import "@material/web/button/filled-button.js";
import "@material/web/button/filled-tonal-button.js";
import "@material/web/button/outlined-button.js";
import "@material/web/button/text-button.js";

export interface MaterialButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "filled" | "tonal" | "outlined" | "text";
  icon?: ReactNode;
}

/** React 18 bridge to Google's form-associated Material 3 buttons. */
export function MaterialButton({
  variant = "filled",
  icon,
  children,
  className = "",
  disabled,
  type = "button",
  ...props
}: MaterialButtonProps) {
  const tag =
    variant === "tonal" ? "md-filled-tonal-button" : `md-${variant}-button`;
  return createElement(
    tag,
    {
      ...props,
      class: `material-button ${className}`.trim(),
      disabled: disabled ? "" : undefined,
      type,
    },
    icon
      ? createElement(
          "span",
          {
            slot: "icon",
            className: "material-button-icon",
            "aria-hidden": true,
          },
          icon,
        )
      : null,
    children,
  );
}
