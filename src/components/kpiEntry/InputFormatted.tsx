import React, { useMemo, useState } from "react";

interface InputFormattedProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "placeholder"> {
  value: number | string;
  format: (n: number) => string;
}

const InputFormatted: React.FC<InputFormattedProps> = ({
  onFocus: onFocusOuter,
  onBlur: onBlurOuter,
  value: valueOuter,
  format,
  ...rest
}) => {
  const [focused, setFocused] = useState(false);

  const onFocus = (ev: React.FocusEvent<HTMLInputElement>) => {
    setFocused(true);
    onFocusOuter?.(ev);
  };

  const onBlur = (ev: React.FocusEvent<HTMLInputElement>) => {
    setFocused(false);
    const val = isNaN(ev.target.valueAsNumber) ? "" : ev.target.valueAsNumber;
    ev.target.value = String(val);
    onBlurOuter?.(ev);
  };

  const value = useMemo(() => {
    if (valueOuter === "") return "";
    if (focused) return valueOuter;
    const num = Number(valueOuter);
    return num === 0 ? "" : format(num);
  }, [focused, valueOuter, format]);

  return (
    <input
      {...rest}
      type={focused ? "number" : "text"}
      inputMode="numeric"
      onFocus={onFocus}
      onBlur={onBlur}
      value={value}
    />
  );
};

export default InputFormatted;
