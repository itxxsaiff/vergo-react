import { useRef } from 'react'
import { useLanguage } from '../context/LanguageContext'

/**
 * One box per digit of a confirmation code. Typing moves forward, backspace
 * moves back, the arrow keys walk the row and a pasted code fills it at once.
 */
function CodeInput({ value = '', onChange, length = 6 }) {
  const { t } = useLanguage()
  const inputRefs = useRef([])

  function focusBox(index) {
    inputRefs.current[index]?.focus()
    inputRefs.current[index]?.select()
  }

  function handleChange(index, rawValue) {
    const digit = rawValue.replace(/\D/g, '').slice(-1)
    const next = value.padEnd(length, ' ').split('')
    next[index] = digit || ' '

    onChange(next.join('').trimEnd())

    if (digit && index < length - 1) {
      focusBox(index + 1)
    }
  }

  function handleKeyDown(index, event) {
    if (event.key === 'Backspace' && !value[index] && index > 0) {
      event.preventDefault()
      focusBox(index - 1)
      onChange(value.slice(0, index - 1))

      return
    }

    if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault()
      focusBox(index - 1)
    }

    if (event.key === 'ArrowRight' && index < length - 1) {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  function handlePaste(event) {
    const pasted = (event.clipboardData?.getData('text') ?? '').replace(/\D/g, '').slice(0, length)

    if (!pasted) {
      return
    }

    event.preventDefault()
    onChange(pasted)
    focusBox(Math.min(pasted.length, length - 1))
  }

  return (
    <div className="vergo-auth-code">
      {Array.from({ length }, (_, index) => (
        <input
          key={index}
          ref={(element) => { inputRefs.current[index] = element }}
          className="vergo-auth-code-box"
          inputMode="numeric"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          value={value[index] ?? ''}
          onChange={(event) => handleChange(index, event.target.value)}
          onKeyDown={(event) => handleKeyDown(index, event)}
          onPaste={handlePaste}
          aria-label={`${t('Ziffer')} ${index + 1}`}
        />
      ))}
    </div>
  )
}

export default CodeInput
