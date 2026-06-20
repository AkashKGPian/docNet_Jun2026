import React, { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import './PasswordField.css';

const PasswordField = ({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  minLength,
  autoComplete = 'current-password',
  disabled,
  variant = 'default',
  icon = null,
  className,
  ...rest
}) => {
  const [visible, setVisible] = useState(false);

  const inputClass =
    className ||
    (variant === 'auth' ? 'auth-input-field' : variant === 'plain' ? '' : 'input-field');

  const wrapperClass =
    variant === 'auth'
      ? 'password-field input-wrapper auth-input-wrapper'
      : variant === 'plain'
        ? 'password-field password-field--plain'
        : 'password-field input-wrapper';

  return (
    <div className={wrapperClass}>
      {icon}
      <input
        id={id}
        name={name}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`password-field__input ${inputClass}`.trim()}
        {...rest}
      />
      <button
        type="button"
        className="password-field__toggle"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
        tabIndex={-1}
      >
        {visible ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
      </button>
    </div>
  );
};

export default PasswordField;
